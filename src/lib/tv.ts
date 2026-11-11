import "server-only";
import { Prisma, type TvChannel, type TvSlot } from "@prisma/client";
import { prisma } from "./db";
import { spendCoins, grantCoins } from "./coins";
import { isAdultMode } from "./spicy";
import { complete } from "./llm";
import { posterUrl } from "./poster";
import { mediaUrl } from "./files";
import { readyAssetFor } from "./watermark";
import { utcDay, previousUtcDay } from "./rewards";
import { mockResult, mockState } from "./generation";
import { failJob, genProvider } from "./video-gen";
import { rateLimit } from "./rate-limit";
import { resolveMediaPath } from "./files";
import { probe } from "./video-stitch";
import { pick, type Locale } from "@/i18n/shared";
import { quizBank, type QuizQ } from "./tv-quiz";
import { bountyReward } from "./bounty-rules";
import {
  CHART_SIZE,
  CHART_TEMPLATES,
  DAY_SEC,
  HOST_LINES,
  HOST_TEMPLATES,
  TV_CHAT_HIDE_AFTER_REPORTS,
  TV_CHAT_PER_MIN,
  TV_ORDER_MAX_OPEN,
  TV_ORDER_PRICE,
  TV_TICKER_PRICE,
  TV_TICKER_SHOW_MIN,
  channelVisible,
  chatTextProblem,
  dayStart,
  hostText,
  ideaProblem,
  normalizeText,
  parseHostLines,
  planDay,
  shuffledQuiz,
  tickerTextProblem,
  type ChannelKind,
  type ProgramItem,
  type TextProblem,
} from "./tv-rules";
import type { TvChannelDTO, TvChatDTO, TvNowDTO, TvOrderDTO, TvSlotDTO } from "./tv-types";
import type { TimelineItem } from "./mascot";

/** The one host of every channel (the brand mascot). */
export const MASCOT_NAME = { ru: "Мистер Помеха", en: "Mr. Static" } as const;

export class TvError extends Error {
  constructor(public code: "AUTH" | "KIDS" | "NOT_FOUND" | "STATE" | "LIMIT" | "RATE" | "NO_TICKER" | "MUTED" | TextProblem) {
    super(code);
  }
}

type Viewer = {
  id: string;
  name: string;
  role: string;
  kidsMode: boolean;
  showAdult: boolean;
  adultConfirmedAt: Date | null;
  banned?: boolean;
} | null;

export function tvViewer(user: Viewer) {
  return { kids: !!user?.kidsMode, adult: isAdultMode(user) };
}

// ───────────── channels ─────────────

export async function listChannels(user: Viewer) {
  const all = await prisma.tvChannel.findMany({ where: { active: true }, orderBy: { number: "asc" } });
  const v = tvViewer(user);
  return all.filter((c) => channelVisible(c, v));
}

/** The channel if this viewer may watch it, else null (callers answer 404). */
export async function channelFor(slug: string, user: Viewer) {
  const ch = await prisma.tvChannel.findUnique({ where: { slug } });
  return ch && channelVisible(ch, tvViewer(user)) ? ch : null;
}

export function channelDTO(c: TvChannel, locale: Locale): TvChannelDTO {
  return {
    slug: c.slug,
    number: c.number,
    name: pick(c, "name", locale),
    tagline: pick(c, "tagline", locale),
    kind: c.kind,
    hue: c.hue,
    hostName: c.hostName,
    ticker: c.ticker,
    isAdult: c.isAdult,
    familyOnly: c.familyOnly,
  };
}

// ───────────── schedule ─────────────

type Titles = Map<string, { ru: string; en: string }>;

const durations = new Map<string, number>();

/**
 * Real length of a stored video (cached per file). The DB value can be wrong (e.g. demo episodes say 20 min
 * but the file is 14 s) — a slot must not loop a short clip for half an hour. 0 = unknown (remote/HLS-only).
 */
export async function fileDuration(ref: string) {
  if (durations.has(ref)) return durations.get(ref)!;
  let d = 0;
  const full = /^https?:/.test(ref) ? null : resolveMediaPath(ref);
  if (full) d = await probe(full).then((p) => p.duration).catch(() => 0);
  durations.set(ref, d);
  return d;
}

export async function airLength(ref: string, stored: number) {
  const real = await fileDuration(ref);
  return real > 0 ? Math.ceil(Math.min(stored || real, real)) : stored;
}

