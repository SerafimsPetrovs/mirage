import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./db";
import { earnGold, InsufficientGoldError, unlockEpisodeWithGold } from "./gold";
import { cancelPrediction, createPrediction, getEpisodePrediction, placeBet, PredictionError, resolvePrediction } from "./predictions";
import { checkBet, goldPrice, poolMultiplier } from "./gold-rules";

const tag = Date.now().toString(36);
const users: string[] = [];
let seq = 0;
const user = async (gold = 0) => {
  const u = await prisma.user.create({ data: { email: `gold${tag}${seq++}@t.t`, name: `G${seq}`, passwordHash: "x", gold } });
  users.push(u.id);
  return u.id;
};
const gold = async (id: string) => (await prisma.user.findUniqueOrThrow({ where: { id }, select: { gold: true } })).gold;
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof PredictionError ? e.code : e instanceof InsufficientGoldError ? "gold" : String(e);
  }
};

async function seriesWithEpisodes(n: number, creatorId: string) {
  const s = await prisma.series.create({
    data: { slug: `gold-${tag}-${seq++}`, titleRu: "Т", titleEn: "T", descriptionRu: "", descriptionEn: "", creatorId, status: "PUBLISHED", freeEpisodes: 1, defaultCoinPrice: 30 },
  });
  const eps = [];
  for (let i = 1; i <= n; i++) eps.push(await prisma.episode.create({ data: { seriesId: s.id, number: i, videoUrl: "demo:v-teal.mp4" } }));
  return { s, eps };
}

afterAll(async () => {
  await prisma.series.deleteMany({ where: { slug: { startsWith: `gold-${tag}` } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
});

describe("gold rules", () => {
  it("pool multiplier is clamped to ×1.5…×10", () => {
    expect(poolMultiplier(100, 100)).toBe(1.5);
    expect(poolMultiplier(300, 100)).toBe(3);
    expect(poolMultiplier(5000, 100)).toBe(10);
    expect(poolMultiplier(100, 0)).toBe(10);
  });
  it("gold price is cheaper in numbers than coins", () => {
    expect(goldPrice(30)).toBe(12);
    expect(goldPrice(1)).toBe(1);
  });
  it("a bet needs exactly one choice and a stake in range", () => {
    expect(checkBet({ optionId: "a", stake: 25 }, true)).toEqual({ ok: true });
    expect(checkBet({ optionId: "a", customText: "own idea", stake: 25 }, true)).toEqual({ ok: false, reason: "choice" });
    expect(checkBet({ customText: "own idea", stake: 25 }, false)).toEqual({ ok: false, reason: "custom_off" });
    expect(checkBet({ optionId: "a", stake: 4 }, true)).toEqual({ ok: false, reason: "stake" });
    expect(checkBet({ optionId: "a", stake: 201 }, true)).toEqual({ ok: false, reason: "stake" });
  });
});

describe("earning gold", () => {
  it("pays once per thing and stops at the daily limit", async () => {
    const u = await user();
    expect(await earnGold(u, "WATCH", "ep1")).toBe(2);
    expect(await earnGold(u, "WATCH", "ep1")).toBe(0);
    for (const ep of ["ep2", "ep3", "ep4", "ep5"]) await earnGold(u, "WATCH", ep);
    expect(await earnGold(u, "WATCH", "ep6")).toBe(0);
    expect(await gold(u)).toBe(10);
    expect(await earnGold(u, "WELCOME")).toBe(20);
    expect(await earnGold(u, "WELCOME")).toBe(0);
    expect(await prisma.goldTransaction.aggregate({ where: { userId: u }, _sum: { amount: true } })).toEqual({ _sum: { amount: 30 } });
  });

  it("unlocks a paid episode for gold once; the creator gets generation credits, not money", async () => {
    const creator = await user();
    const { eps } = await seriesWithEpisodes(2, creator);
    const v = await user(15);
    const before = await prisma.user.findUniqueOrThrow({ where: { id: creator }, select: { genCredits: true, payoutCoins: true } });
    expect((await unlockEpisodeWithGold(v, eps[1].id)).charged).toBe(12);
    expect((await unlockEpisodeWithGold(v, eps[1].id)).charged).toBe(0);
    expect(await gold(v)).toBe(3);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: creator }, select: { genCredits: true, payoutCoins: true } });
    expect(after.genCredits - before.genCredits).toBe(12);
    expect(after.payoutCoins).toBe(before.payoutCoins);
    const poor = await user(5);
    expect(await code(unlockEpisodeWithGold(poor, eps[1].id))).toBe("gold");
    expect(await prisma.unlock.count({ where: { userId: poor } })).toBe(0);
  });
});

