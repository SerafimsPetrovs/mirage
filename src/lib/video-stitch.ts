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
export function stitchArgs(inputs: string[], output: string, orientation: "VERTICAL" | "HORIZONTAL", audioTotalSec = 0) {
  const [w, h] = SIZE[orientation];
  const norm = inputs
    .map((_, i) => `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=24,format=yuv420p[v${i}]`)
    .join(";");
  const concat = `${inputs.map((_, i) => `[v${i}]`).join("")}concat=n=${inputs.length}:v=1:a=0[out]`;
  // Appending clips to an existing episode: keep its soundtrack, padded with silence to the full length.
  const keepAudio = audioTotalSec > 0;
  const audio = keepAudio ? `;[0:a]aresample=44100,apad=whole_dur=${audioTotalSec.toFixed(2)}[a]` : "";
  return [
    "-hide_banner", "-loglevel", "error", "-y",
    ...inputs.flatMap((f) => ["-i", f]),
    "-filter_complex", `${norm};${concat}${audio}`,
    "-map", "[out]",
    ...(keepAudio ? ["-map", "[a]", "-c:a", "aac", "-b:a", "128k"] : ["-an"]),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-movflags", "+faststart",
    output,
  ];
}

/**
 * Joins media refs (`storage:` / `demo:` / public paths) into storage/videos/show/<name>.mp4.
 * Returns the new `storage:` ref. Inputs are resolved through resolveMediaPath (no path traversal).
 */
export async function stitchClips(refs: string[], orientation: "VERTICAL" | "HORIZONTAL", name: string, dirName: "show" | "studio" = "show") {
  if (!ffmpegPath || !fs.existsSync(/*turbopackIgnore: true*/ ffmpegPath)) throw new StitchError("NO_FFMPEG");
  if (!refs.length || refs.length > STITCH_MAX_CLIPS) throw new StitchError("TOO_MANY");
  if (!/^[\w-]{1,80}$/.test(name)) throw new StitchError("FAILED");
  const inputs = refs.map((r) => resolveMediaPath(r));
  if (inputs.some((p) => !p)) throw new StitchError("BAD_CLIP");
  const dir = path.join(STORAGE_DIR, "videos", dirName);
  fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
  const out = path.join(dir, `${name}.mp4`);
  try {
    const first = await probe(inputs[0] as string);
    const total = first.audio ? (await Promise.all(inputs.map((f) => probe(f as string)))).reduce((a, p) => a + p.duration, 0) : 0;
    await run(ffmpegPath, stitchArgs(inputs as string[], out, orientation, total), { timeout: 5 * 60_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  } catch (e) {
    console.error("[stitch]", e);
    fs.rmSync(/*turbopackIgnore: true*/ out, { force: true });
    throw new StitchError("FAILED");
  }
  return `storage:videos/${dirName}/${name}.mp4`;
}

/** Audio presence and duration of a media file (ffmpeg prints stream info to stderr and exits 1 without an output). */
export async function probe(file: string) {
  let info = "";
  try {
    await run(ffmpegPath!, ["-hide_banner", "-i", file], { timeout: 20_000, windowsHide: true });
  } catch (e) {
    info = String((e as { stderr?: string }).stderr ?? "");
  }
  const m = info.match(/Duration: (\d+):(\d+):([\d.]+)/);
  return { audio: /Stream #\d+:\d+.*Audio:/.test(info), duration: m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0 };
}
