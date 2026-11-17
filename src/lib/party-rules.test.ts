import { describe, expect, it } from "vitest";
import { canControl, countdownLeft, expectedPosition, foodSplit, isOnline, needsSeek, parsePoll, partyCode, PARTY_CODE_RE, tally } from "./party-rules";

describe("party rules", () => {
  it("makes readable codes", () => {
    for (let i = 0; i < 50; i++) expect(partyCode()).toMatch(PARTY_CODE_RE);
    expect(partyCode(() => 0)).toBe("AAAAAA");
  });

  it("computes the shared position and when to re-sync", () => {
    const p = { playing: true, positionSec: 10, stateAt: 1_000 };
    expect(expectedPosition(p, 6_000)).toBe(15);
    expect(expectedPosition({ ...p, playing: false }, 6_000)).toBe(10);
    expect(expectedPosition(p, 999_000, 60)).toBe(60);
    expect(needsSeek(14.2, 15, true)).toBe(false);
    expect(needsSeek(12, 15, true)).toBe(true);
    expect(needsSeek(10.5, 10, false)).toBe(true);
  });

  it("knows who is online and who holds the remote", () => {
    expect(isOnline(0, 10_000)).toBe(true);
    expect(isOnline(0, 30_000)).toBe(false);
    expect(canControl("a", { hostId: "a", remoteId: "b" })).toBe(true);
    expect(canControl("b", { hostId: "a", remoteId: "b" })).toBe(true);
    expect(canControl("c", { hostId: "a", remoteId: "b" })).toBe(false);
  });

  it("splits the food bill to the cent", () => {
    const lines = [
      { userId: "a", priceCents: 1000, qty: 1 },
      { userId: "b", priceCents: 550, qty: 2 },
      { userId: "c", priceCents: null, qty: 1 },
    ];
    const items = foodSplit(lines, { mode: "items", deliveryCents: 301 });
    expect(items.total).toBe(2401);
    expect(items.perUser.get("a")! + items.perUser.get("b")! + items.perUser.get("c")!).toBe(2401);
    expect(items.perUser.get("b")).toBe(1100 + 100);
    expect(items.perUser.get("a")).toBe(1000 + 101);
    const eq = foodSplit(lines, { mode: "equal", deliveryCents: 301, people: ["a", "b", "c", "d"] });
    expect([...eq.perUser.values()].reduce((x, y) => x + y, 0)).toBe(2401);
    expect(eq.perUser.size).toBe(4);
    expect(foodSplit([], { mode: "items" }).perUser.size).toBe(0);
  });

  it("polls and countdowns", () => {
    expect(parsePoll('{"id":"p","question":"q","options":["a","b"]}')?.options).toEqual(["a", "b"]);
    expect(parsePoll("nope")).toBeNull();
    expect(tally([{ option: 0 }, { option: 1 }, { option: 1 }, { option: 7 }], 2)).toEqual([1, 2]);
    expect(countdownLeft(5_000, 2_100)).toBe(3);
    expect(countdownLeft(5_000, 5_000)).toBeNull();
    expect(countdownLeft(null, 0)).toBeNull();
  });
});
