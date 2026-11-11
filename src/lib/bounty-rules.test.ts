import { describe, expect, it } from "vitest";
import { bountyReward, bufferFill, isFresh, minutesShort, multiplier, zoneFor } from "./bounty-rules";

describe("bounty rules", () => {
  it("maps the 24 h buffer to zones at 80 % and 40 %", () => {
    expect(zoneFor(0.81)).toBe("GREEN");
    expect(zoneFor(0.8)).toBe("YELLOW");
    expect(zoneFor(0.4)).toBe("YELLOW");
    expect(zoneFor(0.39)).toBe("RED");
    expect(zoneFor(0)).toBe("RED");
  });

  it("pays x1 / +25 % / x2 and the manual boost is x2", () => {
    expect(multiplier("GREEN", false)).toBe(1);
    expect(multiplier("YELLOW", false)).toBe(1.25);
    expect(multiplier("RED", false)).toBe(2);
    expect(multiplier("GREEN", true)).toBe(2);
    expect(bountyReward("GREEN")).toEqual({ credits: 20, coins: 0 });
    expect(bountyReward("YELLOW")).toEqual({ credits: 25, coins: 0 });
    expect(bountyReward("RED")).toEqual({ credits: 40, coins: 30 });
    expect(bountyReward("BOOST")).toEqual({ credits: 40, coins: 30 });
    expect(bountyReward("")).toEqual({ credits: 0, coins: 0 });
  });

  it("computes fill for 24 and 48 hours and the shortage", () => {
    expect(bufferFill(60, 120)).toEqual({ fill24: 0.5, fill48: 0.25 });
    expect(bufferFill(500, 120)).toEqual({ fill24: 1, fill48: 1 });
    expect(bufferFill(10, 0).fill24).toBe(1);
    expect(minutesShort(66, 120)).toBe(30);
    expect(minutesShort(200, 120)).toBe(0);
  });

  it("treats new or rarely aired clips as fresh", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    expect(isFresh({ plays: 0, createdAt: new Date("2026-01-01") }, now)).toBe(true);
    expect(isFresh({ plays: 50, createdAt: new Date("2026-11-09") }, now)).toBe(true);
    expect(isFresh({ plays: 50, createdAt: new Date("2026-10-01") }, now)).toBe(false);
  });
});
