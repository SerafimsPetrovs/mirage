import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import ffmpegPath from "ffmpeg-static";
import { resolveMediaPath } from "./files";
import { StitchError, stitchArgs, stitchClips } from "./video-stitch";

const made: string[] = [];
afterAll(() => {
  for (const f of made) fs.rmSync(f, { force: true });
});

/** Duration in seconds, read from ffmpeg's own probe output. */
function duration(file: string) {
  let out = "";
  try {
    execFileSync(ffmpegPath!, ["-hide_banner", "-i", file], { stdio: "pipe" });
  } catch (e) {
    out = String((e as { stderr?: Buffer }).stderr ?? "");
  }
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(out);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

describe("stitchArgs", () => {
  it("fits every clip into one frame and concatenates video only", () => {
    const a = stitchArgs(["a.mp4", "b.mp4"], "out.mp4", "VERTICAL");
    expect(a.filter((x) => x === "-i")).toHaveLength(2);
    const filter = a[a.indexOf("-filter_complex") + 1];
    expect(filter).toContain("scale=720:1280");
    expect(filter).toContain("[v0][v1]concat=n=2:v=1:a=0[out]");
    expect(a).toContain("-an");
    expect(a.at(-1)).toBe("out.mp4");
    expect(stitchArgs(["a.mp4"], "o.mp4", "HORIZONTAL").join(" ")).toContain("scale=1280:720");
  });
});

describe("stitchClips (real ffmpeg)", () => {
  it("joins demo clips into one playable mp4 about as long as the inputs together", async () => {
    const refs = ["demo:v-teal.mp4", "demo:v-rose.mp4"];
    const ref = await stitchClips(refs, "VERTICAL", `test-${Date.now().toString(36)}`);
    const out = resolveMediaPath(ref)!;
    made.push(out);
    expect(ref).toMatch(/^storage:videos\/show\/test-/);
    const expected = refs.reduce((s, r) => s + duration(resolveMediaPath(r)!), 0);
    expect(Math.abs(duration(out) - expected)).toBeLessThan(1);
  }, 120_000);

  it("refuses unknown files, path traversal, bad names and empty input", async () => {
    const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof StitchError ? e.code : String(e)));
    expect(await code(stitchClips(["demo:nope.mp4", "demo:v-teal.mp4"], "VERTICAL", "x"))).toBe("BAD_CLIP");
    expect(await code(stitchClips(["demo:../../package.json", "demo:v-teal.mp4"], "VERTICAL", "x"))).toBe("BAD_CLIP");
    expect(await code(stitchClips(["demo:v-teal.mp4"], "VERTICAL", "../evil"))).toBe("FAILED");
    expect(await code(stitchClips([], "VERTICAL", "x"))).toBe("TOO_MANY");
  });
});
