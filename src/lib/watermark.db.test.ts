import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { prisma } from "./db";
import { STORAGE_DIR } from "./files";
import { detectLeak, personalPlaylist, prepareWatermark, segmentToken, sessionCode, verifyToken, WM_DIR } from "./watermark";
import { crc4, decodeCode, MAX_CODE, payloadBits, PAYLOAD_BITS, variantFor } from "./watermark-rules";

const tag = Date.now().toString(36);
const tmp = path.join(STORAGE_DIR, "videos", `wmtest-${tag}`);
const users: string[] = [];

afterAll(async () => {
  const assets = await prisma.watermarkAsset.findMany({ where: { sourceRef: { contains: `wmtest-${tag}` } } });
  for (const a of assets) fs.rmSync(path.join(WM_DIR, a.dir), { recursive: true, force: true });
  await prisma.watermarkAsset.deleteMany({ where: { sourceRef: { contains: `wmtest-${tag}` } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("watermark rules", () => {
  it("payload = code + CRC, guests always get A, decoding votes over repeats", () => {
    const code = 0b1011001110001111;
    const bits = payloadBits(code);
    expect(bits).toHaveLength(PAYLOAD_BITS);
    expect(parseInt(bits.slice(16).join(""), 2)).toBe(crc4(code));
    expect(Array.from({ length: 40 }, (_, n) => variantFor(0, n)).every((v) => v === "A")).toBe(true);
    // Two repeats, a few wrong weak readings in the second pass are outvoted.
    const readings = Array.from({ length: 40 }, (_, n) => {
      const bit = bits[n % PAYLOAD_BITS] as 0 | 1;
      const flip = n >= 20 && n % 7 === 0;
      return { n, bit: (flip ? 1 - bit : bit) as 0 | 1, strength: flip ? 0.2 : 0.9 };
    });
    expect(decodeCode(readings)?.code).toBe(code);
    expect(decodeCode(readings.slice(0, 10))).toBeNull();
    expect(MAX_CODE).toBe(65535);
  });

  it("segment links are signed and bound to the viewer", () => {
    const t = segmentToken(7, 42, "u1");
    expect(verifyToken(t, "u1")).toEqual({ n: 7, code: 42 });
    expect(verifyToken(t, "u2")).toBeNull();
    expect(verifyToken(t.replace(".42.", ".43."), "u1")).toBeNull();
    expect(verifyToken(t, "u1", Date.now() + 7 * 3600_000)).toBeNull();
  });
});

describe("forensic watermark (real ffmpeg)", () => {
  it("finds the viewer in a re-encoded, downscaled leak", async () => {
    fs.mkdirSync(tmp, { recursive: true });
    // ~44 s source: two payload repeats of 2 s segments.
    const src = path.join(tmp, "src.mp4");
    execFileSync(ffmpegPath!, ["-hide_banner", "-loglevel", "error", "-y", "-stream_loop", "5", "-i", path.join(process.cwd(), "media", "demo", "v-teal.mp4"), "-t", "44", "-c:v", "libx264", "-preset", "ultrafast", "-an", src]);
    const ref = `storage:videos/wmtest-${tag}/src.mp4`;
    const asset = await prepareWatermark(ref);
    expect(asset?.status).toBe("READY");
    expect(asset!.segments).toBeGreaterThanOrEqual(20);

    const u = await prisma.user.create({ data: { email: `wm${tag}@t.t`, name: "Leaker", passwordHash: "x" } });
    users.push(u.id);
    const other = await prisma.user.create({ data: { email: `wm2${tag}@t.t`, name: "Other", passwordHash: "x" } });
    users.push(other.id);
    const code = await sessionCode(asset!.id, u.id);
    expect(await sessionCode(asset!.id, u.id)).toBe(code);
    expect(await sessionCode(asset!.id, other.id)).not.toBe(code);
    expect(personalPlaylist(asset!, "ep1", code, u.id)).toContain("/api/hls/ep1/seg?t=");

    // The viewer's personal stream, as they'd receive it, then a typical pirate re-encode: 360p, worse quality.
    const base = path.join(WM_DIR, asset!.dir);
    const list = path.join(tmp, "list.txt");
    fs.writeFileSync(list, Array.from({ length: asset!.segments }, (_, n) => `file '${path.join(base, variantFor(code, n), `${String(n).padStart(4, "0")}.ts`).replace(/\\/g, "/")}'`).join("\n"));
    const leak = path.join(tmp, "leak.mp4");
    execFileSync(ffmpegPath!, ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-vf", "scale=360:-2,eq=brightness=0.03", "-c:v", "libx264", "-crf", "28", "-preset", "veryfast", leak]);

    const found = await detectLeak(leak, ref);
    expect(found.ok).toBe(true);
    if (found.ok) {
      expect(found.code).toBe(code);
      expect(found.user?.id).toBe(u.id);
    }
  }, 300_000);
});
