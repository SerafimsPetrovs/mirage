import { describe, expect, it } from "vitest";
import { liteArgs, needsLite, prefersLite } from "./video-lite-rules";

describe("lite copies of TV clips", () => {
  it("only re-encodes heavy sources", () => {
    expect(needsLite(206_000_000, 164)).toBe(true); // ~10 Mbit/s 1080p
    expect(needsLite(30_000_000, 120)).toBe(false); // ~2 Mbit/s
    expect(needsLite(10_000_000, 0)).toBe(false);
    expect(needsLite(90_000_000, 0)).toBe(true);
  });

  it("fits in 1280 on the long side without upscaling and starts fast", () => {
    const a = liteArgs("in.mp4", "out.mp4");
    expect(a.join(" ")).toContain("min(1280,iw)");
    expect(a.join(" ")).toContain("force_original_aspect_ratio=decrease");
    expect(a).toContain("+faststart");
    expect(a.at(-1)).toBe("out.mp4");
  });

  it("phones, data saver and slow networks get the light copy", () => {
    expect(prefersLite({ coarse: true, narrow: false })).toBe(true);
    expect(prefersLite({ coarse: false, narrow: true })).toBe(true);
    expect(prefersLite({ coarse: false, narrow: false })).toBe(false);
    expect(prefersLite({ coarse: false, narrow: false, saveData: true })).toBe(true);
    expect(prefersLite({ coarse: false, narrow: false, effectiveType: "3g" })).toBe(true);
    expect(prefersLite({ coarse: false, narrow: false, effectiveType: "4g" })).toBe(false);
  });
});
