import "server-only";
import { prisma } from "./db";
import { decideAccess } from "./access";
import { getKidsMode, type CurrentUser } from "./auth";
import { adultSeriesBlock } from "./spicy";
import { seriesCardSelect, toCard, splitList, visibleSeries } from "./catalog";
import { posterUrl, backdropUrl } from "./poster";
import { mediaUrl } from "./files";
import { pick, type Locale } from "@/i18n/shared";

export type EpisodeItem = {
  id: string;
  number: number;
  title: string;
  durationSec: number;
  thumbnail: string | null;
  locked: boolean;
  free: boolean;
  price: number;
  progress: number;
};

/** Loads a series with per-user episode access. Non-published series only visible to owner/admin. */
export async function getSeriesPage(slug: string, user: CurrentUser | null, locale: Locale) {
  const s = await prisma.series.findUnique({
    where: { slug },
    include: {
      creator: { select: { id: true, name: true, avatarHue: true, bio: true } },
      episodes: { orderBy: { number: "asc" } },
      _count: { select: { listItems: true } },
    },
  });
  if (!s) return null;
  const owner = !!user && (user.role === "ADMIN" || user.id === s.creatorId);
  if (s.status !== "PUBLISHED" && !owner) return null;
  const kids = await getKidsMode();
  if (kids && (!s.isFamilySafe || s.status !== "PUBLISHED")) return null;

  const [unlocks, progress, inList, myRating, ratingAgg] = await Promise.all([
    user ? prisma.unlock.findMany({ where: { userId: user.id, episode: { seriesId: s.id } }, select: { episodeId: true } }) : [],
    user ? prisma.watchProgress.findMany({ where: { userId: user.id, seriesId: s.id }, orderBy: { updatedAt: "desc" } }) : [],
    user ? prisma.listItem.findUnique({ where: { userId_seriesId: { userId: user.id, seriesId: s.id } } }) : null,
    user ? prisma.rating.findUnique({ where: { userId_seriesId: { userId: user.id, seriesId: s.id } } }) : null,
    prisma.rating.aggregate({ where: { seriesId: s.id }, _avg: { value: true }, _count: true }),
  ]);
  const unlocked = new Set(unlocks.map((u) => u.episodeId));
  const progressMap = new Map(progress.map((p) => [p.episodeId, p]));

  const episodes: EpisodeItem[] = s.episodes.map((e) => {
    const access = decideAccess(user, { ...e, series: s }, unlocked.has(e.id));
    const p = progressMap.get(e.id);
    return {
      id: e.id,
      number: e.number,
      title: pick(e, "title", locale),
      durationSec: e.durationSec,
      thumbnail: mediaUrl(e.thumbnailUrl),
      locked: !access.ok,
      free: e.number <= s.freeEpisodes,
      price: e.coinPrice ?? s.defaultCoinPrice,
      progress: p ? (p.completed ? 1 : Math.min(1, p.positionSec / Math.max(14, e.durationSec))) : 0,
    };
  });

  // Continue: latest progressed episode, or the next one if it was completed
  let resume = episodes[0];
  if (progress[0]) {
    const idx = episodes.findIndex((e) => e.id === progress[0].episodeId);
    if (idx >= 0) resume = progress[0].completed && episodes[idx + 1] ? episodes[idx + 1] : episodes[idx];
  }

  const ref = { slug: s.slug, hue: s.hue, posterUrl: mediaUrl(s.posterUrl), backdropUrl: mediaUrl(s.backdropUrl) };
  return {
    id: s.id,
    slug: s.slug,
    status: s.status,
    title: pick(s, "title", locale),
    tagline: pick(s, "tagline", locale),
    description: pick(s, "description", locale),
    promptNotes: pick(s, "promptNotes", locale),
    orientation: s.orientation,
    poster: posterUrl(ref),
    backdrop: backdropUrl(ref),
    hue: s.hue,
    genres: splitList(s.genres),
    moods: splitList(s.moods),
    aiModels: splitList(s.aiModels),
    ageRating: s.ageRating,
    views: s.views,
    freeEpisodes: s.freeEpisodes,
    creator: s.creator,
    inListCount: s._count.listItems,
    episodes,
    resume,
    hasProgress: progress.length > 0,
    inList: !!inList,
    myRating: myRating?.value ?? 0,
    rating: { avg: ratingAgg._avg.value ?? 0, count: ratingAgg._count },
    owner,
    isFamilySafe: s.isFamilySafe,
    isAdult: s.isAdult,
    /** Why an 18+ series is closed for this viewer (owners always pass). */
    adultBlock: owner ? null : adultSeriesBlock(user, s),
    creatorId: s.creatorId,
    kids,
  };
}

export async function getSimilar(seriesId: string, genres: string[], locale: Locale) {
  const rows = await prisma.series.findMany({
    where: { ...(await visibleSeries()), id: { not: seriesId }, OR: genres.map((g) => ({ genres: { contains: g } })) },
    orderBy: { views: "desc" },
    take: 12,
    select: seriesCardSelect,
  });
  return rows.map((r) => toCard(r, locale));
}

export async function getActivePoll(seriesId: string, userId: string | null, locale: Locale) {
  const poll = await prisma.poll.findFirst({
    where: { seriesId },
    orderBy: { createdAt: "desc" },
    include: { options: { include: { _count: { select: { votes: true } } } } },
  });
  if (!poll) return null;
  const [mine, boosts, myBoost] = await Promise.all([
    userId ? prisma.pollVote.findUnique({ where: { userId_pollId: { userId, pollId: poll.id } } }) : null,
    prisma.pollBoost.groupBy({ by: ["optionId"], where: { pollId: poll.id }, _sum: { votes: true } }),
    userId ? prisma.pollBoost.aggregate({ where: { pollId: poll.id, userId }, _sum: { votes: true } }) : null,
  ]);
  const boostMap = new Map(boosts.map((b) => [b.optionId, b._sum.votes ?? 0]));
  return {
    id: poll.id,
    question: pick(poll, "question", locale),
    closesAt: poll.closesAt.toISOString(),
    closed: poll.closesAt < new Date(),
    myOptionId: mine?.optionId ?? null,
    myBoost: myBoost?._sum.votes ?? 0,
    options: poll.options.map((o) => ({ id: o.id, label: pick(o, "label", locale), votes: o._count.votes + (boostMap.get(o.id) ?? 0) })),
  };
}
