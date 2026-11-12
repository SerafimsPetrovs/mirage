import { describe, expect, it } from "vitest";
import { deepMerge } from "./mode67";
import { dictFor } from "./shared";
import { CHAOS_EN, MORE_EN } from "./buddy-more.en";
import { CHAOS_RU, MORE_RU } from "./buddy-more.ru";

describe("67 mode", () => {
  it("deep-merges an overlay without touching the base", () => {
    const base = { a: { b: "x", c: "y" }, list: ["1", "2"], s: "z" };
    const out = deepMerge(base, { a: { b: "X" }, list: ["9"] });
    expect(out).toEqual({ a: { b: "X", c: "y" }, list: ["9"], s: "z" });
    expect(base.a.b).toBe("x");
  });
  it("changes texts only in 67 mode and keeps every other key", () => {
    for (const l of ["en", "ru"] as const) {
      const plain = dictFor(l);
      const wild = dictFor(l, true);
      expect(wild.v3.club.wantYou).not.toBe(plain.v3.club.wantYou);
      expect(wild.common.cancel).toBe(plain.common.cancel);
      expect(wild.buddy.lines.blip.idle).toBe(plain.buddy.lines.blip.idle);
    }
    expect(dictFor("ru", true).v3.club.wantYou).toContain("200 метрах");
  });
  it("buddies have enough lines not to loop, and chaos lines for 67 mode", () => {
    for (const l of ["en", "ru"] as const) {
      const d = dictFor(l);
      for (const id of ["blip", "kex", "gosha", "popcorn", "bit", "goose"] as const) {
        expect(d.buddy.lines[id].idle.length).toBeGreaterThanOrEqual(10);
        expect(d.buddy.chaos[id].length).toBeGreaterThanOrEqual(10);
      }
    }
    // both languages carry the same amount of extra material
    for (const id of Object.keys(MORE_EN) as (keyof typeof MORE_EN)[]) {
      expect(CHAOS_RU[id].length).toBe(CHAOS_EN[id].length);
      expect(MORE_RU[id].idle?.length).toBe(MORE_EN[id].idle?.length);
    }
  });
});
