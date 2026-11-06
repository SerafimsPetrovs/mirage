import "server-only";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { resolveMediaPath, STORAGE_DIR } from "./files";

const run = promisify(execFile);

export const STITCH_MAX_CLIPS = 12;
const SIZE = { VERTICAL: [720, 1280], HORIZONTAL: [1280, 720] } as const;

export class StitchError extends Error {
  constructor(public code: "NO_FFMPEG" | "BAD_CLIP" | "TOO_MANY" | "FAILED") {
    super(code);
  }
}

/**
 * ffmpeg arguments that join clips into one H.264 mp4: every clip is fitted into the same frame
 * (letterboxed, 24 fps), audio is dropped (generated clips are silent) and the file starts fast on the web.
 * Pure — exported for tests.
 */
export function stitchArgs(inputs: string[], output: string, orientation: "VERTICAL" | "HORIZONTAL") {
  const [w, h] = SIZE[orientation];
  const norm = inputs
    .map((_, i) => `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=24,format=yuv420p[v${i}]`)
    .join(";");
  const concat = `${inputs.map((_, i) => `[v${i}]`).join("")}concat=n=${inputs.length}:v=1:a=0[out]`;
  return [
    "-hide_banner", "-loglevel", "error", "-y",
    ...inputs.flatMap((f) => ["-i", f]),
    "-filter_complex", `${norm};${concat}`,
    "-map", "[out]", "-an",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-movflags", "+faststart",
    output,
  ];
}

/**
 * Joins media refs (`storage:` / `demo:` / public paths) into storage/videos/show/<name>.mp4.
 * Returns the new `storage:` ref. Inputs are resolved through resolveMediaPath (no path traversal).
 */
export async function stitchClips(refs: string[], orientation: "VERTICAL" | "HORIZONTAL", name: string) {
  if (!ffmpegPath || !fs.existsSync(/*turbopackIgnore: true*/ ffmpegPath)) throw new StitchError("NO_FFMPEG");
  if (!refs.length || refs.length > STITCH_MAX_CLIPS) throw new StitchError("TOO_MANY");
  if (!/^[\w-]{1,80}$/.test(name)) throw new StitchError("FAILED");
  const inputs = refs.map((r) => resolveMediaPath(r));
  if (inputs.some((p) => !p)) throw new StitchError("BAD_CLIP");
  const dir = path.join(STORAGE_DIR, "videos", "show");
  fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
  const out = path.join(dir, `${name}.mp4`);
  try {
    await run(ffmpegPath, stitchArgs(inputs as string[], out, orientation), { timeout: 5 * 60_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  } catch (e) {
    console.error("[stitch]", e);
    fs.rmSync(/*turbopackIgnore: true*/ out, { force: true });
    throw new StitchError("FAILED");
  }
  return `storage:videos/show/${name}.mp4`;
}
