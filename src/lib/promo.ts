import "server-only";
import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma } from "./db";
import { grantCoins } from "./coins";
import { extendVip } from "./payments";

export const PROMO_KINDS = ["COINS", "VIP_DAYS", "DISCOUNT"] as const;
/** DISCOUNT codes: percent off the next coin pack. */
export const DISCOUNT_MIN = 5;
export const DISCOUNT_MAX = 90;
export type PromoKind = (typeof PROMO_KINDS)[number];
export const PROMO_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

export class PromoError extends Error {
  constructor(public code: "NOT_FOUND" | "EXPIRED" | "EXHAUSTED" | "ALREADY" | "NEW_ONLY") {
    super(code);
  }
}

export function normalizeCode(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/** Readable random code without look-alike characters (0/O, 1/I). */
export function generateCode(prefix = "") {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  const body = Array.from(bytes, (b) => abc[b % abc.length]).join("");
  return (prefix ? `${prefix}-` : "") + body;
}

/**
 * Redeems a promo code once per user. The usage counter is bumped with a conditional update
 * (never exceeds maxUses under concurrency) and the (promo, user) primary key blocks double use.
 */
export async function redeemPromo(userId: string, raw: string) {
  const code = normalizeCode(raw);
  if (!PROMO_CODE_RE.test(code)) throw new PromoError("NOT_FOUND");
  try {
    return await prisma.$transaction(async (tx) => {
      const promo = await tx.promoCode.findUnique({ where: { code } });
      if (!promo || !promo.active) throw new PromoError("NOT_FOUND");
      if (promo.expiresAt && promo.expiresAt < new Date()) throw new PromoError("EXPIRED");
      // One unused discount at a time: a second one would silently replace the first.
      if (promo.kind === "DISCOUNT" && (await pendingDiscountTx(tx, userId))) throw new PromoError("ALREADY");
      if (promo.newUsersOnly) {
        const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { createdAt: true } });
        if (u.createdAt < promo.createdAt) throw new PromoError("NEW_ONLY");
      }
      await tx.promoRedemption.create({ data: { promoId: promo.id, userId } });
      const bumped = await tx.promoCode.updateMany({
        where: { id: promo.id, ...(promo.maxUses !== null ? { usesCount: { lt: promo.maxUses } } : {}) },
        data: { usesCount: { increment: 1 } },
      });
      if (bumped.count !== 1) throw new PromoError("EXHAUSTED");
      if (promo.kind === "DISCOUNT") return { kind: "DISCOUNT" as const, value: promo.value };
      if (promo.kind === "COINS") {
        await grantCoins(userId, promo.value, "PROMO", { note: code }, tx);
        return { kind: "COINS" as const, value: promo.value };
      }
      const until = await extendVip(tx, userId, promo.value, `promo:${code}`);
      return { kind: "VIP_DAYS" as const, value: promo.value, until };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new PromoError("ALREADY");
    throw e;
  }
}

/** Read-only check before sign-up, so a typo doesn't silently lose the bonus. Null when the code can be used. */
export async function promoProblem(raw: string): Promise<PromoError["code"] | null> {
  const code = normalizeCode(raw);
  if (!PROMO_CODE_RE.test(code)) return "NOT_FOUND";
  const p = await prisma.promoCode.findUnique({ where: { code } });
  if (!p || !p.active) return "NOT_FOUND";
  if (p.expiresAt && p.expiresAt < new Date()) return "EXPIRED";
  if (p.maxUses !== null && p.usesCount >= p.maxUses) return "EXHAUSTED";
  return null;
}

export async function createPromo(input: {
  code?: string;
  kind: PromoKind;
  value: number;
  maxUses: number | null;
  expiresAt: Date | null;
  newUsersOnly: boolean;
  note?: string;
}) {
  const code = input.code ? normalizeCode(input.code) : generateCode();
  if (!PROMO_CODE_RE.test(code)) throw new Error("BAD_CODE");
  try {
    return await prisma.promoCode.create({
      data: { code, kind: input.kind, value: input.value, maxUses: input.maxUses, expiresAt: input.expiresAt, newUsersOnly: input.newUsersOnly, note: input.note || null },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new Error("DUPLICATE");
    throw e;
  }
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function pendingDiscountTx(tx: Tx, userId: string) {
  const rows = await tx.promoRedemption.findMany({
    where: { userId, promo: { kind: "DISCOUNT" } },
    include: { promo: { select: { code: true, value: true } } },
    orderBy: { createdAt: "asc" },
  });
  const linked = rows.map((r) => r.orderId).filter((x): x is string => !!x);
  const paid = new Set(
    linked.length ? (await tx.order.findMany({ where: { id: { in: linked }, status: "PAID" }, select: { id: true } })).map((o) => o.id) : [],
  );
  const r = rows.find((x) => !x.orderId || !paid.has(x.orderId));
  return r ? { promoId: r.promoId, code: r.promo.code, pct: r.promo.value } : null;
}

/**
 * The redeemed discount that has not been spent on a paid order yet (an unpaid / abandoned order does not burn it).
 * Shown on the wallet before paying and applied by createOrder to the next coin pack.
 */
export function pendingDiscount(userId: string, tx: Tx = prisma as unknown as Tx) {
  return pendingDiscountTx(tx, userId);
}

/** Discounted price in cents (rounded, never below 1 cent). */
export function discountedCents(cents: number, pct: number) {
  return Math.max(1, Math.round((cents * (100 - pct)) / 100));
}
