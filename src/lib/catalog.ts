import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
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
    views: s.views,
    episodes: s._count.episodes,
    isNew: Date.now() - s.createdAt.getTime() < 10 * 86400_000,
  };
}

const published = { status: "PUBLISHED" } as const;

export async function listSeries(
  locale: Locale,
  opts: {
    where?: Prisma.SeriesWhereInput;
    orderBy?: Prisma.SeriesOrderByWithRelationInput | Prisma.SeriesOrderByWithRelationInput[];
    take?: number;
  } = {},
) {
  const rows = await prisma.series.findMany({
    where: { ...published, ...opts.where },
    orderBy: opts.orderBy ?? { views: "desc" },
    take: opts.take ?? 20,
    select: seriesCardSelect,
  });
  return rows.map((r) => toCard(r, locale));
}

export async function getHomeData(locale: Locale, userId: string | null) {
  const [featured, top, shorts, epics, fresh] = await Promise.all([
    listSeries(locale, { where: { featured: true }, orderBy: { views: "desc" }, take: 6 }),
    listSeries(locale, { orderBy: { views: "desc" }, take: 10 }),
    listSeries(locale, { where: { orientation: "VERTICAL" }, orderBy: { views: "desc" }, take: 16 }),
    listSeries(locale, { where: { orientation: "HORIZONTAL" }, orderBy: { views: "desc" }, take: 12 }),
    listSeries(locale, { orderBy: { publishedAt: "desc" }, take: 12 }),
  ]);
  let continueWatching: ContinueItem[] = [];
  let myList: SeriesCard[] = [];
  if (userId) {
    continueWatching = await getContinueWatching(userId, locale, 12);
    const list = await prisma.listItem.findMany({
      where: { userId, series: published },
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
    where: { userId, series: published },
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
