import "server-only";
import fs from "node:fs";
import path from "node:path";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { resolveMediaPath, serveFile, STORAGE_DIR } from "./files";
import { decodeCode, MAX_CODE, readSegment, SEG_SEC, variantFor, WM_STRENGTH, type SegmentReading } from "./watermark-rules";

const run = promisify(execFile);
export const WM_DIR = path.join(STORAGE_DIR, "wm");
/** Signed segment links live this long (a page left open longer just reloads the playlist). */
const TOKEN_TTL_SEC = 6 * 3600;

const secret = () => process.env.WATERMARK_SECRET || process.env.SESSION_SECRET || "mirage-dev-watermark";
const dirFor = (sourceRef: string) => createHash("sha1").update(sourceRef).digest("hex").slice(0, 20);

/** ffmpeg args for one variant: +pattern (A) or −pattern (B) on luma only, fixed 2 s GOPs, HLS output. */
export function variantArgs(input: string, outDir: string, sign: 1 | -1) {
  const s = (sign * WM_STRENGTH).toFixed(2);
  const lum = `clip(lum(X,Y)+${s}*sin(2*PI*3*X/W)*sin(2*PI*4*Y/H),0,255)`;
  return [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", input,
    "-vf", `scale=trunc(min(iw\\,1280)/2)*2:-2,fps=24,format=yuv420p,geq=lum='${lum}':cb='cb(X,Y)':cr='cr(X,Y)'`,
    "-map", "0:v:0", "-map", "0:a:0?",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    "-g", String(SEG_SEC * 24), "-keyint_min", String(SEG_SEC * 24), "-sc_threshold", "0",
    "-force_key_frames", `expr:gte(t,n_forced*${SEG_SEC})`,
    "-c:a", "aac", "-b:a", "128k",
    "-f", "hls", "-hls_time", String(SEG_SEC), "-hls_playlist_type", "vod",
    "-hls_segment_filename", path.join(outDir, "%04d.ts"),
    path.join(outDir, "index.m3u8"),
  ];
}

/**
 * Builds (once) the A/B package of a source video. Safe to call repeatedly and concurrently:
 * only the caller that moves the row to RUNNING does the work.
 */
