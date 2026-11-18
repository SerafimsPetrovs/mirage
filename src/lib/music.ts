import "server-only";
import { prisma } from "./db";
import { grantCoins, spendCoins } from "./coins";
import { enqueue, registerJob } from "./jobs";
import { analyzeClipBeats } from "./clip-beats";
import { renderTrack } from "./music-render";
import { rebuildRestOfDay, TvError } from "./tv";
import { cleanLrc, isMusicStyle, LYRICS_MAX, lrcToVtt, MUSIC_MAX_IMAGES, MUSIC_ORDER_MAX_OPEN, MUSIC_ORDER_PRICE, type LrcLine } from "./music-rules";

type Actor = { id: string; role: string; kidsMode: boolean };

const TITLE_MAX = 120;
const clean = (s: unknown, max: number) => String(s ?? "").replace(/\u0000/g, "").replace(/\s+/g, " ").trim().slice(0, max);

export type TrackInput = {
  channelId: string;
  title: string;
  artist: string;
  audioRef: string;
  coverRef?: string | null;
  images?: string[];
  lyrics?: string;
  style: string;
  orientation?: "HORIZONTAL" | "VERTICAL";
  rightsOk: boolean;
};

function checkInput(i: TrackInput) {
  const title = clean(i.title, TITLE_MAX);
  if (title.length < 2) throw new TvError("empty");
  if (!/^storage:audio\/[\w.-]+$/.test(i.audioRef)) throw new TvError("STATE");
  const img = (r: unknown) => typeof r === "string" && /^storage:images\/[\w.-]+$/.test(r);
  if (i.coverRef && !img(i.coverRef)) throw new TvError("STATE");
  const images = (i.images ?? []).filter(img).slice(0, MUSIC_MAX_IMAGES);
  if (!isMusicStyle(i.style)) throw new TvError("STATE");
  // Rights are a legal must: we never air a song the uploader did not confirm they may use.
  if (!i.rightsOk) throw new TvError("RIGHTS");
  return {
    title,
    artist: clean(i.artist, 80),
    audioRef: i.audioRef,
    coverRef: i.coverRef || null,
    imagesJson: JSON.stringify(images),
    lyrics: String(i.lyrics ?? "").replace(/\u0000/g, "").slice(0, LYRICS_MAX),
    style: i.style,
    orientation: i.orientation === "VERTICAL" ? ("VERTICAL" as const) : ("HORIZONTAL" as const),
    rightsOk: true,
  };
}

async function musicChannel(channelId: string) {
  const ch = await prisma.tvChannel.findUnique({ where: { id: channelId } });
  if (!ch || !ch.active || ch.kind !== "MUSIC") throw new TvError("NOT_FOUND");
  return ch;
}

/** Admin or creator adds a song: saved as a draft (lyrics can be synced), then rendered with queueRender. */
export async function createTrack(user: Actor, input: TrackInput) {
  if (user.kidsMode || (user.role !== "ADMIN" && user.role !== "CREATOR")) throw new TvError("AUTH");
  const data = checkInput(input);
  const ch = await musicChannel(input.channelId);
  return prisma.musicTrack.create({ data: { ...data, channelId: ch.id, userId: user.id, source: user.role === "ADMIN" ? "ADMIN" : "CREATOR" } });
}

/** A viewer pays to air their own song: waits for a moderator (REVIEW), coins back if rejected. */
export async function orderTrack(user: Actor, input: TrackInput) {
  if (user.kidsMode) throw new TvError("KIDS");
  const data = checkInput(input);
  const ch = await musicChannel(input.channelId);
  const open = await prisma.musicTrack.count({ where: { userId: user.id, source: "ORDER", status: { in: ["DRAFT", "REVIEW", "QUEUED", "RENDERING"] } } });
  if (open >= MUSIC_ORDER_MAX_OPEN) throw new TvError("LIMIT");
  return prisma.$transaction(async (tx) => {
    const charge = await spendCoins(tx, user.id, MUSIC_ORDER_PRICE, "TV_ORDER", { note: `music: ${data.title}`.slice(0, 120) });
    const track = await tx.musicTrack.create({
      data: { ...data, channelId: ch.id, userId: user.id, source: "ORDER", coins: MUSIC_ORDER_PRICE, status: "DRAFT" },
    });
    return { track, balance: charge.balance };
  });
}

/** Owner (or admin) may edit a track until it is rendered. */
async function editable(user: Actor, trackId: string) {
  const t = await prisma.musicTrack.findUnique({ where: { id: trackId } });
  if (!t || (t.userId !== user.id && user.role !== "ADMIN")) throw new TvError("NOT_FOUND");
  if (!["DRAFT", "REVIEW", "FAILED", "READY"].includes(t.status)) throw new TvError("STATE");
  return t;
}

export async function getTrackFor(user: Actor, trackId: string) {
  const t = await prisma.musicTrack.findUnique({ where: { id: trackId }, include: { channel: { select: { slug: true, nameRu: true, nameEn: true } } } });
  if (!t || (t.userId !== user.id && user.role !== "ADMIN")) return null;
  return t;
}

