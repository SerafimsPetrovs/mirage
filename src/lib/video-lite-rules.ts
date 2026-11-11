// Pure rules for the lite (phone) copies of TV clips — unit-tested.

/** Target video bitrate of a lite copy. */
export const LITE_MAX_KBPS = 2400;
/** A source below this overall bitrate is already light enough: no copy is made. */
export const LITE_SKIP_KBPS = 3500;

export function needsLite(bytes: number, durationSec: number) {
  if (!(durationSec > 0)) return bytes > 40 * 1024 * 1024; // unknown length: only big files
  return (bytes * 8) / 1000 / durationSec > LITE_SKIP_KBPS;
}

/**
 * ffmpeg arguments: fit inside 1280×1280 keeping the aspect (720p either way round), never upscale,
 * capped bitrate for steady mobile playback, AAC 96k, moov atom first so playback starts at once.
 */
export function liteArgs(input: string, output: string) {
  return [
    "-hide_banner",
    "-y",
    "-i",
    input,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-vf",
    "scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-profile:v",
    "main",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "24",
    "-maxrate",
    `${LITE_MAX_KBPS}k`,
    "-bufsize",
    `${LITE_MAX_KBPS * 2}k`,
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    output,
  ];
}

/** Should this browser get the lite copy? Phones, tablets, Save-Data and slow connections do. */
export function prefersLite(env: { coarse: boolean; narrow: boolean; saveData?: boolean; effectiveType?: string }) {
  if (env.saveData) return true;
  if (env.effectiveType && ["slow-2g", "2g", "3g"].includes(env.effectiveType)) return true;
  return env.coarse || env.narrow;
}
