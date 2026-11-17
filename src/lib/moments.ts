import "server-only";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { prisma } from "./db";
import { resolveMediaPath, STORAGE_DIR } from "./files";
import { enqueue, registerJob } from "./jobs";
import { channelFor, fileDuration, TvError } from "./tv";
import { rateLimit } from "./rate-limit";
import { TV_REWIND_MAX_SEC } from "./tv-rules";

const run = promisify(execFile);

/** Length of a "moment" clip: the last N seconds before the button was pressed. */
export const MOMENT_SEC = 20;

type Viewer = Parameters<typeof channelFor>[1];

/**
 * Cuts the broadcast of `slug` that ended at `atMs` (now or a rewound time) into a shareable clip.
 * Only programmes with a video (clips, free episodes); host cards, quizzes and breaks can't be clipped.
 */
export async function createMoment(user: Viewer, slug: string, atMs: number) {
  if (!user || user.kidsMode) throw new TvError("AUTH");
  if (!rateLimit(`moment:${user.id}`, 10, 3600_000).allowed) throw new TvError("RATE");
  const ch = await channelFor(slug, user);
  if (!ch) throw new TvError("NOT_FOUND");
  const now = Date.now();
  const at = Math.min(now, Math.max(now - TV_REWIND_MAX_SEC * 1000, Number(atMs) || now));
  const slot = await prisma.tvSlot.findFirst({
    where: { channelId: ch.id, startsAt: { lte: new Date(at) } },
    orderBy: { startsAt: "desc" },
    include: { clip: true, episode: { include: { series: { select: { titleEn: true, isAdult: true } } } } },
  });
  const source = slot?.clip?.videoUrl ?? slot?.episode?.videoUrl ?? null;
  if (!slot || !source || slot.episode?.series.isAdult || at > slot.startsAt.getTime() + slot.durationSec * 1000) throw new TvError("STATE");
  const into = (at - slot.startsAt.getTime()) / 1000;
  const fileLen = (await fileDuration(source)) || slot.durationSec;
  const end = Math.min(into, fileLen);
  const start = Math.max(0, end - MOMENT_SEC);
  if (end - start < 3) throw new TvError("STATE");
  const title = slot.clip?.title ?? (slot.episode ? `${slot.episode.series.titleEn} · ${slot.episode.number}` : ch.nameEn);
  const m = await prisma.tvMoment.create({
    data: { userId: user.id, channelSlug: ch.slug, title: title.slice(0, 120), sourceRef: source, startSec: start, durationSec: end - start },
  });
  await enqueue("moment.cut", { id: m.id });
  return m;
}

export async function cutMoment(id: string) {
  const m = await prisma.tvMoment.findUnique({ where: { id } });
  if (!m || m.status !== "QUEUED") return;
  try {
    const src = resolveMediaPath(m.sourceRef);
    if (!src || !ffmpegPath) throw new Error("SOURCE_MISSING");
    const vdir = path.join(STORAGE_DIR, "videos", "moments");
    const idir = path.join(STORAGE_DIR, "images");
    fs.mkdirSync(/*turbopackIgnore: true*/ vdir, { recursive: true });
    fs.mkdirSync(/*turbopackIgnore: true*/ idir, { recursive: true });
    const out = path.join(vdir, `${m.id}.mp4`);
    const thumb = path.join(idir, `moment-${m.id}.jpg`);
    await run(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", "-ss", m.startSec.toFixed(2), "-i", src, "-t", m.durationSec.toFixed(2), "-vf", "scale='min(1280,iw)':-2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out]);
    await run(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", "-ss", (m.durationSec / 2).toFixed(2), "-i", out, "-frames:v", "1", "-vf", "scale=1200:-2", thumb]);
    await prisma.tvMoment.update({ where: { id }, data: { status: "READY", videoRef: `storage:videos/moments/${m.id}.mp4`, thumbRef: `storage:images/moment-${m.id}.jpg` } });
  } catch (e) {
    await prisma.tvMoment.update({ where: { id }, data: { status: "FAILED" } });
    throw e;
  }
}

registerJob("moment.cut", async (p) => {
  await cutMoment(String(p.id));
});