/** Everything a channel can air today: approved TV clips + free catalog episodes of its genres + the music chart. */
async function channelContent(ch: TvChannel) {
  const titles: Titles = new Map();
  const programs: ProgramItem[] = [];
  const clips = await prisma.tvClip.findMany({
    where: { channelId: ch.id, status: "APPROVED", kind: { in: ["SHOW", "BUMPER", "MUSIC"] } },
    select: { id: true, title: true, durationSec: true, videoUrl: true },
  });
  for (const c of clips) {
    programs.push({ type: "CLIP", id: c.id, durationSec: await airLength(c.videoUrl, c.durationSec), title: c.id });
    titles.set(c.id, { ru: c.title, en: c.title });
  }

  const genres = ch.genres.split(",").map((g) => g.trim()).filter(Boolean);
  if (genres.length) {
    const series = await prisma.series.findMany({
      where: {
        status: "PUBLISHED",
        // Family channel: only family-safe series; grown-up channels leave the bedtime stories alone.
        isFamilySafe: ch.familyOnly,
        ...(ch.isAdult ? {} : { isAdult: false }),
        OR: genres.map((g) => ({ genres: { contains: g } })),
      },
      orderBy: { views: "desc" },
      take: 40,
      select: { titleRu: true, titleEn: true, freeEpisodes: true, episodes: { where: { OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] }, select: { id: true, number: true, durationSec: true, videoUrl: true }, orderBy: { number: "asc" }, take: 12 } },
    });
    for (const s of series) {
      // Only free episodes go on air: TV is the trailer, the rest is sold in the Library.
      for (const e of s.episodes.filter((e) => e.number <= s.freeEpisodes).slice(0, 3)) {
        programs.push({ type: "EPISODE", id: e.id, durationSec: await airLength(e.videoUrl, e.durationSec), title: e.id });
        titles.set(e.id, { ru: `${s.titleRu || s.titleEn} · ${e.number}`, en: `${s.titleEn || s.titleRu} · ${e.number}` });
      }
    }
  }

  let chart: { id: string; durationSec: number; title: string }[] = [];
  if (ch.kind === "MUSIC") chart = await weeklyChart(ch.id);
  for (const c of chart) titles.set(c.id, titles.get(c.id) ?? { ru: c.title, en: c.title });
  return { programs, chart: chart.map((c) => ({ ...c, title: c.id })), titles };
}

/**
 * Candidates for the on-air "What's next?" poll: shows/music videos of the channel and its free episodes,
 * with display titles in both languages (`title` = English, `titleRu` = Russian).
 */
export async function channelContentForPoll(ch: TvChannel): Promise<(ProgramItem & { titleRu: string })[]> {
  const { programs, titles } = await channelContent(ch);
  const seen = new Set<string>();
  return programs
    .filter((p) => !seen.has(p.id) && seen.add(p.id))
    .map((p) => ({ ...p, title: titles.get(p.id)?.en ?? p.id, titleRu: titles.get(p.id)?.ru ?? p.id }));
}

/** Top music videos of the channel by likes in the last 7 days (plays break ties). */
export async function weeklyChart(channelId: string) {
  const since = new Date(Date.now() - 7 * 86400_000);
  const clips = await prisma.tvClip.findMany({
    where: { channelId, status: "APPROVED", kind: "MUSIC" },
    select: { id: true, title: true, artist: true, durationSec: true, plays: true, _count: { select: { likes: { where: { createdAt: { gte: since } } } } } },
  });
  return clips
    .sort((a, b) => b._count.likes - a._count.likes || b.plays - a.plays || a.id.localeCompare(b.id))
    .slice(0, CHART_SIZE)
    .map((c) => ({ id: c.id, durationSec: c.durationSec, title: c.artist ? `${c.artist} — ${c.title}` : c.title, likes: c._count.likes }));
}

const building = new Map<string, Promise<boolean>>();

/**
 * Makes sure the channel has a schedule for `day` (built once; concurrent callers share the build).
 * Returns true when this call built it (so the caller can ask the showrunner for fresh host lines).
 */
export function ensureDay(ch: TvChannel, day: string, opts: { fromSec?: number; first?: ProgramItem } = {}): Promise<boolean> {
  const key = `${ch.id}:${day}`;
  const running = building.get(key);
  if (running) return running;
  const p = buildDay(ch, day, opts).finally(() => building.delete(key));
  building.set(key, p);
  return p;
}

