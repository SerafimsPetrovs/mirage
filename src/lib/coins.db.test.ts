import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./db";
import { InsufficientCoinsError, dailyCheckIn, grantCoins, unlockEpisode, adminAdjustCoins } from "./coins";
import { fulfillOrder } from "./payments";

let viewerId: string;
let creatorId: string;
let freeEp: string;
let paidEp: string;
let paidEp2: string;

async function ledgerMatches(userId: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const sum = await prisma.coinTransaction.aggregate({ where: { userId }, _sum: { amount: true, paid: true, bonus: true } });
  return (
    u.paidCoins === (sum._sum.paid ?? 0) &&
    u.bonusCoins === (sum._sum.bonus ?? 0) &&
    u.paidCoins + u.bonusCoins === (sum._sum.amount ?? 0)
  );
}

const total = (u: { paidCoins: number; bonusCoins: number }) => u.paidCoins + u.bonusCoins;

beforeAll(async () => {
  const creator = await prisma.user.create({ data: { email: `c${Date.now()}@t.t`, name: "C", passwordHash: "x", role: "CREATOR" } });
  const viewer = await prisma.user.create({ data: { email: `v${Date.now()}@t.t`, name: "V", passwordHash: "x" } });
  creatorId = creator.id;
  viewerId = viewer.id;
  const s = await prisma.series.create({
    data: {
      slug: `t-${Date.now()}`,
      titleRu: "T",
      titleEn: "T",
      descriptionRu: "",
      descriptionEn: "",
      status: "PUBLISHED",
      freeEpisodes: 1,
      defaultCoinPrice: 30,
      creatorId,
      episodes: {
        create: [
          { number: 1, videoUrl: "demo:v-teal.mp4" },
          { number: 2, videoUrl: "demo:v-teal.mp4" },
          { number: 3, videoUrl: "demo:v-teal.mp4", coinPrice: 50 },
        ],
      },
    },
    include: { episodes: { orderBy: { number: "asc" } } },
  });
  [freeEp, paidEp, paidEp2] = s.episodes.map((e) => e.id);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("unlockEpisode", () => {
  it("rejects when balance is insufficient and charges nothing", async () => {
    await expect(unlockEpisode(viewerId, paidEp)).rejects.toBeInstanceOf(InsufficientCoinsError);
    expect(total(await prisma.user.findUniqueOrThrow({ where: { id: viewerId } }))).toBe(0);
  });

  it("free episodes cost nothing", async () => {
    expect(await unlockEpisode(viewerId, freeEp)).toEqual({ balance: 0, charged: 0 });
  });

  it("charges once, records ledger, unlock and creator share", async () => {
    await grantCoins(viewerId, 100, "BONUS");
    const res = await unlockEpisode(viewerId, paidEp);
    expect(res).toEqual({ balance: 70, charged: 30 });
    expect(await prisma.unlock.count({ where: { userId: viewerId, episodeId: paidEp } })).toBe(1);
    const earning = await prisma.creatorEarning.findFirstOrThrow({ where: { episodeId: paidEp } });
    // Paid with bonus coins only → the creator's 50% comes as generation credits, not withdrawable coins
    expect(earning.coins).toBe(0);
    expect(earning.credits).toBe(15);
    expect(earning.creatorId).toBe(creatorId);
    expect(await ledgerMatches(viewerId)).toBe(true);
  });

  it("is idempotent for an already unlocked episode", async () => {
    expect(await unlockEpisode(viewerId, paidEp)).toEqual({ balance: 70, charged: 0 });
  });

  it("concurrent double-click charges only once", async () => {
    const results = await Promise.allSettled([unlockEpisode(viewerId, paidEp2), unlockEpisode(viewerId, paidEp2)]);
    expect(results.some((r) => r.status === "fulfilled")).toBe(true);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: viewerId } });
    expect(total(u)).toBe(20); // 70 - 50 (per-episode price)
    expect(await prisma.coinTransaction.count({ where: { userId: viewerId, episodeId: paidEp2 } })).toBe(1);
    expect(await ledgerMatches(viewerId)).toBe(true);
  });

  it("creator watches own content for free", async () => {
    expect((await unlockEpisode(creatorId, paidEp2)).charged).toBe(0);
  });
});

describe("orders", () => {
  it("fulfills a coin order exactly once", async () => {
    const order = await prisma.order.create({ data: { userId: viewerId, kind: "COINS", sku: "coins_300", amountCents: 299, currency: "EUR", provider: "mock" } });
    expect(await fulfillOrder(order.id)).toBe(true);
    expect(await fulfillOrder(order.id)).toBe(false);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: viewerId } });
    expect(total(u)).toBe(20 + 330);
    expect(u.paidCoins).toBe(330); // purchases are paid coins
    expect(await ledgerMatches(viewerId)).toBe(true);
  });

  it("VIP order creates and then extends subscription", async () => {
    const mk = () => prisma.order.create({ data: { userId: viewerId, kind: "VIP", sku: "vip_week", amountCents: 199, currency: "EUR", provider: "mock" } });
    await fulfillOrder((await mk()).id);
    const first = await prisma.subscription.findUniqueOrThrow({ where: { userId: viewerId } });
    await fulfillOrder((await mk()).id);
    const second = await prisma.subscription.findUniqueOrThrow({ where: { userId: viewerId } });
    expect(second.currentPeriodEnd.getTime() - first.currentPeriodEnd.getTime()).toBeCloseTo(7 * 86400_000, -4);
  });
});

describe("dailyCheckIn", () => {
  it("grants once per day", async () => {
    const first = await dailyCheckIn(viewerId);
    expect(first?.streak).toBe(1);
    expect(await dailyCheckIn(viewerId)).toBeNull();
    expect(await ledgerMatches(viewerId)).toBe(true);
  });
});

describe("admin coin adjustments", () => {
  it("adds and removes per bucket, never below zero, with ledger rows", async () => {
    const u = await prisma.user.create({ data: { email: `adm${Date.now()}@t.t`, name: "A", passwordHash: "x" } });
    await adminAdjustCoins(u.id, 100, "paid", "test");
    await adminAdjustCoins(u.id, 30, "bonus", "gift");
    await adminAdjustCoins(u.id, -40, "paid", "fix");
    await expect(adminAdjustCoins(u.id, -31, "bonus", "too much")).rejects.toThrow("INSUFFICIENT");
    const b = await prisma.user.findUniqueOrThrow({ where: { id: u.id }, select: { paidCoins: true, bonusCoins: true } });
    expect(b).toEqual({ paidCoins: 60, bonusCoins: 30 });
    const ledger = await prisma.coinTransaction.findMany({ where: { userId: u.id }, select: { amount: true, paid: true, bonus: true } });
    expect(ledger.reduce((a, x) => a + x.amount, 0)).toBe(90);
    expect(ledger.every((x) => x.amount === x.paid + x.bonus)).toBe(true);
    await prisma.user.delete({ where: { id: u.id } });
  });
});

