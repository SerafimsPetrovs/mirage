import "server-only";
import { prisma } from "./db";
import { listSeries, visibleSeries, type SeriesCard } from "./catalog";
import type { Locale } from "@/i18n/shared";
import { scoreRecommendations, type Signal } from "./recommend-rules";

/**
 * "Because you watched …": genre taste from the viewer's history (episodes watched, likes, list, ratings),
 * applied to series they haven't started. Null when there's not enough history or nothing to suggest.
 */
export async function getRecommendations(userId: string, locale: Locale, take = 12): Promise<{ anchor: string | null; items: SeriesCard[] } | null> {
  const [progress, likes, list, ratings] = await Promise.all([
    prisma.watchProgress.findMany({ where: { userId }, select: { seriesId: true, completed: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 400 }),
    prisma.like.findMany({ where: { userId }, select: { episode: { select: { seriesId: true } } }, take: 400 }),
    prisma.listItem.findMany({ where: { userId }, select: { seriesId: true } }),
    prisma.rating.findMany({ where: { userId }, select: { seriesId: true, value: true } }),
  ]);
  if (!progress.length && !list.length && !ratings.length) return null;

  const signals = new Map<string, Signal>();
  const sig = (id: string) => signals.get(id) ?? signals.set(id, { seriesId: id, episodes: 0, completed: 0, likes: 0, inList: false, rating: null, lastAt: 0 }).get(id)!;
  for (const p of progress) {
    const s = sig(p.seriesId);
    s.episodes++;
    if (p.completed) s.completed++;
    s.lastAt = Math.max(s.lastAt, p.updatedAt.getTime());
  }
  for (const l of likes) sig(l.episode.seriesId).likes++;
  for (const l of list) sig(l.seriesId).inList = true;
  for (const r of ratings) sig(r.seriesId).rating = r.value;

  // only series visible in the current mode shape the taste and the heading
  // (kids mode must never show "Because you watched <grown-up title>")
  const known = await prisma.series.findMany({ where: { id: { in: [...signals.keys()] }, ...(await visibleSeries()) }, select: { id: true, genres: true, titleRu: true, titleEn: true } });
  const genresOf = new Map(known.map((k) => [k.id, k.genres.split(",").map((g) => g.trim()).filter(Boolean)]));
  // candidates: what the viewer may see (kids / 18+ rules apply inside listSeries), minus what they started
  const pool = await listSeries(locale, { orderBy: { views: "desc" }, take: 80 });
  const started = new Set(progress.map((p) => p.seriesId));
  const { items, anchorId } = scoreRecommendations([...signals.values()].filter((s) => genresOf.has(s.seriesId)), genresOf, pool.filter((c) => !started.has(c.id)), take);
  if (items.length < 3) return null;
  const anchor = known.find((k) => k.id === anchorId);
  return { anchor: anchor ? (locale === "ru" ? anchor.titleRu || anchor.titleEn : anchor.titleEn || anchor.titleRu) : null, items };
}
