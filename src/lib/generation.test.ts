import { describe, expect, it } from "vitest";
import { checkPrompt, costFor, mockResult, mockState, mockTotalMs, PROMPT_MAX } from "./generation";

describe("generation cost", () => {
  it("charges 2 credits per output second", () => {
    expect(costFor(5)).toBe(10);
    expect(costFor(10)).toBe(20);
  });
});

describe("mockState", () => {
  it("queues, runs, then finishes", () => {
    expect(mockState(0, 5)).toEqual({ status: "QUEUED", progress: 0 });
    const mid = mockState(mockTotalMs(5) / 2 + 1500, 5);
    expect(mid.status).toBe("RUNNING");
    expect(mid.progress).toBeGreaterThan(0);
    expect(mid.progress).toBeLessThan(1);
    expect(mockState(mockTotalMs(5), 5)).toEqual({ status: "DONE", progress: 1 });
  });
  it("longer clips take longer", () => {
    expect(mockTotalMs(10)).toBeGreaterThan(mockTotalMs(5));
  });
});

describe("mockResult", () => {
  it("is deterministic and matches orientation", () => {
    expect(mockResult(42, "VERTICAL")).toBe(mockResult(42, "VERTICAL"));
    expect(mockResult(42, "VERTICAL")).toMatch(/^demo:v-.+\.mp4$/);
    expect(mockResult(7, "HORIZONTAL")).toMatch(/^demo:h-.+\.mp4$/);
  });
});

describe("checkPrompt", () => {
  it("accepts ordinary and adult prompts", () => {
    expect(checkPrompt("Неоновый Токио, дождь, героиня в красном плаще")).toEqual({ ok: true });
    expect(checkPrompt("explicit erotic scene between two adult women")).toEqual({ ok: true });
  });
  it("rejects empty and too long prompts", () => {
    expect(checkPrompt("   ")).toEqual({ ok: false, reason: "empty" });
    expect(checkPrompt("a".repeat(PROMPT_MAX + 1))).toEqual({ ok: false, reason: "too_long" });
  });
  it("blocks sexual content involving minors (RU/EN)", () => {
    expect(checkPrompt("nude schoolgirl")).toEqual({ ok: false, reason: "forbidden" });
    expect(checkPrompt("эротика, девочке 15 лет")).toEqual({ ok: false, reason: "forbidden" });
  });
  it("allows minors in non-sexual scenes", () => {
    expect(checkPrompt("a kid flies a kite on the beach")).toEqual({ ok: true });
  });
});
