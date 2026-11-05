import "server-only";
import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma } from "./db";
import { grantCoins } from "./coins";
import { utcDay } from "./rewards";

/** Extra welcome coins for a friend who signs up with an invite link. */
export const REF_BONUS_INVITEE = 50;
/** Coins for the inviter once the friend comes back on another day (anti-bot: a real return visit). */
export const REF_BONUS_INVITER = 50;
/** Rewards per inviter per 30 days. */
export const REF_MONTHLY_CAP = 50;
export const REF_COOKIE = "ref";
export const REF_CODE_RE = /^[A-Z2-9]{6,10}$/;

type Tx = Prisma.TransactionClient;
const ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function getOrCreateRefCode(userId: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { refCode: true } });
  if (u.refCode) return u.refCode;
  for (let i = 0; i < 5; i++) {
    const code = Array.from(randomBytes(7), (b) => ABC[b % ABC.length]).join("");
    try {
      const r = await prisma.user.updateMany({ where: { id: userId, refCode: null }, data: { refCode: code } });
      if (r.count === 1) return code;
      return (await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { refCode: true } })).refCode!;
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
  throw new Error("REF_CODE");
}

/** Links a freshly registered user to the inviter and gives the welcome bonus. No-op for bad / own codes. */
export async function attachReferrer(newUserId: string, rawCode: string | undefined | null) {
  const code = (rawCode ?? "").trim().toUpperCase();
  if (!REF_CODE_RE.test(code)) return false;
  const inviter = await prisma.user.findUnique({ where: { refCode: code }, select: { id: true, banned: true } });
  if (!inviter || inviter.banned || inviter.id === newUserId) return false;
  const linked = await prisma.user.updateMany({ where: { id: newUserId, referredById: null }, data: { referredById: inviter.id } });
  if (linked.count !== 1) return false;
  await grantCoins(newUserId, REF_BONUS_INVITEE, "BONUS", { note: "invite" });
  return true;
}

/**
 * Called when the invited user claims a daily check-in. On their first check-in on a day after sign-up,
 * the inviter gets REF_BONUS_INVITER bonus coins (once per invitee, capped per month).
 */
export async function rewardInviterOnReturn(tx: Tx, userId: string) {
  const u = await tx.user.findUnique({ where: { id: userId }, select: { referredById: true, refRewardedAt: true, createdAt: true } });
  if (!u?.referredById || u.refRewardedAt) return false;
  if (utcDay(u.createdAt) === utcDay()) return false;
  const recent = await tx.user.count({
    where: { referredById: u.referredById, refRewardedAt: { gte: new Date(Date.now() - 30 * 86400_000) } },
  });
  if (recent >= REF_MONTHLY_CAP) return false;
  const marked = await tx.user.updateMany({ where: { id: userId, refRewardedAt: null }, data: { refRewardedAt: new Date() } });
  if (marked.count !== 1) return false;
  await grantCoins(u.referredById, REF_BONUS_INVITER, "BONUS", { note: "referral" }, tx);
  return true;
}

export async function getReferralStats(userId: string) {
  const [code, invited, activated] = await Promise.all([
    getOrCreateRefCode(userId),
    prisma.user.count({ where: { referredById: userId } }),
    prisma.user.count({ where: { referredById: userId, refRewardedAt: { not: null } } }),
  ]);
  return { code, invited, activated, earned: activated * REF_BONUS_INVITER };
}
