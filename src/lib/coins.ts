import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { CREATOR_SHARE, decideAccess, episodePrice, type AccessUser } from "./access";
import { nextCheckIn, utcDay } from "./rewards";

export class InsufficientCoinsError extends Error {
  constructor(public price: number, public balance: number) {
    super("INSUFFICIENT_COINS");
  }
}

export async function getEpisodeAccess(user: AccessUser, episodeId: string) {
  const ep = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: { series: { select: { freeEpisodes: true, defaultCoinPrice: true, creatorId: true, status: true } } },
  });
  if (!ep) return null;
  const unlocked = user
    ? !!(await prisma.unlock.findUnique({ where: { userId_episodeId: { userId: user.id, episodeId } } }))
    : false;
  return { episode: ep, access: decideAccess(user, ep, unlocked) };
}

/**
 * Unlocks an episode for coins. Idempotent: an existing unlock is a free no-op.
 * Returns the new balance.
 */
export async function unlockEpisode(userId: string, episodeId: string) {
  return prisma.$transaction(async (tx) => {
    const ep = await tx.episode.findUniqueOrThrow({
      where: { id: episodeId },
      include: { series: { select: { freeEpisodes: true, defaultCoinPrice: true, creatorId: true } } },
    });
    const existing = await tx.unlock.findUnique({ where: { userId_episodeId: { userId, episodeId } } });
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { coins: true } });
    if (existing || ep.number <= ep.series.freeEpisodes || ep.series.creatorId === userId) {
      return { balance: user.coins, charged: 0 };
    }
    const price = episodePrice(ep);
    const res = await tx.user.updateMany({
      where: { id: userId, coins: { gte: price } },
      data: { coins: { decrement: price } },
    });
    if (res.count === 0) throw new InsufficientCoinsError(price, user.coins);
    await tx.coinTransaction.create({ data: { userId, amount: -price, reason: "UNLOCK", episodeId } });
    try {
      await tx.unlock.create({ data: { userId, episodeId } });
    } catch (e) {
      // Concurrent unlock won the race: roll back this charge by aborting the transaction.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new Error("ALREADY_UNLOCKED");
      throw e;
    }
    await tx.creatorEarning.create({
      data: { creatorId: ep.series.creatorId, episodeId, coins: Math.floor(price * CREATOR_SHARE) },
    });
    return { balance: user.coins - price, charged: price };
  });
}

export async function grantCoins(
  userId: string,
  amount: number,
  reason: "PURCHASE" | "CHECKIN" | "BONUS" | "REFUND" | "ADMIN",
  extra: { note?: string; orderId?: string } = {},
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.user.update({ where: { id: userId }, data: { coins: { increment: amount } } });
  await tx.coinTransaction.create({ data: { userId, amount, reason, ...extra } });
}

export async function dailyCheckIn(userId: string) {
  const today = utcDay();
  return prisma.$transaction(async (tx) => {
    const last = await tx.checkIn.findFirst({ where: { userId }, orderBy: { day: "desc" } });
    const next = nextCheckIn(last, today);
    if (!next) return null;
    await tx.checkIn.create({ data: { userId, day: today, ...next } });
    await grantCoins(userId, next.reward, "CHECKIN", { note: `day ${next.streak}` }, tx);
    return next;
  });
}

export async function getCheckInState(userId: string) {
  const today = utcDay();
  const last = await prisma.checkIn.findFirst({ where: { userId }, orderBy: { day: "desc" } });
  const doneToday = last?.day === today;
  const preview = doneToday ? null : nextCheckIn(last, today);
  const streak = doneToday ? last!.streak : (preview?.streak ?? 1) - 1;
  return { doneToday, streak, nextReward: preview?.reward ?? null };
}