/** Saves line timings from the tap-sync tool (and the lyrics they were made from). */
export async function saveTimings(user: Actor, trackId: string, lines: unknown, lyrics?: string) {
  const t = await editable(user, trackId);
  const clean = cleanLrc(lines, t.durationSec || 0);
  await prisma.musicTrack.update({
    where: { id: t.id },
    data: { lrcJson: clean.length ? JSON.stringify(clean) : "", ...(lyrics !== undefined ? { lyrics: String(lyrics).slice(0, LYRICS_MAX) } : {}) },
  });
  return clean;
}

export async function setStyle(user: Actor, trackId: string, style: string) {
  const t = await editable(user, trackId);
  if (!isMusicStyle(style)) throw new TvError("STATE");
  await prisma.musicTrack.update({ where: { id: t.id }, data: { style } });
}

/**
 * Puts the track in the render queue. Viewer orders go to REVIEW first (a moderator listens and approves);
 * admins/creators render right away. Re-rendering a READY track replaces its video.
 */
export async function queueRender(user: Actor, trackId: string) {
  const t = await editable(user, trackId);
  if (t.source === "ORDER" && user.role !== "ADMIN") {
    if (t.status !== "DRAFT") throw new TvError("STATE");
    await prisma.musicTrack.update({ where: { id: t.id }, data: { status: "REVIEW" } });
    return "REVIEW" as const;
  }
  const r = await prisma.musicTrack.updateMany({ where: { id: t.id, status: t.status }, data: { status: "QUEUED", progress: 0, error: null } });
  if (r.count !== 1) throw new TvError("STATE");
  await enqueue("music.render", { trackId: t.id });
  return "QUEUED" as const;
}

/** Moderator decision on a viewer order: approve → render and air, reject → coins back. */
export async function moderateTrack(trackId: string, decision: "approve" | "reject", reason = "") {
  if (decision === "approve") {
    const r = await prisma.musicTrack.updateMany({ where: { id: trackId, status: "REVIEW" }, data: { status: "QUEUED", progress: 0 } });
    if (r.count !== 1) throw new TvError("STATE");
    await enqueue("music.render", { trackId });
    return;
  }
  await prisma.$transaction(async (tx) => {
    const t = await tx.musicTrack.findUnique({ where: { id: trackId } });
    if (!t || !["REVIEW", "DRAFT", "FAILED"].includes(t.status)) throw new TvError("STATE");
    const r = await tx.musicTrack.updateMany({ where: { id: t.id, status: t.status }, data: { status: "REJECTED", error: reason.slice(0, 300) || null } });
    if (r.count === 1 && t.coins > 0) await grantCoins(t.userId, t.coins, "REFUND", { note: "music order rejected" }, tx);
  });
}

/** Job handler: render → TvClip (approved for admins and moderated orders, pending for creators). */
export async function renderJob(trackId: string) {
  const claimed = await prisma.musicTrack.updateMany({ where: { id: trackId, status: { in: ["QUEUED", "RENDERING"] } }, data: { status: "RENDERING", progress: 1 } });
  if (claimed.count !== 1) return;
  try {
    const { ref, duration, lines } = await renderTrack(trackId);
    const t = await prisma.musicTrack.findUniqueOrThrow({ where: { id: trackId }, include: { user: { select: { name: true } } } });
    const approved = t.source !== "CREATOR";
    const captions = lines.length ? lrcToVtt(lines as LrcLine[], duration) : "";
    const data = {
      videoUrl: ref,
      durationSec: Math.max(5, Math.ceil(duration)),
      captions,
      title: t.title,
      artist: t.artist,
      orientation: t.orientation,
    };
    const clip = t.clipId
      ? await prisma.tvClip.update({ where: { id: t.clipId }, data })
      : await prisma.tvClip.create({
          data: {
            ...data,
            channelId: t.channelId,
            kind: "MUSIC",
            status: approved ? "APPROVED" : "PENDING",
            creatorId: t.userId,
            sponsorName: t.source === "ORDER" ? t.user.name.slice(0, 40) : null,
            aiTools: t.style === "AI" ? "LTX-Video" : "",
            tags: "music",
            prompts: `style: ${t.style}`,
          },
        });
    await prisma.musicTrack.update({ where: { id: t.id }, data: { status: "READY", progress: 100, videoRef: ref, clipId: clip.id, error: null } });
    // tempo + drops for the watch buddy's rave (from the clean song file)
    await analyzeClipBeats(clip.id, t.audioRef).catch((e) => console.error("[music beats]", e));
    if (clip.status === "APPROVED") await rebuildRestOfDay(t.channelId).catch((e) => console.error("[music rebuild]", e));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.musicTrack.update({ where: { id: trackId }, data: { status: "FAILED", error: msg.slice(0, 300) } });
    throw e;
  }
}

registerJob("music.render", async (p) => {
  await renderJob(String(p.trackId));
});

/** Admin list (all) or the user's own tracks. */
export function listTracks(where: { userId?: string; status?: string[] } = {}) {
  return prisma.musicTrack.findMany({
    where: { ...(where.userId ? { userId: where.userId } : {}), ...(where.status ? { status: { in: where.status } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { user: { select: { name: true, email: true } }, channel: { select: { nameRu: true, nameEn: true, slug: true } } },
  });
}

export function musicChannels() {
  return prisma.tvChannel.findMany({ where: { kind: "MUSIC", active: true }, orderBy: { number: "asc" }, select: { id: true, nameRu: true, nameEn: true, slug: true } });
}

export { MUSIC_ORDER_PRICE };
