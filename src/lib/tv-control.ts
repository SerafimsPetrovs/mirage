import "server-only";
import type { Prisma, TvChannel } from "@prisma/client";
import { prisma } from "./db";
import { utcDay } from "./rewards";
import { airLength, onAir, TvError } from "./tv";
import { bufferFill, isFresh, minutesShort, zoneFor, type BountyZone } from "./bounty-rules";
import { parseScriptToEmotionalTimeline, stripTags, timelineDuration, TONES, type Tone } from "./mascot";
import { normalizeText } from "./tv-rules";
import { synthesize } from "./tts";
import type { Locale } from "@/i18n/shared";
import type { TvMascotDTO } from "./tv-types";

/**
 * MIRAGE TV control room. Viewers watch the schedule "now"; the master monitor looks BROADCAST_DELAY_SEC ahead,
 * so anything in that window can still be cut before a single viewer sees it (the classic broadcast delay).
 */
export const BROADCAST_DELAY_SEC = 120;
const FAR = 100 * 365 * 86400_000;

type Tx = Prisma.TransactionClient;
type Item = { type: "CLIP" | "EPISODE"; id: string };

const end = (s: { startsAt: Date; durationSec: number }) => s.startsAt.getTime() + s.durationSec * 1000;

async function currentSlot(tx: Tx, channelId: string, now: Date) {
  return tx.tvSlot.findFirst({ where: { channelId, startsAt: { lte: now } }, orderBy: { startsAt: "desc" } });
}

/**
 * Moves every slot of the channel starting at/after `fromMs` by `deltaMs`. Moving earlier leaves a hole at the
 * very end of the chain — it is filled with a short "stay tuned" host card, so the schedule never has gaps.
 */
async function shiftFrom(tx: Tx, channelId: string, fromMs: number, deltaMs: number) {
  if (!deltaMs) return;
  const rows = await tx.tvSlot.findMany({ where: { channelId, startsAt: { gte: new Date(fromMs) } }, orderBy: { startsAt: "asc" }, select: { id: true, startsAt: true, durationSec: true } });
  if (!rows.length) return;
  // Two phases so the (channelId, startsAt) unique key never collides mid-way.
  for (const [i, r] of rows.entries()) await tx.tvSlot.update({ where: { id: r.id }, data: { startsAt: new Date(r.startsAt.getTime() + FAR + i) } });
  for (const r of rows) await tx.tvSlot.update({ where: { id: r.id }, data: { startsAt: new Date(r.startsAt.getTime() + deltaMs), day: utcDay(new Date(r.startsAt.getTime() + deltaMs)) } });
  if (deltaMs < 0) {
    const last = rows[rows.length - 1];
    const at = new Date(end(last) + deltaMs);
    await tx.tvSlot.create({
      data: { channelId, day: utcDay(at), startsAt: at, durationSec: Math.ceil(-deltaMs / 1000), kind: "HOST", textRu: "Не переключайтесь — дальше будет ещё страннее.", textEn: "Stay tuned — it only gets weirder from here." },
    });
  }
}

async function itemSlot(item: Item) {
  if (item.type === "CLIP") {
    const c = await prisma.tvClip.findUnique({ where: { id: item.id } });
    if (!c || c.status !== "APPROVED") throw new TvError("NOT_FOUND");
    return { kind: "CLIP", clipId: c.id, episodeId: null, durationSec: Math.max(1, await airLength(c.videoUrl, c.durationSec)) };
  }
  const e = await prisma.episode.findUnique({ where: { id: item.id }, include: { series: { select: { status: true } } } });
  if (!e || e.series.status !== "PUBLISHED") throw new TvError("NOT_FOUND");
  return { kind: "EPISODE", clipId: null, episodeId: e.id, durationSec: Math.max(1, await airLength(e.videoUrl, e.durationSec)) };
}

type NewSlot = { kind: string; clipId?: string | null; episodeId?: string | null; durationSec: number; textRu?: string; textEn?: string; data?: string };

