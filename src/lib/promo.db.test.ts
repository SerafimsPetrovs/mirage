import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./db";
import { createPromo, PromoError, redeemPromo } from "./promo";

const tag = Date.now().toString(36).toUpperCase();
const ids: string[] = [];
let seq = 0;
const user = async () => {
  const u = await prisma.user.create({ data: { email: `pr${tag}${seq++}@t.t`, name: "U", passwordHash: "x" } });
  ids.push(u.id);
  return u.id;
};
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof PromoError ? e.code : String(e);
  }
};
let early: string;

beforeAll(async () => {
  early = await user();
});

afterAll(async () => {
  await prisma.promoCode.deleteMany({ where: { code: { contains: tag } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

describe("promo codes", () => {
  it("grants bonus coins once per user, case-insensitive", async () => {
    await createPromo({ code: `C-${tag}`, kind: "COINS", value: 70, maxUses: null, expiresAt: null, newUsersOnly: false });
    const u = await user();
    await redeemPromo(u, ` c-${tag.toLowerCase()} `);
    const b = await prisma.user.findUniqueOrThrow({ where: { id: u }, select: { bonusCoins: true, paidCoins: true } });
    expect(b).toEqual({ bonusCoins: 70, paidCoins: 0 });
    expect(await code(redeemPromo(u, `C-${tag}`))).toBe("ALREADY");
    expect(await prisma.coinTransaction.count({ where: { userId: u, reason: "PROMO" } })).toBe(1);
  });

  it("extends VIP by the code's days", async () => {
    await createPromo({ code: `V-${tag}`, kind: "VIP_DAYS", value: 7, maxUses: null, expiresAt: null, newUsersOnly: false });
    const u = await user();
    const r = await redeemPromo(u, `V-${tag}`);
    expect(r.kind).toBe("VIP_DAYS");
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { userId: u } });
    expect(sub.currentPeriodEnd.getTime() - Date.now()).toBeGreaterThan(6.9 * 86400_000);
  });

  it("respects the usage limit even under parallel redemptions", async () => {
    await createPromo({ code: `L-${tag}`, kind: "COINS", value: 5, maxUses: 2, expiresAt: null, newUsersOnly: false });
    const users = await Promise.all([user(), user(), user(), user()]);
    const res = await Promise.all(users.map((u) => code(redeemPromo(u, `L-${tag}`))));
    expect(res.filter((r) => r === "ok")).toHaveLength(2);
    expect(res.filter((r) => r === "EXHAUSTED")).toHaveLength(2);
    expect((await prisma.promoCode.findUniqueOrThrow({ where: { code: `L-${tag}` } })).usesCount).toBe(2);
  });

  it("rejects unknown, disabled, expired and new-users-only codes", async () => {
    const u = await user();
    expect(await code(redeemPromo(u, "NOPE-NOPE"))).toBe("NOT_FOUND");
    const off = await createPromo({ code: `D-${tag}`, kind: "COINS", value: 5, maxUses: null, expiresAt: null, newUsersOnly: false });
    await prisma.promoCode.update({ where: { id: off.id }, data: { active: false } });
    expect(await code(redeemPromo(u, `D-${tag}`))).toBe("NOT_FOUND");
    await createPromo({ code: `E-${tag}`, kind: "COINS", value: 5, maxUses: null, expiresAt: new Date(Date.now() - 1000), newUsersOnly: false });
    expect(await code(redeemPromo(u, `E-${tag}`))).toBe("EXPIRED");
    await createPromo({ code: `N-${tag}`, kind: "COINS", value: 5, maxUses: null, expiresAt: null, newUsersOnly: true });
    expect(await code(redeemPromo(early, `N-${tag}`))).toBe("NEW_ONLY");
    expect(await code(redeemPromo(await user(), `N-${tag}`))).toBe("ok");
  });
});