describe("predictions", () => {
  it("takes one bet per viewer, hides the split, pays winners from the pool and closes with the next episode", async () => {
    const creator = await user();
    const { s, eps } = await seriesWithEpisodes(1, creator);
    const p = await createPrediction({ id: creator, role: "CREATOR" }, {
      episodeId: eps[0].id, questionRu: "", questionEn: "Who wrote the letter?", allowCustom: true,
      options: [{ en: "Sister", ru: "" }, { en: "Brother", ru: "" }],
    });
    const [a, b] = await prisma.predictionOption.findMany({ where: { predictionId: p.id }, orderBy: { labelEn: "desc" } });
    const v1 = await user(100), v2 = await user(100), v3 = await user(100), v4 = await user(100);

    expect(await code(placeBet(creator, p.id, { optionId: a.id, stake: 10 }))).toBe("own");
    await placeBet(v1, p.id, { optionId: a.id, stake: 50 });
    expect(await code(placeBet(v1, p.id, { optionId: b.id, stake: 10 }))).toBe("already");
    expect(await gold(v1)).toBe(50);
    await placeBet(v2, p.id, { optionId: b.id, stake: 100 });
    await placeBet(v3, p.id, { customText: "The butler did it", stake: 20 });
    await placeBet(v4, p.id, { customText: "Nobody, it was a dream", stake: 10 });

    const view = await getEpisodePrediction(eps[0].id, s.id, v1, "en");
    expect(view?.open).toBe(true);
    expect(view?.options.every((o) => o.share === null)).toBe(true);
    expect(view?.mine?.stake).toBe(50);

    // Answer can't be revealed before the next episode; after it, bets are closed.
    expect(await code(resolvePrediction({ id: creator, role: "CREATOR" }, p.id, [a.id], []))).toBe("not_yet");
    await prisma.episode.create({ data: { seriesId: s.id, number: 2, videoUrl: "demo:v-teal.mp4" } });
    const late = await user(100);
    expect(await code(placeBet(late, p.id, { optionId: a.id, stake: 10 }))).toBe("closed");

    const v3bet = await prisma.predictionBet.findFirstOrThrow({ where: { userId: v3 } });
    expect(await code(resolvePrediction({ id: v1, role: "VIEWER" }, p.id, [a.id], []))).toBe("forbidden");
    const r = await resolvePrediction({ id: creator, role: "CREATOR" }, p.id, [a.id], [v3bet.id]);
    expect(r).toMatchObject({ bets: 4, winners: 2 });
    // Pool 180 / winning stake 50 = ×3.6 → 180; accepted own guess ×3 → 60.
    expect(await gold(v1)).toBe(50 + 180);
    expect(await gold(v2)).toBe(0);
    expect(await gold(v3)).toBe(80 + 60);
    expect(await gold(v4)).toBe(90);
    expect(await code(resolvePrediction({ id: creator, role: "CREATOR" }, p.id, [a.id], []))).toBe("closed");

    const done = await getEpisodePrediction(eps[0].id, s.id, v2, "en");
    expect(done?.status).toBe("RESOLVED");
    expect(done?.options.find((o) => o.id === a.id)?.share).toBe(25);
    expect(done?.mine?.status).toBe("LOST");
  });

  it("cancel refunds every stake exactly once", async () => {
    const creator = await user();
    const { eps } = await seriesWithEpisodes(1, creator);
    const p = await createPrediction({ id: creator, role: "CREATOR" }, {
      episodeId: eps[0].id, questionRu: "Кто?", questionEn: "", allowCustom: false, options: [{ en: "A", ru: "" }, { en: "B", ru: "" }],
    });
    const opt = await prisma.predictionOption.findFirstOrThrow({ where: { predictionId: p.id } });
    const v = await user(30);
    expect(await code(placeBet(v, p.id, { customText: "my own", stake: 10 }))).toBe("custom_off");
    expect(await code(placeBet(v, p.id, { optionId: opt.id, stake: 40 }))).toBe("gold");
    await placeBet(v, p.id, { optionId: opt.id, stake: 30 });
    expect(await gold(v)).toBe(0);
    await cancelPrediction({ id: creator, role: "CREATOR" }, p.id);
    expect(await gold(v)).toBe(30);
    expect(await code(cancelPrediction({ id: creator, role: "CREATOR" }, p.id))).toBe("closed");
    expect(await gold(v)).toBe(30);
  });
});