/** "Play next": right after what viewers see now; the rest of the grid moves later. */
async function insertNext(channelId: string, slot: NewSlot, now: Date) {
  return prisma.$transaction(async (tx) => {
    const cur = await currentSlot(tx, channelId, now);
    const at = cur && end(cur) > now.getTime() ? end(cur) : now.getTime();
    await shiftFrom(tx, channelId, at, slot.durationSec * 1000);
    return tx.tvSlot.create({ data: { channelId, day: utcDay(new Date(at)), startsAt: new Date(at), ...slot } });
  }, { timeout: 30_000 });
}

/** "Force play now": the current programme is cut at this second and the new one starts immediately. */
async function insertNow(channelId: string, slot: NewSlot, now: Date) {
  return prisma.$transaction(async (tx) => {
    const cur = await currentSlot(tx, channelId, now);
    let at = now.getTime();
    let rest = 0;
    if (cur && end(cur) > now.getTime()) {
      const keep = Math.floor((now.getTime() - cur.startsAt.getTime()) / 1000);
      rest = end(cur) - (cur.startsAt.getTime() + keep * 1000);
      at = cur.startsAt.getTime() + keep * 1000;
      if (keep < 1) await tx.tvSlot.delete({ where: { id: cur.id } });
      else await tx.tvSlot.update({ where: { id: cur.id }, data: { durationSec: keep } });
      await shiftFrom(tx, channelId, end(cur), slot.durationSec * 1000 - rest);
    } else await shiftFrom(tx, channelId, at, slot.durationSec * 1000);
    return tx.tvSlot.create({ data: { channelId, day: utcDay(new Date(at)), startsAt: new Date(at), ...slot } });
  }, { timeout: 30_000 });
}

export async function playNext(channelId: string, item: Item, now = new Date()) {
  return insertNext(channelId, await itemSlot(item), now);
}

export async function forcePlayNow(channelId: string, item: Item, now = new Date()) {
  return insertNow(channelId, await itemSlot(item), now);
}

/**
 * 🚨 PANIC: takes a slot off the air. Still in the delay buffer → removed before anyone sees it; already on
 * screen → cut at this second. The grid closes the gap seamlessly. The clip goes back to moderation.
 */
export async function panicSlot(slotId: string, now = new Date()) {
  const s = await prisma.tvSlot.findUnique({ where: { id: slotId } });
  if (!s || end(s) <= now.getTime()) throw new TvError("STATE");
  await prisma.$transaction(async (tx) => {
    if (s.startsAt > now) {
      await tx.tvSlot.delete({ where: { id: s.id } });
      await shiftFrom(tx, s.channelId, end(s), -s.durationSec * 1000);
    } else {
      const keep = Math.max(1, Math.floor((now.getTime() - s.startsAt.getTime()) / 1000));
      await tx.tvSlot.update({ where: { id: s.id }, data: { durationSec: keep } });
      await shiftFrom(tx, s.channelId, end(s), -(end(s) - (s.startsAt.getTime() + keep * 1000)));
    }
    const clipId = s.kind === "BREAK" ? s.breakClipId : s.clipId;
    if (clipId) await tx.tvClip.updateMany({ where: { id: clipId, sponsorName: null }, data: { status: "PENDING" } });
  }, { timeout: 30_000 });
}

/** Drag-and-drop: new order of upcoming slots (none of them on air yet). The block keeps its start and end. */
export async function reorderQueue(channelId: string, orderedIds: string[], now = new Date()) {
  const ids = [...new Set(orderedIds)].slice(0, 200);
  await prisma.$transaction(async (tx) => {
    const rows = await tx.tvSlot.findMany({ where: { id: { in: ids }, channelId, startsAt: { gt: now } } });
    if (rows.length !== ids.length) throw new TvError("STATE");
    const byId = new Map(rows.map((r) => [r.id, r]));
    let t = Math.min(...rows.map((r) => r.startsAt.getTime()));
    for (const [i, r] of rows.entries()) await tx.tvSlot.update({ where: { id: r.id }, data: { startsAt: new Date(FAR + t + i) } });
    for (const id of ids) {
      const r = byId.get(id)!;
      await tx.tvSlot.update({ where: { id }, data: { startsAt: new Date(t), day: utcDay(new Date(t)) } });
      t += r.durationSec * 1000;
    }
  }, { timeout: 30_000 });
}

