import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { resolveMediaPath, STORAGE_DIR } from "./files";
import { probe } from "./video-stitch";
import { liteArgs, needsLite } from "./video-lite-rules";

/**
 * "Lite" copies of TV clips for phones and slow connections: at most 720p (1280 on the long side), ~2.4 Mbit/s,
 * moov atom up front. Made lazily the first time a phone asks (the original is served meanwhile), or in bulk by
 * `npm run tv:lite`. A source that is already light gets a ".orig" marker instead of a copy.
 */
const run = promisify(execFile);
const LITE_DIR = path.join(STORAGE_DIR, "lite");
const queue: string[] = [];
const queued = new Set<string>();
let busy = false;

function base(ref: string) {
  return path.join(LITE_DIR, crypto.createHash("sha1").update(ref).digest("hex").slice(0, 20));
}

/** The lite file for a media ref if it exists (null → serve the original). */
export function litePath(ref: string): string | null {
  const f = base(ref) + ".mp4";
  return fs.existsSync(/*turbopackIgnore: true*/ f) ? f : null;
}

function decided(ref: string) {
  const b = base(ref);
  return fs.existsSync(/*turbopackIgnore: true*/ b + ".mp4") || fs.existsSync(/*turbopackIgnore: true*/ b + ".orig");
}

/** Makes the lite copy now (or the marker that none is needed). Returns what happened. */
export async function makeLite(ref: string): Promise<"made" | "light" | "missing" | "exists"> {
  if (decided(ref)) return "exists";
  const src = resolveMediaPath(ref);
  if (!src || !ffmpegPath) return "missing";
  fs.mkdirSync(/*turbopackIgnore: true*/ LITE_DIR, { recursive: true });
  const b = base(ref);
  const { duration } = await probe(src);
  const bytes = fs.statSync(/*turbopackIgnore: true*/ src).size;
  if (!needsLite(bytes, duration)) {
    fs.writeFileSync(/*turbopackIgnore: true*/ b + ".orig", "");
    return "light";
  }
  const tmp = `${b}.part.mp4`;
  try {
    await run(ffmpegPath, liteArgs(src, tmp), { timeout: 20 * 60_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    fs.renameSync(/*turbopackIgnore: true*/ tmp, b + ".mp4");
    return "made";
  } catch (e) {
    fs.rmSync(/*turbopackIgnore: true*/ tmp, { force: true });
    throw e;
  }
}

/** Queues a lite copy in the background (one ffmpeg at a time, so the server stays responsive). */
export function ensureLite(ref: string) {
  if (queued.has(ref) || decided(ref)) return;
  queued.add(ref);
  queue.push(ref);
  void pump();
}

async function pump() {
  if (busy) return;
  busy = true;
  try {
    while (queue.length) {
      const ref = queue.shift()!;
      await makeLite(ref).catch((e) => console.error("[lite]", ref, e instanceof Error ? e.message : e));
      queued.delete(ref);
    }
  } finally {
    busy = false;
  }
}

