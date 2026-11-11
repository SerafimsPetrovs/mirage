import { describe, expect, it } from "vitest";
import { cueAt, parseCues } from "./captions";

describe("captions", () => {
  it("parses WebVTT and SRT", () => {
    const vtt = parseCues("WEBVTT\n\n00:00.500 --> 00:02.000\nПривет, <b>Земля</b>!\n\n1\n00:00:02,000 --> 00:00:04,250\nSecond line\nwraps");
    expect(vtt).toEqual([
      { start: 0.5, end: 2, text: "Привет, Земля!" },
      { start: 2, end: 4.25, text: "Second line\nwraps" },
    ]);
    expect(cueAt(vtt, 1)?.text).toBe("Привет, Земля!");
    expect(cueAt(vtt, 3)?.text).toContain("Second");
    expect(cueAt(vtt, 9)).toBeNull();
  });
  it("skips broken blocks", () => {
    expect(parseCues("garbage\n\n00:05 --> 00:01\nbackwards\n\n00:01 --> 00:02\n")).toEqual([]);
  });
});
