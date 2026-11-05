import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./db";
import { grantCoins, InsufficientCoinsError, unlockEpisode } from "./coins";
import { boostPoll, buyScene, buySkin, ChatError, sendChatMessage, spinSkin, unlockPhoto } from "./extras";
import { checkKidsPin, PIN_MAX_FAILS, setKidsPin } from "./kids";
import { CHAT_FREE_MESSAGES, CHAT_MESSAGE_PRICE, CHAT_RATE_PER_MIN, ROULETTE_PRICE } from "./spicy";

const tag = Date.now().toString(36);
let creator: { id: string; role: string };
let viewer: { id: string; role: string };
let seriesId: string;
let ep2: string;
let ep3: string;
let pollId: string;
let optA: string;
let skinIds: string[];
let sceneId: string;
let characterId: string;
let photoId: string;

const bal = async (id: string) => prisma.user.findUniqueOrThrow({ where: { id }, select: { paidCoins: true, bonusCoins: true, genCredits: true } });

beforeAll(async () => {
  const c = await prisma.user.create({ data: { email: `xc${tag}@t.t`, name: "C", passwordHash: "x", role: "CREATOR" } });
  const v = await prisma.user.create({ data: { email: `xv${tag}@t.t`, name: "V", passwordHash: "x" } });
  creator = { id: c.id, role: c.role };
  viewer = { id: v.id, role: v.role };
  const s = await prisma.series.create({
    data: {
      slug: `x-${tag}`, titleRu: "X", titleEn: "X", descriptionRu: "", descriptionEn: "", status: "PUBLISHED",
      freeEpisodes: 1, defaultCoinPrice: 30, creatorId: c.id,
      episodes: { create: [1, 2, 3].map((number) => ({ number, videoUrl: "demo:v-teal.mp4" })) },
    },
    include: { episodes: { orderBy: { number: "asc" } } },
  });
  seriesId = s.id;
  [, ep2, ep3] = s.episodes.map((e) => e.id);
  const poll = await prisma.poll.create({
    data: { seriesId, questionRu: "Q", questionEn: "Q", closesAt: new Date(Date.now() + 86400_000), options: { create: [{ labelRu: "A", labelEn: "A" }, { labelRu: "B", labelEn: "B" }] } },
    include: { options: true },
  });
  pollId = poll.id;
  optA = poll.options[0].id;
  const skins = await Promise.all(
    ["common", "rare"].map((rarity, i) => prisma.skin.create({ data: { episodeId: ep2, nameRu: `S${i}`, nameEn: `S${i}`, rarity, videoUrl: "demo:v-rose.mp4", price: 40 } })),
  );
  skinIds = skins.map((x) => x.id);
  sceneId = (await prisma.bonusScene.create({ data: { episodeId: ep2, titleRu: "Sc", titleEn: "Sc", videoUrl: "demo:v-rose.mp4", price: 30 } })).id;
  const ch = await prisma.character.create({ data: { seriesId, nameRu: "Ли", nameEn: "Li", persona: "A confident, witty heroine.", age: 25 } });
  characterId = ch.id;
  photoId = (await prisma.characterPhoto.create({ data: { characterId, imageUrl: "demo:chars/x.svg", price: 25 } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("paid vs bonus coins", () => {
  it("spends bonus coins first; creator gets credits for bonus part and coins for paid part", async () => {
    await grantCoins(viewer.id, 10, "BONUS");
    await grantCoins(viewer.id, 100, "PURCHASE");
    const credits0 = (await bal(creator.id)).genCredits;
    await unlockEpisode(viewer.id, ep2); // 30 = 10 bonus + 20 paid
    expect(await bal(viewer.id)).toMatchObject({ bonusCoins: 0, paidCoins: 80 });
    const e = await prisma.creatorEarning.findFirstOrThrow({ where: { episodeId: ep2, source: "UNLOCK" } });
    expect(e).toMatchObject({ coins: 10, credits: 5 });
    expect((await bal(creator.id)).genCredits).toBe(credits0 + 5);
  });

  it("ledger rows carry the split", async () => {
    const tx = await prisma.coinTransaction.findFirstOrThrow({ where: { userId: viewer.id, reason: "UNLOCK" } });
    expect(tx).toMatchObject({ amount: -30, bonus: -10, paid: -20 });
  });
});

describe("poll boost", () => {
  it("charges 5 coins per vote and pays the creator 50%", async () => {
    await boostPoll(viewer, pollId, optA, 4);
    expect((await bal(viewer.id)).paidCoins).toBe(60);
    const b = await prisma.pollBoost.findFirstOrThrow({ where: { pollId } });
    expect(b).toMatchObject({ votes: 4, coins: 20 });
    expect((await prisma.creatorEarning.findFirstOrThrow({ where: { source: "POLL_BOOST", seriesId } })).coins).toBe(10);
  });

  it("creators can't boost their own poll", async () => {
    await expect(boostPoll(creator, pollId, optA, 1)).rejects.toThrow("OWNER");
  });
});

describe("skins", () => {
  it("buying is idempotent", async () => {
    expect((await buySkin(viewer, skinIds[0])).charged).toBe(40);
    expect((await buySkin(viewer, skinIds[0])).charged).toBe(0);
    expect((await bal(viewer.id)).paidCoins).toBe(20);
  });

  it("roulette only wins skins not owned yet, then reports nothing left", async () => {
    await grantCoins(viewer.id, 100, "PURCHASE");
    const won = await spinSkin(viewer, ep2, () => 0);
    expect(won.id).toBe(skinIds[1]);
    expect((await bal(viewer.id)).paidCoins).toBe(120 - ROULETTE_PRICE);
    await expect(spinSkin(viewer, ep2)).rejects.toThrow("NOTHING_LEFT");
  });
});

describe("scenes, photos and chat", () => {
  it("scene unlock charges once", async () => {
    expect((await buyScene(viewer, sceneId)).charged).toBe(30);
    expect((await buyScene(viewer, sceneId)).charged).toBe(0);
  });

  it("a photo can only be bought after the character sent it", async () => {
    await expect(unlockPhoto(viewer, photoId)).rejects.toThrow("NOT_SENT");
  });

  it("first messages are free, then each costs coins; asking for a photo attaches one", async () => {
    const before = await bal(viewer.id);
    for (let i = 0; i < CHAT_FREE_MESSAGES; i++) expect((await sendChatMessage(viewer, characterId, "привет", "ru")).charged).toBe(0);
    const paid = await sendChatMessage(viewer, characterId, "пришли фото", "ru");
    expect(paid.charged).toBe(CHAT_MESSAGE_PRICE);
    // The only photo goes out exactly once (auto after a few replies, or when asked)
    expect(await prisma.chatMessage.count({ where: { photoId } })).toBe(1);
    const after = await bal(viewer.id);
    expect(before.paidCoins + before.bonusCoins - (after.paidCoins + after.bonusCoins)).toBe(CHAT_MESSAGE_PRICE);
    expect((await unlockPhoto(viewer, photoId)).charged).toBe(25);
  });

  it("refuses when the viewer can't pay for a message", async () => {
    const poor = await prisma.user.create({ data: { email: `xp${tag}@t.t`, name: "P", passwordHash: "x" } });
    await prisma.chatThread.create({ data: { userId: poor.id, characterId, userMessages: CHAT_FREE_MESSAGES } });
    await expect(sendChatMessage({ id: poor.id, role: "VIEWER" }, characterId, "hi", "en")).rejects.toThrow("INSUFFICIENT");
  });

  it("insufficient coins for a scene leaves no unlock behind", async () => {
    const poor = await prisma.user.create({ data: { email: `xq${tag}@t.t`, name: "Q", passwordHash: "x" } });
    await expect(buyScene({ id: poor.id, role: "VIEWER" }, sceneId)).rejects.toBeInstanceOf(InsufficientCoinsError);
    expect(await prisma.sceneUnlock.count({ where: { userId: poor.id } })).toBe(0);
  });
});

describe("chat rate limit", () => {
  it(`blocks the ${CHAT_RATE_PER_MIN + 1}th message within a minute, without charging`, async () => {
    const u = await prisma.user.create({ data: { email: `xr${tag}@t.t`, name: "R", passwordHash: "x" } });
    await grantCoins(u.id, 100, "BONUS");
    const who = { id: u.id, role: u.role };
    for (let i = 0; i < CHAT_RATE_PER_MIN; i++) await sendChatMessage(who, characterId, `msg ${i}`, "ru");
    const before = await bal(u.id);
    await expect(sendChatMessage(who, characterId, "ещё", "ru")).rejects.toBeInstanceOf(ChatError);
    expect(await bal(u.id)).toEqual(before);
    await prisma.user.delete({ where: { id: u.id } });
  });
});

describe("kids PIN", () => {
  it("locks after too many wrong attempts", async () => {
    await setKidsPin(viewer.id, "1234");
    expect(await checkKidsPin(viewer.id, "1234")).toBe("ok");
    for (let i = 0; i < PIN_MAX_FAILS - 1; i++) expect(await checkKidsPin(viewer.id, "0000")).toBe("wrong");
    expect(await checkKidsPin(viewer.id, "0000")).toBe("locked");
    expect(await checkKidsPin(viewer.id, "1234")).toBe("locked"); // even the right PIN while locked
  });

  it("rejects malformed PINs", async () => {
    expect(await setKidsPin(viewer.id, "12a4")).toBe(false);
    expect(await checkKidsPin(viewer.id, "12345")).toBe("invalid");
  });

  void ep3;
});