/** Up-next queue of a channel (the next `hours`), with what is airing for viewers and on the master monitor. */
export async function channelQueue(channelId: string, now = new Date(), hours = 3) {
  const master = now.getTime() + BROADCAST_DELAY_SEC * 1000;
  const slots = await prisma.tvSlot.findMany({
    where: { channelId, startsAt: { gte: new Date(now.getTime() - 30 * 60_000), lte: new Date(now.getTime() + hours * 3600_000) } },
    orderBy: { startsAt: "asc" },
    include: { clip: { select: { title: true, artist: true, kind: true } }, episode: { select: { number: true, series: { select: { titleRu: true, titleEn: true } } } } },
  });
  return slots
    .filter((s) => end(s) > now.getTime())
    .map((s) => ({
      id: s.id,
      startsAt: s.startsAt.getTime(),
      durationSec: s.durationSec,
      kind: s.kind,
      title: s.clip ? (s.clip.artist ? `${s.clip.artist} — ${s.clip.title}` : s.clip.title) : s.episode ? `${s.episode.series.titleEn || s.episode.series.titleRu} · ${s.episode.number}` : s.textEn || s.textRu || s.kind,
      publicNow: s.startsAt <= now && end(s) > now.getTime(),
      masterNow: s.startsAt.getTime() <= master && end(s) > master,
      /** In the delay buffer: already on the master monitor, not yet seen by viewers. */
      buffered: s.startsAt > now && s.startsAt.getTime() <= master,
    }));
}

/** Both monitors: what viewers see and what they will see in BROADCAST_DELAY_SEC. */
export async function monitors(ch: TvChannel, locale: Locale, now = new Date()) {
  const [pub, master] = await Promise.all([onAir(ch, locale, null, now, { preview: true }), onAir(ch, locale, null, new Date(now.getTime() + BROADCAST_DELAY_SEC * 1000), { preview: true })]);
  return { public: pub, master };
}

// ───────────── bounty switch, alerts ─────────────

export async function setBountyBoost(channelId: string, hours: number | null, now = new Date()) {
  await prisma.tvChannel.update({ where: { id: channelId }, data: { bountyUntil: hours ? new Date(now.getTime() + hours * 3600_000) : null } });
  invalidateBuffers();
}

export const ALERT_MAX = 160;

export async function addAlert(channelId: string | null, raw: string, minutes: number, now = new Date()) {
  const text = normalizeText(raw).slice(0, ALERT_MAX);
  if (!text) throw new TvError("empty");
  const m = Math.min(24 * 60, Math.max(1, Math.round(minutes)));
  return prisma.tvAlert.create({ data: { channelId, text, until: new Date(now.getTime() + m * 60_000) } });
}

export async function stopAlert(id: string, now = new Date()) {
  await prisma.tvAlert.updateMany({ where: { id }, data: { until: now } });
}

export async function activeAlerts(channelId: string, now = new Date()) {
  const rows = await prisma.tvAlert.findMany({ where: { until: { gt: now }, OR: [{ channelId }, { channelId: null }] }, orderBy: { createdAt: "desc" }, take: 3 });
  return rows.map((r) => ({ id: r.id, text: r.text }));
}

// ───────────── live teleprompter ─────────────

export const PROMPTER_MAX = 600;

/**
 * The mascot reads the admin's text on air. PIP → a corner window over the current video, starting now;
 * BREAKING → a full-screen news slot right after the current programme. `channelId` null = every channel.
 */
