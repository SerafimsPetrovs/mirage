import { describe, expect, it } from "vitest";
import { scoreRecommendations, signalWeight, type Signal } from "./recommend-rules";

const sig = (seriesId: string, p: Partial<Signal> = {}): Signal => ({ seriesId, episodes: 0, completed: 0, likes: 0, inList: false, rating: null, lastAt: 0, ...p });
const card = (id: string, genres: string[], views = 100) => ({ id, genres, views });

const genresOf = new Map([
  ["revenge1", ["revenge", "drama"]],
  ["scifi1", ["scifi", "mystery"]],
  ["comedy1", ["comedy"]],
]);

describe("signalWeight", () => {
  it("grows with watching, likes and list; bad ratings make it negative", () => {
    expect(signalWeight(sig("a", { episodes: 5, likes: 2, inList: true }))).toBeGreaterThan(signalWeight(sig("a", { episodes: 5 })));
    expect(signalWeight(sig("a", { episodes: 1, rating: 1 }))).toBeLessThan(0);
    // binge-watching 500 episodes can't dominate everything
    expect(signalWeight(sig("a", { episodes: 500 }))).toBe(signalWeight(sig("a", { episodes: 10 })));
  });
});

describe("scoreRecommendations", () => {
  const pool = [
    card("revenge2", ["revenge", "romance"], 50),
    card("drama2", ["drama"], 10),
    card("scifi2", ["scifi"], 10_000),
    card("comedy2", ["comedy"], 1_000_000),
    card("revenge1", ["revenge", "drama"], 999),
  ];

  it("recommends the viewer's genres first, never what they already watch, and ignores unrelated hits", () => {
    const r = scoreRecommendations([sig("revenge1", { episodes: 6, likes: 3, lastAt: 10 })], genresOf, pool);
    expect(r.items.map((c) => c.id).sort()).toEqual(["drama2", "revenge2"]);
    expect(r.anchorId).toBe("revenge1");
  });

  it("a low rating pushes those genres out", () => {
    const r = scoreRecommendations(
      [sig("revenge1", { episodes: 1, rating: 1, lastAt: 5 }), sig("scifi1", { episodes: 3, lastAt: 1 })],
      genresOf,
      pool,
    );
    expect(r.items.map((c) => c.id)).toEqual(["scifi2"]);
    expect(r.anchorId).toBe("scifi1");
  });

  it("list items count even before watching (no anchor without watch history)", () => {
    const r = scoreRecommendations([sig("comedy1", { inList: true })], genresOf, pool);
    expect(r.items.map((c) => c.id)).toEqual(["comedy2"]);
    expect(r.anchorId).toBeNull();
  });

  it("popularity only breaks ties between equally matching series", () => {
    const r = scoreRecommendations([sig("comedy1", { episodes: 2, lastAt: 1 })], genresOf, [card("c-small", ["comedy"], 10), card("c-big", ["comedy"], 10_000)]);
    expect(r.items.map((c) => c.id)).toEqual(["c-big", "c-small"]);
  });

  it("respects take and returns nothing without signals", () => {
    expect(scoreRecommendations([], genresOf, pool).items).toEqual([]);
    expect(scoreRecommendations([sig("revenge1", { episodes: 2, lastAt: 1 })], genresOf, pool, 1).items).toHaveLength(1);
  });
});
