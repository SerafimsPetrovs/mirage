import "server-only";
import { Prisma, type CoinReason } from "@prisma/client";
import { prisma } from "./db";
import { decideAccess, episodePrice, splitCharge, splitShare, totalCoins, type AccessUser } from "./access";
import { nextCheckIn, utcDay } from "./rewards";

export class InsufficientCoinsError extends Error {
  constructor(public price: number, public balance: number) {
    super("INSUFFICIENT_COINS");
  }
}

type Tx = Prisma.TransactionClient;

export async function getEpisodeAccess(user: AccessUser, episodeId: string) {
  const ep = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: { series: { select: { freeEpisodes: true, defaultCoinPrice: true, creatorId: true, status: true, isFamilySafe: true, isAdult: true } } },
  });
  if (!ep) return null;
  // Scheduled release: not out yet for anyone but the creator and admins.
  if (ep.publishAt && ep.publishAt > new Date() && !(user && (user.role === "ADMIN" || user.id === ep.series.creatorId))) return null;
  const unlocked = user
    ? !!(await prisma.unlock.findUnique({ where: { userId_episodeId: { userId: user.id, episodeId } } }))
    : false;
  return { episode: ep, access: decideAccess(user, ep, unlocked) };
}

/**
 * Debits `price` coins inside a transaction: bonus coins first, then paid.
 * Conditional update guards against concurrent spends (retries on a lost race).
 * Writes the ledger row. Returns the split and the new total balance.
 */
export async function spendCoins(
  tx: Tx,
  userId: string,
  price: number,
  reason: CoinReason,
  extra: { note?: string; episodeId?: string } = {},
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { paidCoins: true, bonusCoins: true } });
    const split = splitCharge(price, u);
    if (!split) throw new InsufficientCoinsError(price, totalCoins(u));
    const res = await tx.user.updateMany({
      where: { id: userId, paidCoins: { gte: split.paid }, bonusCoins: { gte: split.bonus } },
      data: { paidCoins: { decrement: split.paid }, bonusCoins: { decrement: split.bonus } },
    });
    if (res.count === 0) continue; // balance changed under us, re-read
    await tx.coinTransaction.create({
      data: { userId, amount: -price, paid: -split.paid, bonus: -split.bonus, reason, ...extra },
    });
    return { ...split, balance: totalCoins(u) - price };
  }
  throw new InsufficientCoinsError(price, 0);
}

/**
 * Charges a viewer for creator content and credits the creator's 50% share:
 * withdrawable coins from the paid part, generation credits from the bonus part.
 */
export async function chargeForContent(
  tx: Tx,
  opts: {
    userId: string;
    creatorId: string;
    price: number;
    reason: CoinReason;
    source: string;
    episodeId?: string;
    seriesId?: string;
    note?: string;
  },
) {
  const charge = await spendCoins(tx, opts.userId, opts.price, opts.reason, { note: opts.note, episodeId: opts.episodeId });
  const share = splitShare(charge);
  await tx.creatorEarning.create({
    data: {
      creatorId: opts.creatorId,
      episodeId: opts.episodeId,
      seriesId: opts.seriesId,
      source: opts.source,
      coins: share.coins,
      credits: share.credits,
    },
  });
  if (share.credits > 0 || share.coins > 0) {
    await tx.user.update({
      where: { id: opts.creatorId },
      data: { genCredits: { increment: share.credits }, payoutCoins: { increment: share.coins } },
    });
  }
  return charge;
}

export async function getBalance(userId: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { paidCoins: true, bonusCoins: true } });
  return totalCoins(u);
}

/**
 * Unlocks an episode for coins. Idempotent: an existing unlock is a free no-op.
 * Returns the new balance.
 */
export async function unlockEpisode(userId: string, episodeId: string) {
  return prisma.$transaction(async (tx) => {
    const ep = await tx.episode.findUniqueOrThrow({
      where: { id: episodeId },
      include: { series: { select: { id: true, freeEpisodes: true, defaultCoinPrice: true, creatorId: true } } },
    });
    if (ep.publishAt && ep.publishAt > new Date() && ep.series.creatorId !== userId) throw new Error("NOT_RELEASED");
    const existing = await tx.unlock.findUnique({ where: { userId_episodeId: { userId, episodeId } } });
    if (existing || ep.number <= ep.series.freeEpisodes || ep.series.creatorId === userId) {
      const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { paidCoins: true, bonusCoins: true } });
      return { balance: totalCoins(u), charged: 0 };
    }
    const price = episodePrice(ep);
    try {
      await tx.unlock.create({ data: { userId, episodeId } });
    } catch (e) {
      // Concurrent unlock won the race: abort so nothing is charged twice.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new Error("ALREADY_UNLOCKED");
      throw e;
    }
    const charge = await chargeForContent(tx, {
      userId,
      creatorId: ep.series.creatorId,
      price,
      reason: "UNLOCK",
      source: "UNLOCK",
      episodeId,
      seriesId: ep.series.id,
    });
    return { balance: charge.balance, charged: price };
  });
}

/** Paid coins come only from PURCHASE; everything else free is bonus. */
const PAID_REASONS = new Set<CoinReason>(["PURCHASE"]);

export async function grantCoins(
  userId: string,
  amount: number,
  reason: "PURCHASE" | "CHECKIN" | "BONUS" | "REFUND" | "ADMIN" | "PROMO" | "BOUNTY",
  extra: { note?: string; orderId?: string } = {},
  tx: Tx = prisma,
) {
  const paid = PAID_REASONS.has(reason) ? amount : 0;
  const bonus = amount - paid;
  await tx.user.update({ where: { id: userId }, data: { paidCoins: { increment: paid }, bonusCoins: { increment: bonus } } });
  await tx.coinTransaction.create({ data: { userId, amount, paid, bonus, reason, ...extra } });
}

/**
 * Admin correction of one balance bucket (paid = counts as bought with money, bonus = gift).
 * Negative deltas never take the bucket below zero. Ledger row reason ADMIN.
 */
export async function adminAdjustCoins(userId: string, delta: number, bucket: "paid" | "bonus", note: string) {
  if (!Number.isInteger(delta) || delta === 0) throw new Error("INVALID");
  return prisma.$transaction(async (tx) => {
    const field = bucket === "paid" ? "paidCoins" : "bonusCoins";
    const r = await tx.user.updateMany({
      where: { id: userId, ...(delta < 0 ? { [field]: { gte: -delta } } : {}) },
      data: { [field]: { increment: delta } },
    });
    if (r.count !== 1) throw new Error("INSUFFICIENT");
    await tx.coinTransaction.create({
      data: { userId, amount: delta, paid: bucket === "paid" ? delta : 0, bonus: bucket === "bonus" ? delta : 0, reason: "ADMIN", note: note.slice(0, 200) || "admin" },
    });
  });
}

/** Admin correction downwards: takes bonus first, then paid. */
export async function deductCoins(userId: string, amount: number, note = "admin") {
  return prisma.$transaction((tx) => spendCoins(tx, userId, amount, "ADMIN", { note }));
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