async function buildDay(ch: TvChannel, day: string, opts: { fromSec?: number; first?: ProgramItem }) {
  const start = dayStart(day);
  const from = opts.fromSec ?? 0;
  if (from === 0 && (await prisma.tvSlot.count({ where: { channelId: ch.id, day } }))) return false;
  const { programs, chart, titles } = await channelContent(ch);
  const first = opts.first ? { ...opts.first, title: opts.first.id } : undefined;
  if (opts.first) titles.set(opts.first.id, titles.get(opts.first.id) ?? { ru: (opts.first as { titleRu?: string }).titleRu ?? opts.first.title, en: opts.first.title });
  const plan = planDay({ seed: `${ch.slug}:${day}:${from}`, programs, chart, breaks: !ch.familyOnly, startSec: from, quiz: ch.quiz && !ch.isAdult, first });
  const bank = quizBank(ch.kind);
  const kind = ch.kind as ChannelKind;
  const lines = HOST_TEMPLATES[kind] ?? HOST_TEMPLATES.ABSURD;
  const t = (id: string | undefined, l: "ru" | "en") => (id ? titles.get(id)?.[l] ?? "" : "");
  const rows: Prisma.TvSlotCreateManyInput[] = plan.map((s) => ({
    channelId: ch.id,
    day,
    startsAt: new Date(start.getTime() + s.offsetSec * 1000),
    durationSec: s.durationSec,
    kind: s.kind,
    clipId: s.clipId ?? null,
    episodeId: s.episodeId ?? null,
    textRu:
      s.kind === "CHART" ? CHART_TEMPLATES.ru[0] : s.kind === "HOST" && s.hostLine! >= 0 ? hostText(lines.ru, s.hostLine!, t(s.prevTitle, "ru"), t(s.nextTitle, "ru")) : s.chartPlace ? String(s.chartPlace) : "",
    textEn:
      s.kind === "CHART" ? CHART_TEMPLATES.en[0] : s.kind === "HOST" && s.hostLine! >= 0 ? hostText(lines.en, s.hostLine!, t(s.prevTitle, "en"), t(s.nextTitle, "en")) : s.chartPlace ? String(s.chartPlace) : "",
    data: s.kind === "QUIZ" && bank.length ? JSON.stringify(shuffledQuiz(bank[s.quizIndex! % bank.length], `${ch.slug}:${day}:${s.offsetSec}`)) : "",
  }));
  try {
    await prisma.$transaction(async (tx) => {
      if (from === 0 && (await tx.tvSlot.count({ where: { channelId: ch.id, day } }))) throw new Error("ALREADY_BUILT");
      for (let i = 0; i < rows.length; i += 500) await tx.tvSlot.createMany({ data: rows.slice(i, i + 500) });
    }, { timeout: 60_000 });
  } catch (e) {
    // Another process built it first (unique channelId+startsAt) — that's fine.
    if (e instanceof Error && e.message === "ALREADY_BUILT") return false;
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
  // Old days are useless: keep yesterday (a slot can still be on air right after midnight) and newer.
  await prisma.tvSlot.deleteMany({ where: { channelId: ch.id, day: { lt: previousUtcDay(day) } } });
  return true;
}

/**
 * Admin: rebuild the rest of today (after approving new clips). The slot on air now keeps playing;
 * everything after it is planned again.
 */
export async function rebuildRestOfDay(channelId: string, now = new Date(), first?: ProgramItem) {
  const ch = await prisma.tvChannel.findUniqueOrThrow({ where: { id: channelId } });
  const day = utcDay(now);
  let current = await prisma.tvSlot.findFirst({ where: { channelId, startsAt: { lte: now } }, orderBy: { startsAt: "desc" } });
  // An empty channel airs hour-long "no signal" cards: cut the current one now so new content starts right away.
  if (current && current.kind === "HOST" && !current.textRu && !current.textEn && !current.clipId && current.startsAt.getTime() + current.durationSec * 1000 > now.getTime()) {
    const keep = Math.max(1, Math.floor((now.getTime() - current.startsAt.getTime()) / 1000));
    current = await prisma.tvSlot.update({ where: { id: current.id }, data: { durationSec: keep } });
  }
  const from = current ? current.startsAt.getTime() + current.durationSec * 1000 : now.getTime();
  await prisma.tvSlot.deleteMany({ where: { channelId, day, startsAt: { gte: new Date(from) } } });
  const fromSec = Math.ceil((from - dayStart(day).getTime()) / 1000);
  if (fromSec < DAY_SEC) await ensureDay(ch, day, { fromSec: Math.max(1, fromSec), first });
}

const rewritten = new Set<string>();

/**
 * The showrunner: one LLM call per channel-day writes HOST_LINES lines in the host's character, which then
 * replace the template lines of that day (titles substituted). Silent no-op without an LLM.
 */
export async function rewriteHostLines(channelId: string, day: string, opts: { force?: boolean } = {}) {
  const key = `${channelId}:${day}`;
  if (rewritten.has(key) && !opts.force) return false;
  rewritten.add(key);
  const ch = await prisma.tvChannel.findUnique({ where: { id: channelId } });
  if (!ch) return false;
  const raw = await complete(
    [
      {
        role: "system",
        content: [
          `You are the showrunner of "${ch.nameEn}", a channel of MIRAGE — an interdimensional AI television (think the cable TV from Rick and Morty).`,
          `The host is ${ch.hostName}, a fictional character: ${ch.hostPersona}`,
          `Write ${HOST_LINES} short on-air lines (max 25 words each) the host says between programmes. Each line MUST contain {next} (the next programme title) and MAY contain {prev} (the previous one).`,
          `Be funny, weird and in character. No real people, no brands, nothing sexual, never mention minors.`,
          `Answer with JSON only: {"ru":[…Russian lines…],"en":[…English lines…]}.`,
        ].join("\n"),
      },
      { role: "user", content: `Channel tagline: ${ch.taglineEn}. Date: ${day}.` },
    ],
    1800,
  );
  const lines = raw ? parseHostLines(raw) : null;
  if (!lines) return false;
  const slots = await prisma.tvSlot.findMany({
    where: { channelId, day },
    orderBy: { startsAt: "asc" },
    select: { id: true, kind: true, textRu: true, clip: { select: { title: true } }, episode: { select: { number: true, series: { select: { titleRu: true, titleEn: true } } } } },
  });
  const title = (s: (typeof slots)[number], l: "ru" | "en") =>
    s.clip?.title ?? (s.episode ? `${l === "ru" ? s.episode.series.titleRu || s.episode.series.titleEn : s.episode.series.titleEn || s.episode.series.titleRu} · ${s.episode.number}` : "");
  const updates: Prisma.PrismaPromise<unknown>[] = [];
  let n = 0;
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (s.kind !== "HOST" || !s.textRu) continue;
    const prev = slots.slice(0, i).reverse().find((x) => x.kind === "CLIP" || x.kind === "EPISODE");
    const next = slots.slice(i + 1).find((x) => x.kind === "CLIP" || x.kind === "EPISODE");
    if (!next) continue;
    updates.push(
      prisma.tvSlot.update({
        where: { id: s.id },
        data: {
          textRu: hostText(lines.ru, n, prev ? title(prev, "ru") : "", title(next, "ru")),
          textEn: hostText(lines.en, n, prev ? title(prev, "en") : "", title(next, "en")),
        },
      }),
    );
    n++;
  }
  for (let i = 0; i < updates.length; i += 200) await prisma.$transaction(updates.slice(i, i + 200));
  return true;
}

