import "server-only";
import { prisma } from "./db";
import {
  canMovePayout,
  normalizeDetails,
  OPEN_PAYOUT,
  PAYOUT_CURRENCY,
  PAYOUT_MIN_COINS,
  payoutCents,
  refundsCoins,
  type PayoutMethod,
  type PayoutStatus,
} from "./payout-rules";

export class PayoutError extends Error {
  constructor(public code: "MIN" | "INSUFFICIENT" | "OPEN_EXISTS" | "DETAILS" | "NAME" | "STATE" | "NOT_FOUND" | "UNVERIFIED") {
    super(code);
  }
}

/**
 * Creator asks to withdraw `coins`. Reserves them atomically (conditional decrement),
 * so two parallel requests can never withdraw more than the balance.
 */
export async function requestPayout(userId: string, input: { coins: number; method: PayoutMethod; details: string; holderName: string }) {
  if (!Number.isInteger(input.coins) || input.coins < PAYOUT_MIN_COINS) throw new PayoutError("MIN");
  const details = normalizeDetails(input.method, input.details);
  if (!details) throw new PayoutError("DETAILS");
  const holderName = input.holderName.trim().replace(/\s+/g, " ");
  if (holderName.length < 3 || holderName.length > 100) throw new PayoutError("NAME");
  // money goes out only to accounts with a confirmed email (we must be able to reach the creator)
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true } });
  if (!u?.emailVerifiedAt) throw new PayoutError("UNVERIFIED");

  return prisma.$transaction(async (tx) => {
    const open = await tx.payout.count({ where: { userId, status: { in: OPEN_PAYOUT } } });
    if (open) throw new PayoutError("OPEN_EXISTS");
    const res = await tx.user.updateMany({
      where: { id: userId, payoutCoins: { gte: input.coins } },
      data: { payoutCoins: { decrement: input.coins } },
    });
    if (res.count !== 1) throw new PayoutError("INSUFFICIENT");
    return tx.payout.create({
      data: {
        userId,
        coins: input.coins,
        amountCents: payoutCents(input.coins),
        currency: PAYOUT_CURRENCY,
        method: input.method,
        details,
        holderName,
      },
    });
  });
}

/**
 * Moves a payout to `to` exactly once (conditional on the current status).
 * REJECTED / CANCELED return the reserved coins.
 */
export async function movePayout(payoutId: string, to: PayoutStatus, opts: { byUserId?: string; note?: string } = {}) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.payout.findUnique({ where: { id: payoutId } });
    if (!p || (opts.byUserId && p.userId !== opts.byUserId)) throw new PayoutError("NOT_FOUND");
    if (!canMovePayout(p.status, to)) throw new PayoutError("STATE");
    const res = await tx.payout.updateMany({
      where: { id: payoutId, status: p.status },
      data: {
        status: to,
        adminNote: opts.note?.trim().slice(0, 300) || undefined,
        processedAt: to === "APPROVED" ? undefined : new Date(),
      },
    });
    if (res.count !== 1) throw new PayoutError("STATE");
    if (refundsCoins(to)) await tx.user.update({ where: { id: p.userId }, data: { payoutCoins: { increment: p.coins } } });
    return { ...p, status: to };
  });
}

export async function getPayoutOverview(userId: string) {
  const [user, payouts, earned, paid] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { payoutCoins: true } }),
    prisma.payout.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.creatorEarning.aggregate({ where: { creatorId: userId }, _sum: { coins: true } }),
    prisma.payout.aggregate({ where: { userId, status: "PAID" }, _sum: { amountCents: true } }),
  ]);
  return {
    available: user.payoutCoins,
    earnedCoins: earned._sum.coins ?? 0,
    paidCents: paid._sum.amountCents ?? 0,
    open: payouts.find((p) => OPEN_PAYOUT.includes(p.status as PayoutStatus)) ?? null,
    payouts,
  };
}