export async function injectMascot(input: { channelId: string | null; text: string; mode: "PIP" | "BREAKING"; tone: Tone; locale: Locale }, now = new Date()) {
  const text = normalizeText(input.text).slice(0, PROMPTER_MAX);
  if (!text) throw new TvError("empty");
  const tone: Tone = (TONES as readonly string[]).includes(input.tone) ? input.tone : "AUTO";
  const timeline = parseScriptToEmotionalTimeline(text, tone);
  const audio = await synthesize(stripTags(text), input.locale).catch((e) => (console.error("[tts]", e), null));
  const durationSec = Math.ceil((audio?.durationMs ?? timelineDuration(timeline)) / 1000) + 1;
  const row = await prisma.tvInjection.create({
    data: { channelId: input.channelId, text, mode: input.mode, tone, timeline: JSON.stringify(timeline), audioUrl: audio?.url ?? null, startsAt: now, durationSec },
  });
  if (input.mode === "BREAKING") {
    const channels = input.channelId ? [input.channelId] : (await prisma.tvChannel.findMany({ where: { active: true, familyOnly: false }, select: { id: true } })).map((c) => c.id);
    const data = JSON.stringify({ timeline, audioUrl: audio?.url ?? null });
    for (const channelId of channels) await insertNext(channelId, { kind: "NEWS", durationSec: durationSec + 1, textRu: text, textEn: text, data }, now);
  }
  return row;
}

/** The teleprompter window currently over the picture (PIP mode), if any. */
export async function activePip(channelId: string, now = new Date()): Promise<(TvMascotDTO & { id: string; startsAt: number; text: string }) | null> {
  const rows = await prisma.tvInjection.findMany({
    where: { mode: "PIP", startsAt: { lte: now, gt: new Date(now.getTime() - 15 * 60_000) }, OR: [{ channelId }, { channelId: null }] },
    orderBy: { startsAt: "desc" },
    take: 3,
  });
  const r = rows.find((x) => x.startsAt.getTime() + x.durationSec * 1000 > now.getTime());
  if (!r) return null;
  try {
    return { id: r.id, startsAt: r.startsAt.getTime(), text: r.text, timeline: JSON.parse(r.timeline), audioUrl: r.audioUrl };
  } catch {
    return null;
  }
}

export async function recentInjections() {
  return prisma.tvInjection.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { channel: { select: { nameRu: true, nameEn: true } } } });
}

// ───────────── channel buffers (deficit charts) ─────────────

export type ChannelBuffer = {
  channelId: string;
  slug: string;
  number: number;
  nameRu: string;
  nameEn: string;
  hue: number;
  freshMin: number;
  targetMin: number;
  fill24: number;
  fill48: number;
  zone: BountyZone;
  boosted: boolean;
  shortMin: number;
};

let cache: { at: number; data: ChannelBuffer[] } | null = null;
export function invalidateBuffers() {
  cache = null;
}

/** Buffer fill of every pool channel (cached for a minute — the header shows the hot indicator on every page). */
export async function channelBuffers(now = new Date()): Promise<ChannelBuffer[]> {
  if (cache && now.getTime() - cache.at < 60_000) return cache.data;
  const channels = await prisma.tvChannel.findMany({ where: { active: true, familyOnly: false, isAdult: false }, orderBy: { number: "asc" }, include: { clips: { where: { status: "APPROVED", kind: { in: ["SHOW", "MUSIC", "BUMPER"] } }, select: { durationSec: true, plays: true, createdAt: true } } } });
  const data = channels.map((c) => {
    const freshMin = Math.round(c.clips.filter((x) => isFresh(x, now)).reduce((a, x) => a + x.durationSec, 0) / 60);
    const { fill24, fill48 } = bufferFill(freshMin, c.bufferTargetMin);
    const boosted = !!c.bountyUntil && c.bountyUntil > now;
    return {
      channelId: c.id,
      slug: c.slug,
      number: c.number,
      nameRu: c.nameRu,
      nameEn: c.nameEn,
      hue: c.hue,
      freshMin,
      targetMin: c.bufferTargetMin,
      fill24,
      fill48,
      zone: boosted ? ("RED" as const) : zoneFor(fill24),
      boosted,
      shortMin: minutesShort(freshMin, c.bufferTargetMin),
    };
  });
  cache = { at: now.getTime(), data };
  return data;
}

/** Zone recorded on a creator's upload (decides the bounty when it's approved). */
export async function uploadZone(channelId: string, now = new Date()) {
  const b = (await channelBuffers(now)).find((x) => x.channelId === channelId);
  if (!b) return "GREEN";
  return b.boosted ? "BOOST" : b.zone;
}

export async function hotBountyCount() {
  return (await channelBuffers()).filter((b) => b.zone === "RED").length;
}