export async function prepareWatermark(sourceRef: string) {
  if (!ffmpegPath) return null;
  const asset = await prisma.watermarkAsset.upsert({ where: { sourceRef }, create: { sourceRef, dir: dirFor(sourceRef) }, update: {} });
  if (asset.status === "READY") return asset;
  const stale = new Date(Date.now() - 30 * 60_000);
  const claim = await prisma.watermarkAsset.updateMany({
    where: { id: asset.id, OR: [{ status: { in: ["PENDING", "FAILED"] } }, { status: "RUNNING", createdAt: { lt: stale } }] },
    data: { status: "RUNNING", error: null, createdAt: new Date() },
  });
  if (claim.count === 0) return asset;
  const input = resolveMediaPath(sourceRef);
  const base = path.join(WM_DIR, asset.dir);
  try {
    if (!input) throw new Error("SOURCE_MISSING");
    fs.rmSync(/*turbopackIgnore: true*/ base, { recursive: true, force: true });
    for (const [v, sign] of [["A", 1], ["B", -1]] as const) {
      const out = path.join(base, v);
      fs.mkdirSync(/*turbopackIgnore: true*/ out, { recursive: true });
      await run(ffmpegPath, variantArgs(input, out, sign), { timeout: 30 * 60_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    }
    const count = (dir: string) => fs.readFileSync(/*turbopackIgnore: true*/ path.join(base, dir, "index.m3u8"), "utf8").split("\n").filter((l) => l.endsWith(".ts")).length;
    const segments = count("A");
    if (!segments || segments !== count("B")) throw new Error("SEGMENT_MISMATCH");
    return prisma.watermarkAsset.update({ where: { id: asset.id }, data: { status: "READY", segments, segSec: SEG_SEC, readyAt: new Date() } });
  } catch (e) {
    console.error("[watermark]", sourceRef, e);
    fs.rmSync(/*turbopackIgnore: true*/ base, { recursive: true, force: true });
    return prisma.watermarkAsset.update({ where: { id: asset.id }, data: { status: "FAILED", error: String(e instanceof Error ? e.message : e).slice(0, 300) } });
  }
}

/** Protects every episode video that isn't protected yet, one after another (background). */
export async function prepareAllWatermarks() {
  const refs = await prisma.episode.findMany({ where: { videoUrl: { not: { startsWith: "http" } } }, distinct: ["videoUrl"], select: { videoUrl: true } });
  for (const { videoUrl } of refs) await prepareWatermark(videoUrl);
}

export async function readyAssetFor(videoUrl: string) {
  return prisma.watermarkAsset.findFirst({ where: { sourceRef: videoUrl, status: "READY" } });
}

/** The viewer's code for an asset (created on first play). Guests → 0. */
export async function sessionCode(assetId: string, userId: string | null) {
  if (!userId) return 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    const found = await prisma.watermarkSession.findUnique({ where: { assetId_userId: { assetId, userId } } });
    if (found) return found.code;
    const last = await prisma.watermarkSession.findFirst({ where: { assetId }, orderBy: { code: "desc" }, select: { code: true } });
    const code = (last?.code ?? 0) + 1;
    if (code > MAX_CODE) return 0;
    try {
      return (await prisma.watermarkSession.create({ data: { assetId, userId, code } })).code;
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
  return 0;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url").slice(0, 32);

/** Segment link token: segment, code, viewer and expiry, signed — the viewer can't choose the variant. */
export function segmentToken(n: number, code: number, uid: string, now = Date.now()) {
  const payload = `${n}.${code}.${uid}.${Math.floor(now / 1000) + TOKEN_TTL_SEC}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string, uid: string, now = Date.now()) {
  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const [n, code, tokUid, exp, sig] = parts;
  const expected = sign(`${n}.${code}.${tokUid}.${exp}`);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (tokUid !== uid || Number(exp) * 1000 < now) return null;
  return { n: Number(n), code: Number(code) };
}

/** Personal HLS playlist: the A playlist with every segment pointing at a signed link. */
export function personalPlaylist(asset: { dir: string }, episodeId: string, code: number, uid: string) {
  const src = fs.readFileSync(/*turbopackIgnore: true*/ path.join(WM_DIR, asset.dir, "A", "index.m3u8"), "utf8");
  return src
    .split("\n")
    .map((line) => {
      const m = /^(\d{4})\.ts$/.exec(line.trim());
      if (!m) return line;
      const n = Number(m[1]);
      return `/api/hls/${episodeId}/seg?t=${encodeURIComponent(segmentToken(n, code, uid))}`;
    })
    .join("\n");
}

export function serveSegment(asset: { dir: string }, n: number, code: number, req: Request) {
  const file = path.join(WM_DIR, asset.dir, variantFor(code, n), `${String(n).padStart(4, "0")}.ts`);
  if (!fs.existsSync(/*turbopackIgnore: true*/ file)) return new Response("Not found", { status: 404 });
  return serveFile(file, req, { "Content-Type": "video/mp2t", "Cache-Control": "private, max-age=3600" });
}

/** One small grayscale frame per segment (taken in its middle) from a video or playlist. */
async function frames(input: string, segSec: number, size = 48) {
  const { stdout } = await run(
    ffmpegPath!,
    ["-hide_banner", "-loglevel", "error", "-ss", String(segSec / 2), "-i", input, "-vf", `fps=1/${segSec},scale=${size}:${size},format=gray`, "-f", "rawvideo", "pipe:1"],
    { encoding: "buffer", timeout: 10 * 60_000, windowsHide: true, maxBuffer: 256 * 1024 * 1024 },
  );
  const buf = stdout as unknown as Buffer;
  const out: Uint8Array[] = [];
  for (let i = 0; i + size * size <= buf.length; i += size * size) out.push(new Uint8Array(buf.subarray(i, i + size * size)));
  return out;
}

export type DetectResult =
  | { ok: true; code: number; confidence: number; segments: number; user: { id: string; name: string; email: string } | null }
  | { ok: false; reason: "not_ready" | "too_short" | "no_signal" | "bad_file"; segments: number };

/**
 * Finds whose copy a leaked video is: compares every segment with the A and B encodes and decodes the code.
 * Works on re-encoded, resized or colour-shifted copies of the whole episode (from its start).
 */
export async function detectLeak(leakPath: string, sourceRef: string): Promise<DetectResult> {
  const asset = await readyAssetFor(sourceRef);
  if (!asset) return { ok: false, reason: "not_ready", segments: 0 };
  const base = path.join(WM_DIR, asset.dir);
  let leak: Uint8Array[], a: Uint8Array[], b: Uint8Array[];
  try {
    [leak, a, b] = await Promise.all([frames(leakPath, asset.segSec), frames(path.join(base, "A", "index.m3u8"), asset.segSec), frames(path.join(base, "B", "index.m3u8"), asset.segSec)]);
  } catch (e) {
    console.error("[watermark detect]", e);
    return { ok: false, reason: "bad_file", segments: 0 };
  }
  const n = Math.min(leak.length, a.length, b.length);
  const readings: SegmentReading[] = [];
  for (let i = 0; i < n; i++) readings.push({ n: i, ...readSegment(leak[i], a[i], b[i]) });
  const decoded = decodeCode(readings);
  if (!decoded) return { ok: false, reason: n < 20 ? "too_short" : "no_signal", segments: n };
  const session = await prisma.watermarkSession.findUnique({ where: { assetId_code: { assetId: asset.id, code: decoded.code } }, include: { user: { select: { id: true, name: true, email: true } } } });
  return { ok: true, code: decoded.code, confidence: decoded.confidence, segments: n, user: session?.user ?? null };
}
