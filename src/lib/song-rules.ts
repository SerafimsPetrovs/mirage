// Pure rules of the song feed (no DB) — unit-tested in song-rules.test.ts.

export const HOOK_SEC = 15;
export const SONG_GENRES = ["pop", "hiphop", "rock", "electronic", "rnb", "indie", "phonk", "lofi", "other"] as const;
export const AI_TOOLS = ["HUMAN", "SUNO_PAID", "UDIO_PAID", "OTHER_AI", "SUNO_FREE"] as const;
export type AiTool = (typeof AI_TOOLS)[number];
/** Free-plan Suno songs belong to Suno and can't be used commercially — we don't publish them. */
export const BLOCKED_TOOLS: readonly AiTool[] = ["SUNO_FREE"];
export const isAiMusic = (tool: string) => tool !== "HUMAN";

/** The 15 s window the author picked, kept inside the song. */
export function clampHook(start: number, duration: number, len = HOOK_SEC) {
  const d = Math.max(0, duration);
  const l = Math.min(len, d || len);
  const s = Number.isFinite(start) ? start : 0;
  return { start: Math.round(Math.max(0, Math.min(s, Math.max(0, d - l))) * 100) / 100, len: l };
}

/**
 * Feed order: hooks people keep (saves) beat hooks people only hear (plays); new songs get a boost for 3 days
 * so they get a chance at all. Saves per play ("hit rate") matters more than raw numbers.
 */
export function feedScore(s: { saves: number; hookPlays: number; createdAt: Date }, now = Date.now()) {
  const ageDays = Math.max(0, (now - s.createdAt.getTime()) / 86400_000);
  const hitRate = (s.saves + 1) / (s.hookPlays + 5);
  const fresh = ageDays < 3 ? 2 - ageDays / 3 : 1;
  return (hitRate * 10 + Math.log10(1 + s.saves)) * fresh;
}

/** Peaks for the waveform picker: max |sample| per bucket, normalized to 0..1. */
export function peaks(samples: Float32Array, buckets: number) {
  const out = new Array<number>(buckets).fill(0);
  if (!samples.length || buckets <= 0) return out;
  const size = samples.length / buckets;
  let max = 0;
  for (let b = 0; b < buckets; b++) {
    let m = 0;
    const from = Math.floor(b * size);
    const to = Math.min(samples.length, Math.floor((b + 1) * size));
    for (let i = from; i < to; i += 4) m = Math.max(m, Math.abs(samples[i]));
    out[b] = m;
    max = Math.max(max, m);
  }
  return max ? out.map((v) => Math.round((v / max) * 100) / 100) : out;
}
