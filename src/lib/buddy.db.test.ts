import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./db";
import { grantCoins } from "./coins";
import { buyBuddyItem, getBuddyState, lookOf, saveBuddyLook } from "./buddy";

const tag = Date.now().toString(36);
let uid: string;
const wallet = () => prisma.user.findUniqueOrThrow({ where: { id: uid }, select: { paidCoins: true, bonusCoins: true, gold: true } });

beforeAll(async () => {
  const u = await prisma.user.create({ data: { email: `bd${tag}@t.t`, name: "B", passwordHash: "x", gold: 40 } });
  uid = u.id;
  await grantCoins(uid, 120, "BONUS");
});

describe("watch buddy store", () => {
  it("starts with the free buddy and nothing worn", async () => {
    const s = await getBuddyState(uid);
    expect(s.look).toEqual({ buddy: "blip", outfit: {} });
    expect(s.owned).toEqual([]);
  });

  it("buys with gold, writes the ledger, and never charges twice (double click)", async () => {
    const [a, b] = await Promise.all([buyBuddyItem(uid, "cap"), buyBuddyItem(uid, "cap")]);
    expect([a, b].filter((r) => r.ok && r.charged === 25)).toHaveLength(1);
    expect((await wallet()).gold).toBe(15);
    expect(await prisma.goldTransaction.count({ where: { userId: uid, reason: "BUDDY" } })).toBe(1);
  });

  it("buys with coins (price from the catalog) and refuses when short", async () => {
    expect(await buyBuddyItem(uid, "popcorn")).toEqual({ ok: true, charged: 99 });
    const w = await wallet();
    expect(w.paidCoins + w.bonusCoins).toBe(21);
    expect(await prisma.coinTransaction.count({ where: { userId: uid, reason: "BUDDY", amount: -99 } })).toBe(1);
    expect(await buyBuddyItem(uid, "crown")).toEqual({ ok: false, error: "funds" });
    expect(await prisma.buddyItem.findUnique({ where: { userId_itemId: { userId: uid, itemId: "crown" } } })).toBeNull();
    expect(await buyBuddyItem(uid, "beanie")).toEqual({ ok: false, error: "funds" }); // 35 gold > 15
  });

  it("refuses unknown and free items", async () => {
    expect(await buyBuddyItem(uid, "nope")).toEqual({ ok: false, error: "unknown" });
    expect(await buyBuddyItem(uid, "party")).toEqual({ ok: false, error: "free" });
  });

  it("wears only owned or free things", async () => {
    expect(await saveBuddyLook(uid, { buddy: "goose", outfit: {} })).toBeNull();
    expect(await saveBuddyLook(uid, { buddy: "popcorn", outfit: { hat: "crown" } })).toBeNull();
    expect(await saveBuddyLook(uid, { buddy: "popcorn", outfit: { face: "cap" } })).toBeNull(); // wrong slot
    expect(await saveBuddyLook(uid, { buddy: "popcorn", outfit: { hat: "cap", neck: "scarf" } })).toBeNull();
    const ok = await saveBuddyLook(uid, { buddy: "popcorn", outfit: { hat: "cap" } });
    expect(ok).toEqual({ buddy: "popcorn", outfit: { hat: "cap" } });
    const u = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    expect(lookOf(u)).toEqual({ buddy: "popcorn", outfit: { hat: "cap" } });
    expect(await saveBuddyLook(uid, { buddy: "kex", outfit: { hat: "party" } })).toEqual({ buddy: "kex", outfit: { hat: "party" } });
  });
});

describe("achievements", () => {
  it("can't be claimed early, pays once, and reward items can be worn but not bought", async () => {
    const { claimAchievement, getAchievements } = await import("./buddy");
    expect(await claimAchievement(uid, "first-hour")).toEqual({ ok: false, error: "notYet" });
    await prisma.goldTransaction.createMany({ data: Array.from({ length: 6 }, (_, i) => ({ userId: uid, amount: 2, reason: "TV_WATCH", day: `2026-01-0${i + 1}` })) });
    const before = (await wallet()).gold;
    const [a, b] = await Promise.all([claimAchievement(uid, "first-hour"), claimAchievement(uid, "first-hour")]);
    expect([a, b].filter((r) => r.ok)).toHaveLength(1);
    expect((await wallet()).gold).toBe(before + 10);
    expect(await claimAchievement(uid, "nope")).toEqual({ ok: false, error: "unknown" });

    expect(await buyBuddyItem(uid, "medal")).toEqual({ ok: false, error: "reward" });
    expect(await saveBuddyLook(uid, { buddy: "blip", outfit: { neck: "medal" } })).toBeNull();
    await prisma.checkIn.create({ data: { userId: uid, day: "2026-02-07", streak: 7, reward: 50 } });
    expect(await claimAchievement(uid, "streak7")).toEqual({ ok: true, item: "medal" });
    expect(await saveBuddyLook(uid, { buddy: "blip", outfit: { neck: "medal" } })).toEqual({ buddy: "blip", outfit: { neck: "medal" } });

    const list = await getAchievements(uid);
    expect(list.find((x) => x.id === "first-hour")).toMatchObject({ done: true, claimed: true });
    expect(list.find((x) => x.id === "couch")).toMatchObject({ progress: 6, done: false, claimed: false });
  });
});
