import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./db";
import { attachReferrer, getOrCreateRefCode, getReferralStats, REF_BONUS_INVITEE, REF_BONUS_INVITER, rewardInviterOnReturn } from "./referrals";

const tag = Date.now().toString(36);
const ids: string[] = [];
let seq = 0;
const mk = async (createdAt?: Date) => {
  const u = await prisma.user.create({ data: { email: `rf${tag}${seq++}@t.t`, name: "U", passwordHash: "x", ...(createdAt ? { createdAt } : {}) } });
  ids.push(u.id);
  return u.id;
};
const bonus = async (id: string) => (await prisma.user.findUniqueOrThrow({ where: { id }, select: { bonusCoins: true } })).bonusCoins;
let inviter: string;
let code: string;

beforeAll(async () => {
  inviter = await mk();
  code = await getOrCreateRefCode(inviter);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

describe("referrals", () => {
  it("gives a stable code per user", async () => {
    expect(await getOrCreateRefCode(inviter)).toBe(code);
    expect(code).toMatch(/^[A-Z2-9]{7}$/);
  });

  it("links the invitee once and gives the welcome bonus; ignores own / unknown codes", async () => {
    const friend = await mk();
    expect(await attachReferrer(friend, code.toLowerCase())).toBe(true);
    expect(await bonus(friend)).toBe(REF_BONUS_INVITEE);
    expect(await attachReferrer(friend, code)).toBe(false);
    expect(await attachReferrer(inviter, code)).toBe(false);
    expect(await attachReferrer(await mk(), "NOPE123")).toBe(false);
  });

  it("rewards the inviter only when the friend returns on another day, once", async () => {
    const sameDay = await mk();
    await attachReferrer(sameDay, code);
    expect(await prisma.$transaction((tx) => rewardInviterOnReturn(tx, sameDay))).toBe(false);

    const yesterday = await mk(new Date(Date.now() - 86400_000));
    await attachReferrer(yesterday, code);
    const before = await bonus(inviter);
    expect(await prisma.$transaction((tx) => rewardInviterOnReturn(tx, yesterday))).toBe(true);
    expect(await bonus(inviter)).toBe(before + REF_BONUS_INVITER);
    expect(await prisma.$transaction((tx) => rewardInviterOnReturn(tx, yesterday))).toBe(false);

    const s = await getReferralStats(inviter);
    expect(s.invited).toBe(3);
    expect(s.activated).toBe(1);
  });
});
