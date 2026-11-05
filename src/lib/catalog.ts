import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getCurrentUser } from "./auth";
import { isAdultMode } from "./spicy";
import { posterUrl, backdropUrl } from "./poster";
import { mediaUrl } from "./files";
import { pick, type Locale } from "@/i18n/shared";

export const seriesCardSelect = {
  id: true,
  slug: true,
  titleRu: true,
  titleEn: true,
  taglineRu: true,
  taglineEn: true,
  orientation: true,
  posterUrl: true,
  backdropUrl: true,
  hue: true,
  genres: true,
  aiModels: true,
  ageRating: true,
  isAdult: true,
  views: true,
  freeEpisodes: true,
  createdAt: true,
  _count: { select: { episodes: true } },
} satisfies Prisma.SeriesSelect;

type CardRow = Prisma.SeriesGetPayload<{ select: typeof seriesCardSelect }>;

export type SeriesCard = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  orientation: "VERTICAL" | "HORIZONTAL";
  poster: string;
  backdrop: string;
  hue: number;
  genres: string[];
  aiModels: string[];
  ageRating: string;
  isAdult: boolean;
  views: number;
  episodes: number;
  isNew: boolean;
};

export function splitList(s: string) {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

export function toCard(s: CardRow, locale: Locale): SeriesCard {
  const ref = { slug: s.slug, hue: s.hue, posterUrl: mediaUrl(s.posterUrl), backdropUrl: mediaUrl(s.backdropUrl) };
  return {
    id: s.id,
    slug: s.slug,
    title: pick(s, "title", locale),
    tagline: pick(s, "tagline", locale),
    orientation: s.orientation,
    poster: posterUrl(ref),
    backdrop: backdropUrl(ref),
    hue: s.hue,
    genres: splitList(s.genres),
    aiModels: splitList(s.aiModels),
    ageRating: s.ageRating,
    isAdult: s.isAdult,
    views: s.views,
    episodes: s._count.episodes,
    isNew: Date.now() - s.createdAt.getTime() < 10 * 86400_000,
  };
}

/** Series the current viewer may browse: kids → family-safe only; 18+ series only with 18+ content enabled. */
export async function visibleSeries(): Promise<Prisma.SeriesWhereInput> {
  const user = await getCurrentUser();
  if (user?.kidsMode) return { status: "PUBLISHED", isFamilySafe: true };
  return isAdultMode(user) ? { status: "PUBLISHED" } : { status: "PUBLISHED", isAdult: false };
}

export async function listSeries(
  locale: Locale,
  opts: {
    where?: Prisma.SeriesWhereInput;
    orderBy?: Prisma.SeriesOrderByWithRelationInput | Prisma.SeriesOrderByWithRelationInput[];
    take?: number;
  } = {},
) {
  const rows = await prisma.series.findMany({
    where: { ...(await visibleSeries()), ...opts.where },
    orderBy: opts.orderBy ?? { views: "desc" },
    take: opts.take ?? 20,
    select: seriesCardSelect,
  });
  return rows.map((r) => toCard(r, locale));
}

/** Text search over published series (titles, taglines, descriptions, AI models, genres). */
export async function searchSeries(raw: string, locale: Locale, genreLabels: Record<string, string>, take = 48) {
  // SQL LIKE wildcards are stripped: "%" or "_" must not match the whole catalog.
  const q = raw.replace(/[%_\\]/g, " ").trim().replace(/\s+/g, " ").slice(0, 80);
  if (!q) return [];
  // SQLite `contains` is case-sensitive for non-ASCII; search a few case variants.
  const variants = Array.from(new Set([q, q.toLowerCase(), q.charAt(0).toUpperCase() + q.slice(1).toLowerCase()]));
  const fields = ["titleRu", "titleEn", "taglineRu", "taglineEn", "descriptionRu", "descriptionEn", "aiModels", "genres"] as const;
  const genreKeys = Object.entries(genreLabels)
    .filter(([, label]) => label.toLowerCase().includes(q.toLowerCase()))
    .map(([k]) => k);
  return listSeries(locale, {
    where: {
      OR: [
        ...variants.flatMap((v) => fields.map((f) => ({ [f]: { contains: v } }))),
        ...genreKeys.map((g) => ({ genres: { contains: g } })),
      ],
    },
    take,
  });
}

/**
 * Places admin-pinned series at their chart rank (1-based) and fills the remaining slots by views.
 * Pure, exported for tests.
 */
export function mergeChart<T extends { id: string }>(pinned: (T & { rank: number })[], byViews: T[], size = 10): T[] {
  const out: (T | null)[] = Array(size).fill(null);
  const used = new Set<string>();
  for (const p of [...pinned].sort((a, b) => a.rank - b.rank)) {
    let i = Math.min(Math.max(p.rank, 1), size) - 1;
    while (i < size && out[i]) i++;
    if (i < size) {
      out[i] = p;
      used.add(p.id);
    }
  }
  const rest = byViews.filter((s) => !used.has(s.id));
  for (let i = 0; i < size; i++) if (!out[i]) out[i] = rest.shift() ?? null;
  return out.filter((x): x is T => !!x);
}

export async function getTop10(locale: Locale) {
  const [pinnedRows, byViews] = await Promise.all([
    prisma.series.findMany({ where: { ...(await visibleSeries()), chartRank: { not: null } }, orderBy: { chartRank: "asc" }, take: 10, select: { ...seriesCardSelect, chartRank: true } }),
    listSeries(locale, { orderBy: { views: "desc" }, take: 20 }),
  ]);
  const pinned = pinnedRows.map((r) => ({ ...toCard(r, locale), rank: r.chartRank! }));
  return mergeChart(pinned, byViews, 10);
}

export async function getHomeData(locale: Locale, userId: string | null) {
  const [featured, top, shorts, epics, fresh] = await Promise.all([
    listSeries(locale, { where: { featured: true }, orderBy: { views: "desc" }, take: 6 }),
    getTop10(locale),
    listSeries(locale, { where: { orientation: "VERTICAL" }, orderBy: { views: "desc" }, take: 16 }),
    listSeries(locale, { where: { orientation: "HORIZONTAL" }, orderBy: { views: "desc" }, take: 12 }),
    listSeries(locale, { orderBy: { publishedAt: "desc" }, take: 12 }),
  ]);
  let continueWatching: ContinueItem[] = [];
  let myList: SeriesCard[] = [];
  if (userId) {
    continueWatching = await getContinueWatching(userId, locale, 12);
    const list = await prisma.listItem.findMany({
      where: { userId, series: await visibleSeries() },
      orderBy: { createdAt: "desc" },
      take: 16,
      select: { series: { select: seriesCardSelect } },
    });
    myList = list.map((l) => toCard(l.series, locale));
  }
  return { featured, top, shorts, epics, fresh, continueWatching, myList };
}

export type ContinueItem = SeriesCard & { episodeId: string; episodeNumber: number; progress: number };

export async function getContinueWatching(userId: string, locale: Locale, take = 12): Promise<ContinueItem[]> {
  const rows = await prisma.watchProgress.findMany({
    where: { userId, series: await visibleSeries() },
    orderBy: { updatedAt: "desc" },
    take: take * 4,
    include: { episode: { select: { id: true, number: true, durationSec: true } }, series: { select: seriesCardSelect } },
  });
  const seen = new Set<string>();
  const out: ContinueItem[] = [];
  for (const r of rows) {
    if (seen.has(r.seriesId)) continue;
    seen.add(r.seriesId);
    out.push({
      ...toCard(r.series, locale),
      episodeId: r.episode.id,
      episodeNumber: r.episode.number,
      progress: r.completed ? 1 : Math.min(1, r.positionSec / Math.max(14, r.episode.durationSec)),
    });
    if (out.length >= take) break;
  }
  return out;
}

export async function getRatings(seriesIds: string[]) {
  const agg = await prisma.rating.groupBy({ by: ["seriesId"], where: { seriesId: { in: seriesIds } }, _avg: { value: true }, _count: true });
  return new Map(agg.map((a) => [a.seriesId, { avg: a._avg.value ?? 0, count: a._count }]));
}
