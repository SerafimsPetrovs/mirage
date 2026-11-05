import "server-only";
import { prisma } from "./db";
import { getEpisodeAccess } from "./coins";
import { utcDay } from "./rewards";
import type { AccessUser } from "./access";

/**
 * Rewarded ads: watch ADS_PER_EPISODE ads to the end → the paid episode unlocks for free.
 * The ad itself is a house ad (series trailer card) until a real network (Google IMA / AdMob) is plugged in.
 * The server times every view, so skipping the countdown on the client doesn't help.
 */
export const ADS_PER_EPISODE = 2;
export const AD_SECONDS = 15;
/** Episodes a viewer can open with ads per UTC day. */
export const AD_DAILY_EPISODES = 3;
/** A started ad must be finished within this window. */
const AD_MAX_MS = 10 * 60_000;

export class AdError extends Error {
  constructor(public code: "NOT_LOCKED" | "LIMIT" | "NOT_FOUND" | "TOO_EARLY" | "EXPIRED") {
    super(code);
  }
}

const dayStart = () => new Date(`${utcDay()}T00:00:00.000Z`);

async function unlockedToday(userId: string) {
  return prisma.adView.count({ where: { userId, unlocked: true, completedAt: { gte: dayStart() } } });
}

async function watchedFor(userId: string, episodeId: string) {
  return prisma.adView.count({ where: { userId, episodeId, completedAt: { not: null } } });
}

export type AdState = { watched: number; needed: number; seconds: number; leftToday: number };

export async function getAdState(userId: string, episodeId: string): Promise<AdState> {
  const [watched, today] = await Promise.all([watchedFor(userId, episodeId), unlockedToday(userId)]);
  return { watched: Math.min(watched, ADS_PER_EPISODE), needed: ADS_PER_EPISODE, seconds: AD_SECONDS, leftToday: Math.max(0, AD_DAILY_EPISODES - today) };
}

export async function startAd(user: NonNullable<AccessUser>, episodeId: string) {
  const res = await getEpisodeAccess(user, episodeId);
  if (!res || res.access.ok || res.access.reason !== "locked") throw new AdError("NOT_LOCKED");
  if ((await unlockedToday(user.id)) >= AD_DAILY_EPISODES) throw new AdError("LIMIT");
  const ad = await prisma.adView.create({ data: { userId: user.id, episodeId } });
  return { adId: ad.id, seconds: AD_SECONDS };
}

/** Marks an ad as watched (server-timed). The ADS_PER_EPISODE-th view creates a free Unlock. */
export async function completeAd(userId: string, adId: string, now = new Date()) {
  const ad = await prisma.adView.findUnique({ where: { id: adId } });
  if (!ad || ad.userId !== userId || ad.completedAt) throw new AdError("NOT_FOUND");
  const elapsed = now.getTime() - ad.startedAt.getTime();
  if (elapsed < (AD_SECONDS - 1) * 1000) throw new AdError("TOO_EARLY");
  if (elapsed > AD_MAX_MS) throw new AdError("EXPIRED");

  return prisma.$transaction(async (tx) => {
    const marked = await tx.adView.updateMany({ where: { id: adId, completedAt: null }, data: { completedAt: now } });
    if (marked.count !== 1) throw new AdError("NOT_FOUND");
    const watched = await tx.adView.count({ where: { userId, episodeId: ad.episodeId, completedAt: { not: null } } });
    if (watched < ADS_PER_EPISODE) return { unlocked: false, watched };
    const today = await tx.adView.count({ where: { userId, unlocked: true, completedAt: { gte: dayStart() } } });
    if (today >= AD_DAILY_EPISODES) throw new AdError("LIMIT");
    // Already unlocked (e.g. bought meanwhile) — nothing else to do.
    const has = await tx.unlock.findUnique({ where: { userId_episodeId: { userId, episodeId: ad.episodeId } } });
    if (has) return { unlocked: true, watched };
    await tx.unlock.create({ data: { userId, episodeId: ad.episodeId } });
    await tx.adView.update({ where: { id: adId }, data: { unlocked: true } });
    return { unlocked: true, watched };
  });
}
