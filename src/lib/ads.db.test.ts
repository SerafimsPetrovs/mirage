import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./db";
import { AD_DAILY_EPISODES, AD_SECONDS, ADS_PER_EPISODE, AdError, completeAd, getAdState, startAd } from "./ads";

const tag = Date.now().toString(36);
let creatorId: string;
let viewer: { id: string; role: "VIEWER"; subscription: null };
let eps: string[];

const later = (s: number) => new Date(Date.now() + s * 1000);
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof AdError ? e.code : String(e);
  }
};
/** Starts + completes one ad as if AD_SECONDS had passed. */
const watch = async (episodeId: string) => {
  const { adId } = await startAd(viewer, episodeId);
  return completeAd(viewer.id, adId, later(AD_SECONDS));
};

beforeAll(async () => {
  const c = await prisma.user.create({ data: { email: `ac${tag}@t.t`, name: "C", passwordHash: "x", role: "CREATOR" } });
  const v = await prisma.user.create({ data: { email: `av${tag}@t.t`, name: "V", passwordHash: "x" } });
  creatorId = c.id;
  viewer = { id: v.id, role: "VIEWER", subscription: null };
  const s = await prisma.series.create({
    data: {
      slug: `ad-${tag}`, titleRu: "A", titleEn: "A", descriptionRu: "", descriptionEn: "", status: "PUBLISHED",
      freeEpisodes: 1, defaultCoinPrice: 30, creatorId,
      episodes: { create: [1, 2, 3, 4, 5, 6].map((number) => ({ number, videoUrl: "demo:v-teal.mp4" })) },
    },
    include: { episodes: { orderBy: { number: "asc" } } },
  });
  eps = s.episodes.map((e) => e.id);
});

afterAll(async () => {
  await prisma.series.deleteMany({ where: { creatorId } });
  await prisma.user.deleteMany({ where: { id: { in: [creatorId, viewer.id] } } });
});

describe("rewarded ads", () => {
  it("refuses free episodes and finishing an ad early", async () => {
    expect(await code(startAd(viewer, eps[0]))).toBe("NOT_LOCKED");
    const { adId } = await startAd(viewer, eps[1]);
    expect(await code(completeAd(viewer.id, adId, later(3)))).toBe("TOO_EARLY");
    expect(await code(completeAd(creatorId, adId, later(AD_SECONDS)))).toBe("NOT_FOUND");
  });

  it(`unlocks the episode after ${ADS_PER_EPISODE} completed ads, without spending coins`, async () => {
    const first = await watch(eps[1]);
    expect(first).toEqual({ unlocked: false, watched: 1 });
    expect((await getAdState(viewer.id, eps[1])).watched).toBe(1);
    const second = await watch(eps[1]);
    expect(second.unlocked).toBe(true);
    expect(await prisma.unlock.count({ where: { userId: viewer.id, episodeId: eps[1] } })).toBe(1);
    expect(await prisma.coinTransaction.count({ where: { userId: viewer.id } })).toBe(0);
    expect(await code(startAd(viewer, eps[1]))).toBe("NOT_LOCKED");
  });

  it("a completed ad can't be reused", async () => {
    const { adId } = await startAd(viewer, eps[2]);
    await completeAd(viewer.id, adId, later(AD_SECONDS));
    expect(await code(completeAd(viewer.id, adId, later(AD_SECONDS)))).toBe("NOT_FOUND");
  });

  it(`stops after ${AD_DAILY_EPISODES} episodes a day`, async () => {
    // eps[1] already unlocked today; open the rest up to the limit
    for (let i = 2; i < 1 + AD_DAILY_EPISODES; i++) {
      while (!(await watch(eps[i])).unlocked);
    }
    expect((await getAdState(viewer.id, eps[5])).leftToday).toBe(0);
    expect(await code(startAd(viewer, eps[5]))).toBe("LIMIT");
  });
});
