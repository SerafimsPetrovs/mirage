"use server";
import { z } from "zod";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getBalance, InsufficientCoinsError } from "@/lib/coins";
import { buyCameo, giftCameo, moderateCameo, publishScript, ShowError, writeNextScript } from "@/lib/show";
import { promptsFromScript } from "@/lib/show-rules";
import { genProvider, runLtxJob } from "@/lib/video-gen";
import { mockResult } from "@/lib/generation";

export type ShowResult<T = object> = ({ ok: true } & T) | { ok: false; error: ShowError["code"] | "insufficient" | "auth" | "kids" | "forbidden" | "invalid" | "unknown" };

function fail(e: unknown): { ok: false; error: ShowError["code"] | "insufficient" | "unknown" } {
  if (e instanceof ShowError) return { ok: false, error: e.code };
  if (e instanceof InsufficientCoinsError) return { ok: false, error: "insufficient" };
  console.error(e);
  return { ok: false, error: "unknown" };
}

async function seriesPath(seriesId: string) {
  const s = await prisma.series.findUnique({ where: { id: seriesId }, select: { slug: true } });
  return s ? `/series/${s.slug}` : "/";
}

// ---------------------------------------------------------------- viewers

export async function buyCameoAction(seriesId: string, name: string): Promise<ShowResult<{ balance: number }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (user.kidsMode) return { ok: false, error: "kids" };
  if (typeof name !== "string" || name.length > 60) return { ok: false, error: "NAME" };
  try {
    await buyCameo(user.id, seriesId, name);
  } catch (e) {
    return fail(e);
  }
  revalidatePath(await seriesPath(seriesId));
  revalidatePath("/admin/show");
  return { ok: true, balance: await getBalance(user.id) };
}

// ---------------------------------------------------------------- admin

async function admin() {
  const u = await getCurrentUser();
  return u && !u.kidsMode && u.role === "ADMIN" ? u : null;
}

const done = async (seriesId?: string) => {
  revalidatePath("/admin/show");
  if (seriesId) revalidatePath(await seriesPath(seriesId));
};

export async function setInteractiveAction(seriesId: string, on: boolean): Promise<ShowResult> {
  if (!(await admin())) return { ok: false, error: "forbidden" };
  await prisma.series.update({ where: { id: seriesId }, data: { interactive: on } });
  revalidatePath("/admin/series");
  await done(seriesId);
  return { ok: true };
}

export async function moderateCameoAction(cameoId: string, decision: "approve" | "reject"): Promise<ShowResult> {
  if (!(await admin())) return { ok: false, error: "forbidden" };
  try {
    await moderateCameo(cameoId, decision === "approve" ? "approve" : "reject");
  } catch (e) {
    return fail(e);
  }
  await done();
  return { ok: true };
}

export async function giftCameoAction(seriesId: string, name: string, userId: string | null): Promise<ShowResult> {
  if (!(await admin())) return { ok: false, error: "forbidden" };
  try {
    await giftCameo(seriesId, name, userId, userId ? "TOP" : "GIFT");
  } catch (e) {
    return fail(e);
  }
  await done(seriesId);
  return { ok: true };
}

export async function closePollAction(pollId: string): Promise<ShowResult> {
  if (!(await admin())) return { ok: false, error: "forbidden" };
  const p = await prisma.poll.update({ where: { id: pollId }, data: { closesAt: new Date() } });
  await done(p.seriesId);
  return { ok: true };
}

export async function writeScriptAction(seriesId: string): Promise<ShowResult<{ id: string }>> {
  if (!(await admin())) return { ok: false, error: "forbidden" };
  try {
    const sc = await writeNextScript(seriesId);
    await done();
    return { ok: true, id: sc.id };
  } catch (e) {
    return fail(e);
  }
}

const scriptSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(8000),
  pollQuestion: z.string().trim().min(1).max(200),
  optionA: z.string().trim().min(1).max(80),
  optionB: z.string().trim().min(1).max(80),
  caption: z.string().trim().max(600),
});

export async function saveScriptAction(scriptId: string, input: unknown): Promise<ShowResult> {
  if (!(await admin())) return { ok: false, error: "forbidden" };
  const d = scriptSchema.safeParse(input);
  if (!d.success) return { ok: false, error: "invalid" };
  await prisma.showScript.updateMany({ where: { id: scriptId, episodeId: null }, data: d.data });
  await done();
  return { ok: true };
}

/** Starts one video generation per "PROMPT:" line of the script (admin's jobs, free for the show). */
export async function generateClipsAction(scriptId: string): Promise<ShowResult<{ count: number }>> {
  const user = await admin();
  if (!user) return { ok: false, error: "forbidden" };
  const sc = await prisma.showScript.findUnique({ where: { id: scriptId }, select: { content: true, series: { select: { orientation: true } } } });
  if (!sc) return { ok: false, error: "invalid" };
  const prompts = promptsFromScript(sc.content);
  if (!prompts.length) return { ok: false, error: "invalid" };
  const provider = genProvider();
  const now = Date.now();
  const jobs = await Promise.all(
    prompts.map((prompt, i) => {
      const seed = Math.floor(Math.random() * 2 ** 31);
      return prisma.generationJob.create({
        data: {
          userId: user.id, prompt, style: "cinematic", orientation: sc.series.orientation, durationSec: 5, seed, cost: 0, provider,
          // mock jobs finish instantly here: the show admin just needs a clip to publish
          ...(provider === "mock" ? { status: "DONE" as const, resultUrl: mockResult(seed + i, sc.series.orientation), finishedAt: new Date(now) } : { status: "RUNNING" as const }),
        },
      });
    }),
  );
  if (provider === "ltx") {
    // One at a time: the free Space queues anyway and parallel calls burn the GPU quota faster.
    after(async () => {
      for (const j of jobs) await runLtxJob(j.id);
    });
  }
  await done();
  return { ok: true, count: jobs.length };
}

export async function publishScriptAction(scriptId: string, jobId: string): Promise<ShowResult<{ episodeId: string }>> {
  const user = await admin();
  if (!user) return { ok: false, error: "forbidden" };
  const job = await prisma.generationJob.findFirst({ where: { id: jobId, userId: user.id, status: "DONE" } });
  if (!job?.resultUrl) return { ok: false, error: "invalid" };
  try {
    const ep = await publishScript(scriptId, job.resultUrl, job.durationSec);
    await done(ep.seriesId);
    return { ok: true, episodeId: ep.id };
  } catch (e) {
    return fail(e);
  }
}
