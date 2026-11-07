"use server";
import { prepareWatermark } from "@/lib/watermark";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { after } from "next/server";
import { checkPrompt, costFor, GEN_DURATIONS, GEN_STYLES, MAX_SHOTS, mockResult, mockState } from "@/lib/generation";
import { failJob, genProvider, runLtxJob } from "@/lib/video-gen";
import { STITCH_MAX_CLIPS, StitchError, stitchClips } from "@/lib/video-stitch";

/** Real provider: rough progress estimate while the Space works (it reports no progress). */
const LTX_EXPECTED_MS = 45_000;
/** A real job still running after this is considered lost (server restart, Space hang). */
const LTX_STALE_MS = 10 * 60_000;

async function requireCreator() {
  const user = await getCurrentUser();
  if (!user || user.kidsMode || (user.role !== "CREATOR" && user.role !== "ADMIN")) throw new Error("FORBIDDEN");
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

export type StartResult = { ok: true; jobs: GenJobDTO[]; credits: number } | { ok: false; error: "forbidden" | "invalid" | "empty" | "too_long" | "forbidden_content" | "no_credits" };

const startSchema = z.object({
  /** Single clip: the prompt. Storyboard: the shared scene description (place, characters), may be empty. */
  prompt: z.string(),
  /** Storyboard: one line per shot. Each becomes its own clip with the same style, format and seed. */
  shots: z.array(z.string().max(400)).min(1).max(MAX_SHOTS).optional(),
  style: z.enum(GEN_STYLES),
  orientation: z.enum(["VERTICAL", "HORIZONTAL"]),
  durationSec: z.union([z.literal(5), z.literal(10)]).refine((d) => (GEN_DURATIONS as readonly number[]).includes(d)),
  seed: z.number().int().min(0).max(2 ** 31 - 1).optional(),
});

type JobRow = Awaited<ReturnType<typeof prisma.generationJob.findFirstOrThrow>>;

function toDTO(j: JobRow, now: number): GenJobDTO {
  const elapsed = now - j.createdAt.getTime();
  const progress =
    j.status === "DONE" ? 1 : j.status === "FAILED" ? 0 : j.provider === "mock" ? mockState(elapsed, j.durationSec).progress : Math.min(0.95, elapsed / LTX_EXPECTED_MS);
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
  const stale = await prisma.generationJob.findMany({
    where: { userId, provider: { not: "mock" }, status: { in: ["QUEUED", "RUNNING"] }, createdAt: { lt: new Date(now - LTX_STALE_MS) } },
    select: { id: true },
  });
  for (const j of stale) await failJob(j.id, "TIMEOUT");
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
  const scene = d.prompt.trim();
  const shots = d.shots?.map((x) => x.trim()).filter(Boolean);
  if (d.shots && !shots?.length) return { ok: false, error: "empty" };
  // Storyboard: every shot is generated with the scene description in front, so the clips stay consistent.
  const prompts = shots ? shots.map((x) => (scene ? `${scene}. ${x}` : x)) : [scene];
  for (const p of prompts) {
    const check = checkPrompt(p);
    if (!check.ok) return { ok: false, error: check.reason === "forbidden" ? "forbidden_content" : check.reason };
  }

  const cost = costFor(d.durationSec) * prompts.length;
  const seed = d.seed ?? Math.floor(Math.random() * 2 ** 31);
  try {
    const [jobs, credits] = await prisma.$transaction(async (tx) => {
      // Atomic conditional decrement: never goes negative under concurrency.
      const dec = await tx.user.updateMany({ where: { id: user.id, genCredits: { gte: cost } }, data: { genCredits: { decrement: cost } } });
      if (dec.count === 0) throw new Error("NO_CREDITS");
      const provider = genProvider();
      const jobs = [];
      for (const p of prompts) {
        jobs.push(
          await tx.generationJob.create({
            data: {
              userId: user.id, prompt: p, style: d.style, orientation: d.orientation, durationSec: d.durationSec, seed, cost: costFor(d.durationSec),
              provider, ...(provider === "mock" ? {} : { status: "RUNNING" as const }),
            },
          }),
        );
      }
      const u = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { genCredits: true } });
      return [jobs, u.genCredits] as const;
    });
    // Real generation takes ~10–60 s per clip: run after the response, one after another (free GPU quota), the studio polls.
    const real = jobs.filter((j) => j.provider === "ltx");
    if (real.length) after(async () => { for (const j of real) await runLtxJob(j.id); });
    const now = Date.now();
    // Newest first, like the history list.
    return { ok: true, jobs: jobs.map((j) => toDTO(j, now)).reverse(), credits };
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

export type AssembleResult = { ok: true; episodeId: string; number: number; durationSec: number } | { ok: false; error: "forbidden" | "invalid" | "not_ready" | "too_many" | "external" | "stitch" };

const assembleSchema = z.object({
  jobIds: z.array(z.string().min(1).max(40)).min(1).max(STITCH_MAX_CLIPS),
  seriesId: z.string().min(1).max(40),
  /** new = a new episode at the end of the series; append = clips go after the existing video of an episode. */
  mode: z.enum(["new", "append"]),
  episodeId: z.string().max(40).optional(),
  title: z.string().max(120).default(""),
});

/**
 * Editing table → episode: joins the chosen clips (in the given order) with ffmpeg into one video and
 * either creates the next episode or appends them to the end of an existing one (its sound is kept).
 */
export async function assembleClipsAction(input: unknown): Promise<AssembleResult> {
  let user;
  try {
    user = await requireCreator();
  } catch {
    return { ok: false, error: "forbidden" };
  }
  const parsed = assembleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const d = parsed.data;
  const series = await prisma.series.findUnique({ where: { id: d.seriesId } });
  if (!series || (series.creatorId !== user.id && user.role !== "ADMIN")) return { ok: false, error: "forbidden" };

  const rows = await prisma.generationJob.findMany({ where: { id: { in: d.jobIds }, userId: user.id } });
  const byId = new Map(rows.map((j) => [j.id, j]));
  const jobs = d.jobIds.map((id) => byId.get(id));
  if (jobs.some((j) => !j || j.status !== "DONE" || !j.resultUrl)) return { ok: false, error: "not_ready" };
  const clips = jobs as NonNullable<(typeof jobs)[number]>[];
  const clipSeconds = clips.reduce((a, j) => a + j.durationSec, 0);

  const target = d.mode === "append" ? await prisma.episode.findFirst({ where: { id: d.episodeId ?? "", seriesId: series.id } }) : null;
  if (d.mode === "append" && !target) return { ok: false, error: "invalid" };
  const refs = [...(target ? [target.videoUrl] : []), ...clips.map((j) => j.resultUrl!)];
  if (refs.length > STITCH_MAX_CLIPS) return { ok: false, error: "too_many" };
  if (target && !/^(storage|demo):/.test(target.videoUrl) && !target.videoUrl.startsWith("/")) return { ok: false, error: "external" };

  let videoUrl: string;
  try {
    videoUrl =
      refs.length === 1
        ? refs[0]
        : await stitchClips(refs, series.orientation, `ep-${series.id.slice(-8)}-${Date.now().toString(36)}`, "studio");
  } catch (e) {
    if (e instanceof StitchError && e.code === "BAD_CLIP") return { ok: false, error: target ? "external" : "stitch" };
    return { ok: false, error: "stitch" };
  }

  const title = d.title.trim();
  let ep;
  if (target) {
    ep = await prisma.episode.update({
      where: { id: target.id },
      data: { videoUrl, durationSec: target.durationSec + clipSeconds, ...(title ? { titleRu: title, titleEn: title } : {}) },
    });
  } else {
    const last = await prisma.episode.findFirst({ where: { seriesId: series.id }, orderBy: { number: "desc" } });
    ep = await prisma.episode.create({
      data: { seriesId: series.id, number: (last?.number ?? 0) + 1, titleRu: title, titleEn: title, videoUrl, durationSec: clipSeconds },
    });
  }
  after(() => prepareWatermark(videoUrl).catch(() => {}));
  revalidatePath(`/studio/series/${series.id}`);
  revalidatePath(`/series/${series.slug}`);
  return { ok: true, episodeId: ep.id, number: ep.number, durationSec: ep.durationSec };
}
