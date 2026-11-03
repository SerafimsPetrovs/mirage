"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { checkPrompt, costFor, GEN_DURATIONS, GEN_STYLES, mockResult, mockState } from "@/lib/generation";

async function requireCreator() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "CREATOR" && user.role !== "ADMIN")) throw new Error("FORBIDDEN");
  return user;
}

export type GenJobDTO = {
  id: string;
  prompt: string;
  style: string;
  orientation: "VERTICAL" | "HORIZONTAL";
  durationSec: number;
  seed: number;
  cost: number;
  status: "QUEUED" | "RUNNING" | "DONE" | "FAILED";
  progress: number;
  error: string | null;
  createdAt: string;
};

export type StartResult = { ok: true; job: GenJobDTO; credits: number } | { ok: false; error: "forbidden" | "invalid" | "empty" | "too_long" | "forbidden_content" | "no_credits" };

const startSchema = z.object({
  prompt: z.string(),
  style: z.enum(GEN_STYLES),
  orientation: z.enum(["VERTICAL", "HORIZONTAL"]),
  durationSec: z.union([z.literal(5), z.literal(10)]).refine((d) => (GEN_DURATIONS as readonly number[]).includes(d)),
  seed: z.number().int().min(0).max(2 ** 31 - 1).optional(),
});

type JobRow = Awaited<ReturnType<typeof prisma.generationJob.findFirstOrThrow>>;

function toDTO(j: JobRow, now: number): GenJobDTO {
  const progress = j.status === "DONE" ? 1 : j.status === "FAILED" ? 0 : mockState(now - j.createdAt.getTime(), j.durationSec).progress;
  return {
    id: j.id,
    prompt: j.prompt,
    style: j.style,
    orientation: j.orientation,
    durationSec: j.durationSec,
    seed: j.seed,
    cost: j.cost,
    status: j.status,
    progress,
    error: j.error,
    createdAt: j.createdAt.toISOString(),
  };
}

/** Advances unfinished mock jobs according to elapsed time. */
async function syncMockJobs(userId: string, now: number) {
  const open = await prisma.generationJob.findMany({ where: { userId, provider: "mock", status: { in: ["QUEUED", "RUNNING"] } } });
  for (const j of open) {
    const s = mockState(now - j.createdAt.getTime(), j.durationSec);
    if (s.status === j.status) continue;
    await prisma.generationJob.update({
      where: { id: j.id },
      data: s.status === "DONE" ? { status: "DONE", resultUrl: mockResult(j.seed, j.orientation), finishedAt: new Date(now) } : { status: s.status },
    });
  }
}

export async function startGenerationAction(input: unknown): Promise<StartResult> {
  let user;
  try {
    user = await requireCreator();
  } catch {
    return { ok: false, error: "forbidden" };
  }
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const d = parsed.data;
  const check = checkPrompt(d.prompt);
  if (!check.ok) return { ok: false, error: check.reason === "forbidden" ? "forbidden_content" : check.reason };

  const cost = costFor(d.durationSec);
  const seed = d.seed ?? Math.floor(Math.random() * 2 ** 31);
  try {
    const [job, credits] = await prisma.$transaction(async (tx) => {
      // Atomic conditional decrement: never goes negative under concurrency.
      const dec = await tx.user.updateMany({ where: { id: user.id, genCredits: { gte: cost } }, data: { genCredits: { decrement: cost } } });
      if (dec.count === 0) throw new Error("NO_CREDITS");
      const job = await tx.generationJob.create({
        data: { userId: user.id, prompt: d.prompt.trim(), style: d.style, orientation: d.orientation, durationSec: d.durationSec, seed, cost },
      });
      const u = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { genCredits: true } });
      return [job, u.genCredits] as const;
    });
    return { ok: true, job: toDTO(job, Date.now()), credits };
  } catch (e) {
    if (e instanceof Error && e.message === "NO_CREDITS") return { ok: false, error: "no_credits" };
    throw e;
  }
}

export async function listGenerationsAction(): Promise<{ jobs: GenJobDTO[]; credits: number }> {
  const user = await requireCreator();
  const now = Date.now();
  await syncMockJobs(user.id, now);
  const [jobs, u] = await Promise.all([
    prisma.generationJob.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { genCredits: true } }),
  ]);
  return { jobs: jobs.map((j) => toDTO(j, now)), credits: u.genCredits };
}

export async function deleteGenerationAction(jobId: string) {
  const user = await requireCreator();
  await prisma.generationJob.deleteMany({ where: { id: jobId, userId: user.id, status: { in: ["DONE", "FAILED"] } } });
}

export async function addGenerationToSeriesAction(jobId: string, seriesId: string, title: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireCreator();
  const [job, series] = await Promise.all([
    prisma.generationJob.findFirst({ where: { id: jobId, userId: user.id, status: "DONE" } }),
    prisma.series.findUnique({ where: { id: seriesId } }),
  ]);
  if (!job?.resultUrl) return { ok: false, error: "not_ready" };
  if (!series || (series.creatorId !== user.id && user.role !== "ADMIN")) return { ok: false, error: "forbidden" };
  const t = title.trim().slice(0, 120);
  const last = await prisma.episode.findFirst({ where: { seriesId }, orderBy: { number: "desc" } });
  await prisma.episode.create({
    data: { seriesId, number: (last?.number ?? 0) + 1, titleRu: t, titleEn: t, videoUrl: job.resultUrl, durationSec: job.durationSec },
  });
  revalidatePath(`/studio/series/${seriesId}`);
  return { ok: true };
}