// ───────────── on air ─────────────

/**
 * An ad break that just went on air gets its clip: the oldest approved viewer order of this channel
 * (it becomes AIRED), else one of the channel's house ads. Bound once, so every viewer sees the same.
 */
async function bindBreak(slot: TvSlot) {
  const order = await prisma.tvOrder.findFirst({ where: { channelId: slot.channelId, status: "APPROVED", clipId: { not: null } }, orderBy: { createdAt: "asc" } });
  if (order) {
    const done = await prisma.$transaction(async (tx) => {
      const r = await tx.tvSlot.updateMany({ where: { id: slot.id, breakClipId: null }, data: { breakClipId: order.clipId } });
      if (!r.count) return false;
      await tx.tvOrder.updateMany({ where: { id: order.id, status: "APPROVED" }, data: { status: "AIRED", airedAt: new Date() } });
      return true;
    });
    if (done) return order.clipId;
  } else {
    const ads = await prisma.tvClip.findMany({ where: { channelId: slot.channelId, status: "APPROVED", kind: "AD", sponsorName: null }, select: { id: true }, orderBy: { id: "asc" } });
    if (ads.length) {
      const pickIdx = [...slot.id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % ads.length;
      await prisma.tvSlot.updateMany({ where: { id: slot.id, breakClipId: null }, data: { breakClipId: ads[pickIdx].id } });
    }
  }
  return (await prisma.tvSlot.findUnique({ where: { id: slot.id }, select: { breakClipId: true } }))?.breakClipId ?? null;
}

export function parseQuiz(data: string): QuizQ | null {
  if (!data) return null;
  try {
    const q = JSON.parse(data) as QuizQ;
    return Array.isArray(q.options) && typeof q.correct === "number" ? q : null;
  } catch {
    return null;
  }
}

const seriesInfoSelect = {
  slug: true,
  titleRu: true,
  titleEn: true,
  hue: true,
  posterUrl: true,
  backdropUrl: true,
  orientation: true,
  descriptionRu: true,
  descriptionEn: true,
  aiModels: true,
  genres: true,
  ageRating: true,
  creator: { select: { id: true, name: true } },
} satisfies Prisma.SeriesSelect;
const clipInclude = {
  creator: { select: { id: true, name: true } },
  series: { select: seriesInfoSelect },
} satisfies Prisma.TvClipInclude;
const slotInclude = {
  clip: { include: clipInclude },
  episode: { include: { series: { select: seriesInfoSelect } } },
} satisfies Prisma.TvSlotInclude;
type SeriesInfo = Prisma.SeriesGetPayload<{ select: typeof seriesInfoSelect }>;

const csv = (v: string) => v.split(",").map((x) => x.trim()).filter(Boolean);

function seriesRef(s: SeriesInfo, locale: Locale) {
  const ref = { slug: s.slug, hue: s.hue, posterUrl: mediaUrl(s.posterUrl), backdropUrl: mediaUrl(s.backdropUrl) };
  return { slug: s.slug, title: pick(s, "title", locale), poster: posterUrl(ref) };
}

/** Parses the JSON payload of a NEWS slot (breaking news read by the mascot). */
export function parseNews(data: string): { timeline: TimelineItem[]; audioUrl: string | null } | null {
  try {
    const d = JSON.parse(data) as { timeline?: TimelineItem[]; audioUrl?: string | null };
    return Array.isArray(d.timeline) ? { timeline: d.timeline, audioUrl: d.audioUrl ?? null } : null;
  } catch {
    return null;
  }
}
type SlotRow = Prisma.TvSlotGetPayload<{ include: typeof slotInclude }>;

async function toDTO(s: SlotRow, ch: TvChannel, locale: Locale, userId: string | null, breakClipId?: string | null): Promise<TvSlotDTO> {
  const text = locale === "ru" ? s.textRu || s.textEn : s.textEn || s.textRu;
  const base: TvSlotDTO = {
    id: s.id,
    kind: s.kind as TvSlotDTO["kind"],
    startsAt: s.startsAt.getTime(),
    durationSec: s.durationSec,
    title: "",
    subtitle: "",
    text: "",
    video: null,
    sponsor: null,
    chartPlace: null,
    series: null,
    clipId: null,
    clipKind: null,
    quiz: null,
    likes: 0,
    liked: false,
    info: null,
    captions: null,
    mascot: null,
  };
  const clipId = s.kind === "BREAK" ? breakClipId ?? s.breakClipId : s.clipId;
  const clip = s.kind === "BREAK" ? (clipId ? await prisma.tvClip.findUnique({ where: { id: clipId }, include: clipInclude }) : null) : s.clip;
  if (clip) {
    const [likes, liked] = clip.kind === "MUSIC"
      ? await Promise.all([
          prisma.tvClipLike.count({ where: { clipId: clip.id } }),
          userId ? prisma.tvClipLike.findUnique({ where: { userId_clipId: { userId, clipId: clip.id } } }).then(Boolean) : false,
        ])
      : [0, false];
    return {
      ...base,
      title: clip.title,
      subtitle: clip.artist,
      video: { src: `/api/tv/clip/${clip.id}`, hls: null, orientation: clip.orientation },
      sponsor: clip.sponsorName,
      chartPlace: s.kind === "CLIP" && /^\d+$/.test(s.textEn) ? Number(s.textEn) : null,
      clipId: clip.id,
      clipKind: clip.kind,
      likes,
      liked,
      series: clip.series ? seriesRef(clip.series, locale) : null,
      captions: clip.captions || null,
      info: {
        title: clip.series ? pick(clip.series, "title", locale) : clip.title,
        lore: clip.lore || (clip.series ? pick(clip.series, "description", locale) : ""),
        author: clip.creator ?? clip.series?.creator ?? null,
        aiTools: csv(clip.aiTools || clip.series?.aiModels || ""),
        tags: csv(clip.tags || clip.series?.genres || ""),
        ageRating: clip.ageRating,
      },
    };
  }
  if (s.kind === "EPISODE" && s.episode) {
    const e = s.episode;
    const hls = !!(await readyAssetFor(e.videoUrl));
    const series = seriesRef(e.series, locale);
    return {
      ...base,
      title: series.title,
      subtitle: String(e.number),
      video: { src: hls ? null : `/api/stream/${e.id}`, hls: hls ? `/api/hls/${e.id}` : null, orientation: e.series.orientation },
      series,
      info: {
        title: series.title,
        lore: pick(e.series, "description", locale),
        author: e.series.creator,
        aiTools: csv(e.series.aiModels),
        tags: csv(e.series.genres),
        ageRating: e.series.ageRating,
      },
    };
  }
  if (s.kind === "NEWS") {
    const news = parseNews(s.data);
    return { ...base, title: MASCOT_NAME[locale], text, mascot: news ? { timeline: news.timeline, audioUrl: news.audioUrl } : null };
  }
  if (s.kind === "HOST" || s.kind === "CHART") return { ...base, title: ch.hostName, text };
  if (s.kind === "QUIZ") {
    const q = parseQuiz(s.data);
    if (!q) return { ...base, kind: "HOST", title: ch.hostName, text };
    // Only the question and the options: the right answer is revealed by quizResult() after the slot ends.
    return { ...base, title: ch.hostName, text: q[locale], quiz: { options: q.options.map((o) => o[locale]) } };
  }
  return base; // empty ad break → the client shows the house promo card
}

/** `preview`: the control room's master monitor looks ahead — no ad-break binding, no play counting. */
export async function onAir(ch: TvChannel, locale: Locale, userId: string | null, now = new Date(), opts: { preview?: boolean } = {}): Promise<TvNowDTO> {
  const day = utcDay(now);
  const built = await ensureDay(ch, day);
  // Close to midnight: have tomorrow ready so the programme guide never runs dry.
  if ((now.getTime() - dayStart(day).getTime()) / 1000 > DAY_SEC - 3600) await ensureDay(ch, utcDay(new Date(now.getTime() + 3600_000)));
  if (built) void rewriteHostLines(ch.id, day).catch((e) => console.error("[tv showrunner]", e));

  const [current, next] = await Promise.all([
    prisma.tvSlot.findFirst({ where: { channelId: ch.id, startsAt: { lte: now } }, orderBy: { startsAt: "desc" }, include: slotInclude }),
    prisma.tvSlot.findMany({ where: { channelId: ch.id, startsAt: { gt: now } }, orderBy: { startsAt: "asc" }, take: 14, include: slotInclude }),
  ]);
  const slot = current ?? next[0];
  if (!slot) throw new TvError("NOT_FOUND");
  let breakClip: string | null | undefined;
  if (slot.kind === "BREAK" && !slot.breakClipId && !opts.preview) breakClip = await bindBreak(slot);
  if (slot.clipId && slot.kind === "CLIP" && !opts.preview) void prisma.tvClip.update({ where: { id: slot.clipId }, data: { plays: { increment: 1 } } }).catch(() => {});
  return {
    serverNow: Date.now(),
    channel: channelDTO(ch, locale),
    slot: await toDTO(slot, ch, locale, userId, breakClip),
    next: await Promise.all(next.filter((n) => n.id !== slot.id).map((n) => toDTO(n, ch, locale, userId))),
  };
}

/** Channel grid: what is on every channel right now (no ad-break binding, no play counting). */
export async function nowOnAll(channels: TvChannel[], locale: Locale, now = new Date()) {
  const day = utcDay(now);
  return Promise.all(
    channels.map(async (ch) => {
      const built = await ensureDay(ch, day);
      if (built) void rewriteHostLines(ch.id, day).catch(() => {});
      const s = await prisma.tvSlot.findFirst({ where: { channelId: ch.id, startsAt: { lte: now } }, orderBy: { startsAt: "desc" }, include: slotInclude });
      // A host bumper or a break says little about the channel — show the next programme instead.
      const prog =
        s && (s.kind === "CLIP" || s.kind === "EPISODE")
          ? s
          : await prisma.tvSlot.findFirst({ where: { channelId: ch.id, startsAt: { gt: now }, kind: { in: ["CLIP", "EPISODE"] } }, orderBy: { startsAt: "asc" }, include: slotInclude });
      return { channel: channelDTO(ch, locale), slot: s ? await toDTO(s, ch, locale, null) : null, program: prog ? await toDTO(prog, ch, locale, null) : null };
    }),
  );
}

// ───────────── chat & ticker ─────────────

function requireTalker(user: Viewer): NonNullable<Viewer> {
  if (!user) throw new TvError("AUTH");
  if (user.kidsMode) throw new TvError("KIDS");
  return user;
}

export async function chatFeed(ch: TvChannel, userId: string | null, since = 0, now = new Date()): Promise<TvChatDTO> {
  const [msgs, tickers] = await Promise.all([
    prisma.tvMessage.findMany({
      where: { channelId: ch.id, hidden: false, ...(since ? { createdAt: { gte: new Date(since) } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true, avatarHue: true } } },
    }),
    ch.ticker
      ? prisma.tvTicker.findMany({
          where: { channelId: ch.id, hidden: false, createdAt: { gte: new Date(now.getTime() - TV_TICKER_SHOW_MIN * 60_000) } },
          orderBy: { createdAt: "asc" },
          take: 20,
          include: { user: { select: { name: true } } },
        })
      : [],
  ]);
  return {
    serverNow: Date.now(),
    messages: msgs.reverse().map((m) => ({ id: m.id, at: m.createdAt.getTime(), name: m.user.name, hue: m.user.avatarHue, text: m.text, mine: m.userId === userId, paid: m.paid })),
    tickers: tickers.map((t) => ({ id: t.id, name: t.user.name, text: t.text })),
  };
}

export async function postMessage(user: Viewer, ch: TvChannel, raw: string) {
  const u = requireTalker(user);
  if (ch.familyOnly) throw new TvError("KIDS");
  const problem = chatTextProblem(raw);
  if (problem) throw new TvError(problem);
  const mute = await prisma.user.findUnique({ where: { id: u.id }, select: { tvMutedUntil: true } });
  if (mute?.tvMutedUntil && mute.tvMutedUntil > new Date()) throw new TvError("MUTED");
  if (!rateLimit(`tvchat:${u.id}`, TV_CHAT_PER_MIN, 60_000).allowed) throw new TvError("RATE");
  return prisma.tvMessage.create({ data: { channelId: ch.id, userId: u.id, text: normalizeText(raw) } });
}

/** One report per user per message; hidden automatically after a few. */
export async function reportMessage(user: Viewer, messageId: string) {
  const u = requireTalker(user);
  if (!rateLimit(`tvrep:${u.id}:${messageId}`, 1, 86400_000).allowed) return;
  const m = await prisma.tvMessage.update({ where: { id: messageId }, data: { reports: { increment: 1 } } }).catch(() => null);
  if (m && m.reports >= TV_CHAT_HIDE_AFTER_REPORTS) await prisma.tvMessage.update({ where: { id: m.id }, data: { hidden: true } });
}

/** Paid greeting in the crawling ticker. Money goes to the platform (no creator). */
export async function buyTicker(user: Viewer, ch: TvChannel, raw: string) {
  const u = requireTalker(user);
  if (!ch.ticker) throw new TvError("NO_TICKER");
  const problem = tickerTextProblem(raw);
  if (problem) throw new TvError(problem);
  const text = normalizeText(raw);
  return prisma.$transaction(async (tx) => {
    const charge = await spendCoins(tx, u.id, TV_TICKER_PRICE, "TV_TICKER", { note: `${ch.slug}: ${text}`.slice(0, 120) });
    await tx.tvTicker.create({ data: { channelId: ch.id, userId: u.id, text, coins: TV_TICKER_PRICE } });
    return charge.balance;
  });
}

// ───────────── likes (music chart) ─────────────

export async function toggleLike(user: Viewer, clipId: string) {
  const u = requireTalker(user);
  const clip = await prisma.tvClip.findUnique({ where: { id: clipId }, include: { channel: true } });
  if (!clip || clip.status !== "APPROVED" || clip.kind !== "MUSIC" || !channelVisible(clip.channel, tvViewer(user))) throw new TvError("NOT_FOUND");
  const key = { userId_clipId: { userId: u.id, clipId } };
  const had = await prisma.tvClipLike.findUnique({ where: key });
  if (had) await prisma.tvClipLike.delete({ where: key });
  else await prisma.tvClipLike.create({ data: { userId: u.id, clipId } }).catch(() => {});
  return { liked: !had, likes: await prisma.tvClipLike.count({ where: { clipId } }) };
}

// ───────────── "put something crazy on air" ─────────────

/** Viewer pays, a clip is generated (mock or LTX), a moderator approves, it airs in the next ad break. */
export async function createOrder(user: Viewer, ch: TvChannel, rawIdea: string) {
  const u = requireTalker(user);
  if (ch.familyOnly) throw new TvError("KIDS");
  const problem = ideaProblem(rawIdea);
  if (problem) throw new TvError(problem);
  const idea = normalizeText(rawIdea);
  const open = await prisma.tvOrder.count({ where: { userId: u.id, status: { in: ["GENERATING", "REVIEW", "APPROVED"] } } });
  if (open >= TV_ORDER_MAX_OPEN) throw new TvError("LIMIT");
  const provider = genProvider();
  const seed = Math.floor(Math.random() * 2 ** 31);
  return prisma.$transaction(async (tx) => {
    const charge = await spendCoins(tx, u.id, TV_ORDER_PRICE, "TV_ORDER", { note: `${ch.slug}: ${idea}`.slice(0, 120) });
    const job = await tx.generationJob.create({
      data: { userId: u.id, prompt: idea, style: "cinematic", orientation: "HORIZONTAL", durationSec: 5, seed, cost: 0, provider, status: provider === "mock" ? "QUEUED" : "RUNNING" },
    });
    const order = await tx.tvOrder.create({ data: { userId: u.id, channelId: ch.id, idea, prompt: idea, coins: TV_ORDER_PRICE, jobId: job.id } });
    return { order, job, balance: charge.balance };
  });
}

/** Turns the viewer's idea into a richer video prompt in the channel's style (LLM; idea as is without one). */
export async function expandOrderPrompt(orderId: string) {
  const o = await prisma.tvOrder.findUnique({ where: { id: orderId }, include: { channel: true } });
  if (!o || !o.jobId) return;
  const raw = await complete(
    [
      {
        role: "system",
        content: `You write prompts for a text-to-video model. The clip airs on "${o.channel.nameEn}" (${o.channel.taglineEn}) of an absurd interdimensional TV. Turn the viewer's idea into ONE vivid English prompt (max 60 words): scene, subject, action, camera, style. No text overlays, no real people or brands, nothing sexual, no minors. Answer with the prompt only.`,
      },
      { role: "user", content: o.idea },
    ],
    300,
  );
  const prompt = raw?.replace(/^["'\s]+|["'\s]+$/g, "").slice(0, 900);
  if (!prompt || ideaProblem(prompt.slice(0, 300)) === "banned") return;
  await prisma.$transaction([
    prisma.tvOrder.update({ where: { id: o.id }, data: { prompt } }),
    prisma.generationJob.update({ where: { id: o.jobId }, data: { prompt } }),
  ]);
}

/** A real job still running after this is considered lost (server restart, Space hang). */
const JOB_STALE_MS = 10 * 60_000;

/** Moves generating orders forward: finished clip → REVIEW, failed → FAILED with the coins returned. */
export async function syncOrders(where: Prisma.TvOrderWhereInput = {}, now = Date.now()) {
  const open = await prisma.tvOrder.findMany({ where: { ...where, status: "GENERATING" } });
  for (const o of open) {
    const job = o.jobId ? await prisma.generationJob.findUnique({ where: { id: o.jobId } }) : null;
    if (!job) {
      await failOrder(o.id, "NO_JOB");
      continue;
    }
    if (job.provider === "mock" && job.status !== "DONE" && job.status !== "FAILED") {
      const s = mockState(now - job.createdAt.getTime(), job.durationSec);
      if (s.status === "DONE") {
        await prisma.generationJob.update({ where: { id: job.id }, data: { status: "DONE", resultUrl: mockResult(job.seed, job.orientation), finishedAt: new Date(now) } });
        job.status = "DONE";
      }
    } else if (job.provider !== "mock" && (job.status === "RUNNING" || job.status === "QUEUED") && now - job.createdAt.getTime() > JOB_STALE_MS) {
      await failJob(job.id, "TIMEOUT");
      job.status = "FAILED";
    }
    if (job.status === "DONE") await prisma.tvOrder.updateMany({ where: { id: o.id, status: "GENERATING" }, data: { status: "REVIEW" } });
    else if (job.status === "FAILED") await failOrder(o.id, job.error ?? "FAILED");
  }
}

/** Ends an order without airing it, exactly once, returning the coins (as bonus coins, like rejected cameos). */
async function endOrder(orderId: string, status: "FAILED" | "REJECTED", reason: string, from: string[]) {
  await prisma.$transaction(async (tx) => {
    const o = await tx.tvOrder.findUnique({ where: { id: orderId } });
    if (!o || !from.includes(o.status)) return;
    const r = await tx.tvOrder.updateMany({ where: { id: o.id, status: o.status }, data: { status, rejectReason: reason.slice(0, 300) } });
    if (r.count === 1 && o.coins > 0) await grantCoins(o.userId, o.coins, "REFUND", { note: `tv order ${status.toLowerCase()}` }, tx);
  });
}

function failOrder(orderId: string, reason: string) {
  return endOrder(orderId, "FAILED", reason, ["GENERATING"]);
}

/** Admin: approve (becomes a sponsored clip waiting for the next ad break) or reject (coins back). */
export async function moderateOrder(orderId: string, decision: "approve" | "reject", reason = "") {
  const o = await prisma.tvOrder.findUnique({ where: { id: orderId }, include: { user: { select: { name: true } } } });
  if (!o) throw new TvError("NOT_FOUND");
  if (decision === "reject") {
    if (!["GENERATING", "REVIEW"].includes(o.status)) throw new TvError("STATE");
    return endOrder(o.id, "REJECTED", reason || "rejected", ["GENERATING", "REVIEW"]);
  }
  if (o.status !== "REVIEW") throw new TvError("STATE");
  const job = o.jobId ? await prisma.generationJob.findUnique({ where: { id: o.jobId } }) : null;
  if (!job?.resultUrl) throw new TvError("STATE");
  await prisma.$transaction(async (tx) => {
    const clip = await tx.tvClip.create({
      data: {
        channelId: o.channelId,
        kind: "AD",
        title: o.idea.slice(0, 120),
        videoUrl: job.resultUrl!,
        durationSec: job.durationSec,
        orientation: job.orientation,
        status: "APPROVED",
        sponsorName: o.user.name,
      },
    });
    const r = await tx.tvOrder.updateMany({ where: { id: o.id, status: "REVIEW" }, data: { status: "APPROVED", clipId: clip.id } });
    if (r.count !== 1) throw new TvError("STATE");
  });
}

export function orderDTO(o: { id: string; idea: string; status: string; coins: number; createdAt: Date; airedAt: Date | null; rejectReason: string | null; channel: TvChannel }, locale: Locale): TvOrderDTO {
  return {
    id: o.id,
    channel: pick(o.channel, "name", locale),
    idea: o.idea,
    status: o.status as TvOrderDTO["status"],
    coins: o.coins,
    createdAt: o.createdAt.getTime(),
    airedAt: o.airedAt?.getTime() ?? null,
    rejectReason: o.rejectReason,
  };
}

export async function myOrders(userId: string, locale: Locale) {
  await syncOrders({ userId });
  const rows = await prisma.tvOrder.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 10, include: { channel: true } });
  return rows.map((o) => orderDTO(o, locale));
}

// ───────────── TV clips (creators & admin) ─────────────

export const CLIP_TITLE_MAX = 120;

/**
 * A creator submits a clip to a channel (goes to moderation); an admin's clip is approved at once.
 * `videoRef` is what /api/studio/upload returned.
 */
export async function createClip(
  user: { id: string; role: string; kidsMode: boolean },
  input: {
    channelId: string;
    kind: string;
    title: string;
    artist: string;
    videoRef: string;
    orientation: "VERTICAL" | "HORIZONTAL";
    seriesId?: string | null;
    lore?: string;
    prompts?: string;
    aiTools?: string;
    tags?: string;
    ageRating?: string;
    captions?: string;
  },
  opts: { zone?: string } = {},
) {
  if (user.kidsMode || (user.role !== "CREATOR" && user.role !== "ADMIN")) throw new TvError("AUTH");
  if (!/^storage:videos\/[\w.-]+$/.test(input.videoRef)) throw new TvError("STATE");
  const ch = await prisma.tvChannel.findUnique({ where: { id: input.channelId } });
  if (!ch || !ch.active) throw new TvError("NOT_FOUND");
  const title = normalizeText(input.title).slice(0, CLIP_TITLE_MAX);
  if (title.length < 2) throw new TvError("empty");
  const kind = ["SHOW", "BUMPER", "AD", "MUSIC"].includes(input.kind) ? input.kind : "SHOW";
  const durationSec = Math.max(5, Math.ceil(await fileDuration(input.videoRef)) || 30);
  // A clip may belong to one of the creator's own series (admins: any series).
  let seriesId: string | null = null;
  if (input.seriesId) {
    const s = await prisma.series.findUnique({ where: { id: input.seriesId }, select: { id: true, creatorId: true } });
    if (!s || (user.role !== "ADMIN" && s.creatorId !== user.id)) throw new TvError("NOT_FOUND");
    seriesId = s.id;
  }
  const clean = (v: string | undefined, max: number) => (v ?? "").replace(/\u0000/g, "").trim().slice(0, max);
  const csvClean = (v: string | undefined) =>
    clean(v, 300)
      .split(",")
      .map((x) => normalizeText(x).slice(0, 40))
      .filter(Boolean)
      .slice(0, 8)
      .join(",");
  return prisma.tvClip.create({
    data: {
      channelId: ch.id,
      kind,
      title,
      artist: kind === "MUSIC" ? normalizeText(input.artist).slice(0, 80) : "",
      videoUrl: input.videoRef,
      durationSec,
      orientation: input.orientation,
      status: user.role === "ADMIN" ? "APPROVED" : "PENDING",
      creatorId: user.id,
      seriesId,
      lore: clean(input.lore, 1000),
      prompts: clean(input.prompts, 2000),
      aiTools: csvClean(input.aiTools),
      tags: csvClean(input.tags),
      ageRating: ["0+", "6+", "12+", "16+", "18+"].includes(input.ageRating ?? "") ? input.ageRating! : "12+",
      captions: clean(input.captions, 20_000),
      bountyZone: user.role === "ADMIN" ? "" : opts.zone ?? "",
    },
  });
}

export async function moderateClip(clipId: string, decision: "approve" | "reject") {
  const r = await prisma.tvClip.updateMany({ where: { id: clipId, sponsorName: null }, data: { status: decision === "approve" ? "APPROVED" : "REJECTED" } });
  if (!r.count) throw new TvError("NOT_FOUND");
  if (decision === "approve") {
    await payBounty(clipId);
    // Approved content goes into today's schedule right away.
    const clip = await prisma.tvClip.findUnique({ where: { id: clipId }, select: { channelId: true } });
    if (clip) await rebuildRestOfDay(clip.channelId).catch((e) => console.error("[tv rebuild]", e));
  }
}

/**
 * Bounty for a creator's pool clip, paid once when moderation accepts it: generation credits by the channel's
 * zone at upload time (x1 / x1.25 / x2) and bonus coins for a hot (red) channel. Admin uploads earn nothing.
 */
export async function payBounty(clipId: string, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const clip = await tx.tvClip.findUnique({ where: { id: clipId } });
    if (!clip?.creatorId || !clip.bountyZone) return null;
    const claimed = await tx.tvClip.updateMany({ where: { id: clipId, bountyPaidAt: null }, data: { bountyPaidAt: now } });
    if (!claimed.count) return null;
    const reward = bountyReward(clip.bountyZone);
    if (reward.credits) {
      await tx.user.update({ where: { id: clip.creatorId }, data: { genCredits: { increment: reward.credits } } });
      await tx.creatorEarning.create({ data: { creatorId: clip.creatorId, source: "BOUNTY", credits: reward.credits, seriesId: clip.seriesId } });
    }
    if (reward.coins) await grantCoins(clip.creatorId, reward.coins, "BOUNTY", { note: `bounty:${clip.id}` }, tx);
    return reward;
  });
}

export async function hideTvMessage(id: string) {
  await prisma.tvMessage.updateMany({ where: { id }, data: { hidden: true } });
}

export async function hideTicker(id: string) {
  await prisma.tvTicker.updateMany({ where: { id }, data: { hidden: true } });
}
