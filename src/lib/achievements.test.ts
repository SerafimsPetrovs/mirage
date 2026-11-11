import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, achievementStates, claimMarker } from "./achievements";
import { itemDef } from "./buddy-catalog";
import { buddyRu } from "@/i18n/buddy.ru";
import { buddyEn } from "@/i18n/buddy.en";

describe("achievements", () => {
  it("rewards exist, item rewards are reward-only, every one has texts", () => {
    for (const a of ACHIEVEMENTS) {
      if ("item" in a.reward) expect(itemDef(a.reward.item)?.cur).toBe("reward");
      for (const d of [buddyRu, buddyEn]) {
        expect(d.ach.names[a.id]).toBeTruthy();
        expect(d.ach.goals[a.id]).toBeTruthy();
      }
    }
  });

  it("computes progress, clamps it, and reads claims", () => {
    const m = { tvWatch: 40, tvVotes: 3, quiz: 0, chat: -1, streak: 7, episodes: 0, buddyBuys: 0 };
    const s = achievementStates(m, new Set([claimMarker("couch")]));
    expect(s.find((x) => x.id === "couch")).toMatchObject({ progress: 30, done: true, claimed: true });
    expect(s.find((x) => x.id === "voter")).toMatchObject({ progress: 3, done: false });
    expect(s.find((x) => x.id === "chatty")?.progress).toBe(0);
  });
});
