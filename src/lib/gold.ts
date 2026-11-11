import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { utcDay } from "./rewards";
import { episodePrice } from "./access";
import { GOLD_EARN, goldPrice, type GoldEarnReason } from "./gold-rules";

type Tx = Prisma.TransactionClient;

export class InsufficientGoldError extends Error {
  constructor(public price: number, public balance: number) {
    super("INSUFFICIENT_GOLD");
  }
}

/**
 * Gives the gold for a free action if today's limit isn't reached yet. `refId` makes one reward per
 * thing (one episode watched, one poll voted) — repeating the same action never pays twice.
 * Returns the amount granted (0 when the limit is reached or the thing was already rewarded).
 */
export async function earnGold(userId: string, reason: GoldEarnReason, refId?: string, tx?: Tx): Promise<number> {
  const rule = GOLD_EARN[reason];
  const day = utcDay();
  const run = async (t: Tx) => {
    if (refId && (await t.goldTransaction.findFirst({ where: { userId, reason, refId } }))) return 0;
    const today = await t.goldTransaction.count({ where: { userId, reason, day } });
    if (today >= rule.perDay) return 0;
    if (reason === "WELCOME" && (await t.goldTransaction.findFirst({ where: { userId, reason } }))) return 0;
    await t.goldTransaction.create({ data: { userId, amount: rule.amount, reason, refId, day } });
    await t.user.update({ where: { id: userId }, data: { gold: { increment: rule.amount } } });
    return rule.amount;
  };
  return tx ? run(tx) : prisma.$transaction(run);
}

/** Atomic conditional decrement + ledger row. Throws InsufficientGoldError. */
export async function spendGold(tx: Tx, userId: string, amount: number, reason: "BET" | "UNLOCK" | "BUDDY", refId?: string) {
  const r = await tx.user.updateMany({ where: { id: userId, gold: { gte: amount } }, data: { gold: { decrement: amount } } });
  if (r.count === 0) {
    const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { gold: true } });
    throw new InsufficientGoldError(amount, u.gold);
  }
  await tx.goldTransaction.create({ data: { userId, amount: -amount, reason, refId, day: utcDay() } });
  const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { gold: true } });
  return u.gold;
}

/** Credits gold won or refunded (no daily limit). */
export async function creditGold(tx: Tx, userId: string, amount: number, reason: "WIN" | "REFUND" | "ADMIN" | "ACHIEVEMENT", refId?: string) {
  if (amount <= 0) return;
  await tx.goldTransaction.create({ data: { userId, amount, reason, refId, day: utcDay() } });
  await tx.user.update({ where: { id: userId }, data: { gold: { increment: amount } } });
}

/**
 * Opens a paid episode for gold. The creator gets generation credits (gold is free currency,
 * so it never becomes withdrawable money). Already open → nothing is charged.
 */
export async function unlockEpisodeWithGold(userId: string, episodeId: string) {
  return prisma.$transaction(async (tx) => {
    const ep = await tx.episode.findUniqueOrThrow({
      where: { id: episodeId },
      include: { series: { select: { id: true, freeEpisodes: true, defaultCoinPrice: true, creatorId: true } } },
    });
    const existing = await tx.unlock.findUnique({ where: { userId_episodeId: { userId, episodeId } } });
    if (existing || ep.number <= ep.series.freeEpisodes || ep.series.creatorId === userId) {
      const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { gold: true } });
      return { gold: u.gold, charged: 0 };
    }
    const price = goldPrice(episodePrice(ep));
    try {
      await tx.unlock.create({ data: { userId, episodeId } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new Error("ALREADY_UNLOCKED");
      throw e;
    }
    const gold = await spendGold(tx, userId, price, "UNLOCK", episodeId);
    await tx.creatorEarning.create({ data: { creatorId: ep.series.creatorId, episodeId, seriesId: ep.series.id, source: "GOLD", coins: 0, credits: price } });
    await tx.user.update({ where: { id: ep.series.creatorId }, data: { genCredits: { increment: price } } });
    return { gold, charged: price };
  });
}

/** Wallet: balance, today's progress per earning action, recent ledger. */
export async function getGoldState(userId: string) {
  const day = utcDay();
  const [u, today, recent] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { gold: true } }),
    prisma.goldTransaction.groupBy({ by: ["reason"], where: { userId, day, amount: { gt: 0 } }, _count: { _all: true } }),
    prisma.goldTransaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  const done = new Map(today.map((r) => [r.reason, r._count._all]));
  const tasks = (["CHECKIN", "WATCH", "VOTE", "RATE", "TV_WATCH", "TV_QUIZ", "TV_VOTE", "TV_GAME"] as const).map((reason) => ({
    reason,
    amount: GOLD_EARN[reason].amount,
    perDay: GOLD_EARN[reason].perDay,
    done: Math.min(done.get(reason) ?? 0, GOLD_EARN[reason].perDay),
  }));
  return {
    gold: u.gold,
    tasks,
    recent: recent.map((r) => ({ id: r.id, amount: r.amount, reason: r.reason, createdAt: r.createdAt.toISOString() })),
  };
}
