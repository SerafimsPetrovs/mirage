import "server-only";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "./db";
import { STORAGE_DIR } from "./files";
import { toEnglish } from "./llm";

/**
 * Real (free) video generation through the public Hugging Face Space "Lightricks/ltx-video-distilled"
 * (LTX-Video, ZeroGPU). No key needed; HF_TOKEN (free account) raises the daily GPU quota.
 * Quality is modest and clips are short (≤ LTX_MAX_SECONDS), but it's real AI video.
 *
 * GEN_PROVIDER=ltx  — this provider; GEN_PROVIDER=mock (default) — placeholder clips.
 */
export const LTX_MAX_SECONDS = 8;
const SPACE = process.env.LTX_SPACE_URL ?? "https://lightricks-ltx-video-distilled.hf.space";
const NEGATIVE = "worst quality, inconsistent motion, blurry, jittery, distorted, watermark, text";

const STYLE_HINT: Record<string, string> = {
  cinematic: "cinematic film still, dramatic lighting, shallow depth of field, film grain",
  anime: "anime style, cel shading, vibrant colors",
  noir: "film noir, black and white, high contrast, hard shadows",
  dreamy: "dreamy soft focus, pastel colors, ethereal glow",
  neon: "neon-lit night, cyberpunk colors, reflections",
  realistic: "photorealistic, natural light, 4k detail",
};

export function genProvider() {
  return process.env.GEN_PROVIDER === "ltx" ? "ltx" : "mock";
}

const headers = () => ({
  "Content-Type": "application/json",
  ...(process.env.HF_TOKEN ? { Authorization: `Bearer ${process.env.HF_TOKEN}` } : {}),
});

/** Calls the Space and returns the URL of the generated mp4. */
async function callLtx(prompt: string, orientation: "VERTICAL" | "HORIZONTAL", seconds: number, seed: number) {
  const [w, h] = orientation === "VERTICAL" ? [448, 704] : [704, 448];
  const data = [prompt, NEGATIVE, null, null, h, w, "text-to-video", Math.min(seconds, LTX_MAX_SECONDS), 9, seed, false, 1, true];
  const start = await fetch(`${SPACE}/gradio_api/call/text_to_video`, { method: "POST", headers: headers(), body: JSON.stringify({ data }), signal: AbortSignal.timeout(30_000) });
  if (!start.ok) throw new Error(`LTX_HTTP_${start.status}`);
  const { event_id } = (await start.json()) as { event_id: string };
  const stream = await fetch(`${SPACE}/gradio_api/call/text_to_video/${event_id}`, { headers: headers(), signal: AbortSignal.timeout(5 * 60_000) });
  const text = await stream.text();
  // Server-sent events: the last "event: complete" carries the result, "event: error" the failure.
  const complete = text.lastIndexOf("event: complete");
  if (complete < 0) {
    const err = text.match(/event: error\s*\ndata: (.*)/)?.[1];
    throw new Error(err && err !== "null" ? `LTX_ERROR ${err.slice(0, 200)}` : "LTX_ERROR (GPU quota or queue — try later)");
  }
  const json = JSON.parse(text.slice(complete).split("\ndata: ")[1].split("\n")[0]) as [{ video: { url: string } }];
  return json[0].video.url;
}

/** Runs one job to the end: generate → download into storage → DONE; on failure FAILED + credits back. */
export async function runLtxJob(jobId: string) {
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "RUNNING") return;
  try {
    const prompt = `${await toEnglish(job.prompt.trim())}. ${STYLE_HINT[job.style] ?? ""}`.slice(0, 1200);
    const url = await callLtx(prompt, job.orientation, job.durationSec, job.seed);
    const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`LTX_DOWNLOAD_${res.status}`);
    const dir = path.join(STORAGE_DIR, "videos", "gen");
    fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
    await fs.promises.writeFile(/*turbopackIgnore: true*/ path.join(dir, `${job.id}.mp4`), Buffer.from(await res.arrayBuffer()));
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "DONE", resultUrl: `storage:videos/gen/${job.id}.mp4`, finishedAt: new Date(), durationSec: Math.min(job.durationSec, LTX_MAX_SECONDS) },
    });
  } catch (e) {
    console.error("[ltx]", job.id, e);
    await failJob(job.id, e instanceof Error ? e.message : "LTX_ERROR");
  }
}

/** Marks a job failed exactly once and returns its credits. */
export async function failJob(jobId: string, error: string) {
  await prisma.$transaction(async (tx) => {
    const j = await tx.generationJob.findUnique({ where: { id: jobId } });
    if (!j || j.status === "DONE" || j.status === "FAILED") return;
    const r = await tx.generationJob.updateMany({ where: { id: jobId, status: j.status }, data: { status: "FAILED", error: error.slice(0, 300), finishedAt: new Date() } });
    if (r.count === 1) await tx.user.update({ where: { id: j.userId }, data: { genCredits: { increment: j.cost } } });
  });
}
