import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./db";
import { grantCoins, unlockEpisode } from "./coins";
import { movePayout, PayoutError, requestPayout } from "./payouts";
import { PAYOUT_MIN_COINS, payoutCents } from "./payout-rules";

const tag = Date.now().toString(36);
const IBAN = "DE89 3704 0044 0532 0130 00";
let creatorId: string;
let viewerId: string;
let epId: string;

const balance = async () => (await prisma.user.findUniqueOrThrow({ where: { id: creatorId }, select: { payoutCoins: true } })).payoutCoins;
const setBalance = (n: number) => prisma.user.update({ where: { id: creatorId }, data: { payoutCoins: n } });
const req = (coins: number, extra: Partial<{ method: "IBAN" | "PAYPAL"; details: string; holderName: string }> = {}) =>
  requestPayout(creatorId, { coins, method: "IBAN", details: IBAN, holderName: "Test Creator", ...extra });
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof PayoutError ? e.code : String(e);
  }
};

beforeAll(async () => {
  const c = await prisma.user.create({ data: { email: `pc${tag}@t.t`, name: "C", passwordHash: "x", role: "CREATOR", emailVerifiedAt: new Date() } });
  const v = await prisma.user.create({ data: { email: `pv${tag}@t.t`, name: "V", passwordHash: "x" } });
  creatorId = c.id;
  viewerId = v.id;
  const s = await prisma.series.create({
    data: {
      slug: `p-${tag}`, titleRu: "P", titleEn: "P", descriptionRu: "", descriptionEn: "", status: "PUBLISHED",
      freeEpisodes: 0, defaultCoinPrice: 40, creatorId,
      episodes: { create: [{ number: 1, videoUrl: "demo:v-teal.mp4" }] },
    },
    include: { episodes: true },
  });
  epId = s.episodes[0].id;
});

afterAll(async () => {
  await prisma.series.deleteMany({ where: { creatorId } });
  await prisma.user.deleteMany({ where: { id: { in: [creatorId, viewerId] } } });
});

describe("creator payouts", () => {
  it("earnings from paid coins top up the withdrawable balance", async () => {
    await grantCoins(viewerId, 40, "PURCHASE");
    await unlockEpisode(viewerId, epId);
    expect(await balance()).toBe(20);
  });

  it("rejects requests below the minimum, above the balance, or with bad details", async () => {
    await setBalance(PAYOUT_MIN_COINS + 500);
    expect(await code(req(PAYOUT_MIN_COINS - 1))).toBe("MIN");
    expect(await code(req(PAYOUT_MIN_COINS + 501))).toBe("INSUFFICIENT");
    expect(await code(req(PAYOUT_MIN_COINS, { details: "DE00 1234" }))).toBe("DETAILS");
    expect(await code(req(PAYOUT_MIN_COINS, { method: "PAYPAL", details: "not-an-email" }))).toBe("DETAILS");
    expect(await code(req(PAYOUT_MIN_COINS, { holderName: " " }))).toBe("NAME");
    expect(await balance()).toBe(PAYOUT_MIN_COINS + 500);
  });

  it("reserves coins, allows only one open request, and rejection returns the coins", async () => {
    await setBalance(PAYOUT_MIN_COINS * 2);
    const p = await req(PAYOUT_MIN_COINS);
    expect(p.amountCents).toBe(payoutCents(PAYOUT_MIN_COINS));
    expect(p.details).toBe("DE89370400440532013000");
    expect(await balance()).toBe(PAYOUT_MIN_COINS);
    expect(await code(req(PAYOUT_MIN_COINS))).toBe("OPEN_EXISTS");

    await movePayout(p.id, "APPROVED");
    expect(await code(movePayout(p.id, "CANCELED", { byUserId: creatorId }))).toBe("STATE");
    await movePayout(p.id, "REJECTED", { note: "wrong IBAN" });
    expect(await balance()).toBe(PAYOUT_MIN_COINS * 2);
    expect(await code(movePayout(p.id, "PAID"))).toBe("STATE");
  });

  it("paid payouts keep the coins spent; creator can cancel only their own pending request", async () => {
    await setBalance(PAYOUT_MIN_COINS);
    const p = await req(PAYOUT_MIN_COINS, { method: "PAYPAL", details: "Me@Example.com" });
    expect(p.details).toBe("me@example.com");
    expect(await code(movePayout(p.id, "CANCELED", { byUserId: viewerId }))).toBe("NOT_FOUND");
    await movePayout(p.id, "PAID");
    expect(await balance()).toBe(0);
    const q = await code(req(PAYOUT_MIN_COINS));
    expect(q).toBe("INSUFFICIENT");
  });

  it("parallel requests never withdraw more than the balance", async () => {
    await prisma.payout.updateMany({ where: { userId: creatorId, status: { in: ["PENDING", "APPROVED"] } }, data: { status: "CANCELED" } });
    await setBalance(PAYOUT_MIN_COINS);
    const results = await Promise.all([req(PAYOUT_MIN_COINS), req(PAYOUT_MIN_COINS), req(PAYOUT_MIN_COINS)].map(code));
    expect(results.filter((r) => r === "ok")).toHaveLength(1);
    expect(await balance()).toBe(0);
  });
});
