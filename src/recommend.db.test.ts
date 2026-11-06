/** Recommendations respect kids mode and the 18+ switch (no grown-up titles leak into the heading). */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ user: null as null | Record<string, unknown> }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }));
vi.mock("@/lib/auth", async (orig) => {
  const real = await orig<typeof import("@/lib/auth")>();
  return { ...real, getCurrentUser: async () => state.user, getKidsMode: async () => !!state.user?.kidsMode };
});

import { prisma } from "@/lib/db";
import { getRecommendations } from "@/lib/recommend";

const tag = Date.now().toString(36);
let viewer: Awaited<ReturnType<typeof prisma.user.create>>;
let creatorId: string;
const ids: string[] = [];
const series = async (slug: string, genres: string, extra: Record<string, unknown> = {}) => {
  const s = await prisma.series.create({
    data: {
      slug: `${slug}-${tag}`, titleRu: `RU ${slug}`, titleEn: `EN ${slug}`, descriptionRu: "d", descriptionEn: "d", status: "PUBLISHED", genres: `${genres},zz${tag}`,
      creatorId, episodes: { create: [{ number: 1, videoUrl: "demo:v-teal.mp4" }] }, ...extra,
    },
    include: { episodes: true },
  });
  ids.push(s.id);
  return s;
};

beforeAll(async () => {
  creatorId = (await prisma.user.create({ data: { email: `rc${tag}@rec-test.dev`, name: "c", passwordHash: "x", role: "CREATOR" } })).id;
  viewer = await prisma.user.create({ data: { email: `rv${tag}@rec-test.dev`, name: "v", passwordHash: "x", showAdult: true, adultConfirmedAt: new Date() } });
  const adult = await series("adult", "romance", { isAdult: true, views: 5 });
  await prisma.watchProgress.create({ data: { userId: viewer.id, seriesId: adult.id, episodeId: adult.episodes[0].id, positionSec: 30, completed: true } });
  for (const [i, safe] of [true, true, true, false].entries()) await series(`r${i}`, "romance", { isFamilySafe: safe, views: 10 + i });
  const family = await series("fam", "romance", { isFamilySafe: true, views: 1 });
  await prisma.listItem.create({ data: { userId: viewer.id, seriesId: family.id } });
});

afterAll(async () => {
  await prisma.series.deleteMany({ where: { id: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: [viewer.id, creatorId] } } });
});

const mine = (r: Awaited<ReturnType<typeof getRecommendations>>) => (r?.items ?? []).filter((c) => c.genres.includes(`zz${tag}`));

describe("recommendations", () => {
  it("an adult viewer with 18+ on gets 'Because you watched' the adult series", async () => {
    state.user = { ...viewer, kidsMode: false };
    const r = await getRecommendations(viewer.id, "en", 50);
    expect(r?.anchor).toBe("EN adult");
    expect(mine(r).length).toBeGreaterThanOrEqual(3);
  });

  it("in kids mode: only family-safe series and never a grown-up title in the heading", async () => {
    state.user = { ...viewer, kidsMode: true };
    const r = await getRecommendations(viewer.id, "en", 50);
    expect(r?.anchor ?? null).not.toBe("EN adult");
    const all = await prisma.series.findMany({ where: { id: { in: (r?.items ?? []).map((c) => c.id) } }, select: { isFamilySafe: true } });
    expect(all.every((s) => s.isFamilySafe)).toBe(true);
  });
});
