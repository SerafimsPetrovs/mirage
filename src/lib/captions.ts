// WebVTT / SRT subtitles for the muted broadcast (pure).

export type Cue = { start: number; end: number; text: string };

function toSec(t: string) {
  const m = t.trim().replace(",", ".").match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (!m) return NaN;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** Parses WebVTT or SRT text into cues (bad blocks are skipped). */
export function parseCues(raw: string): Cue[] {
  const cues: Cue[] = [];
  for (const block of raw.replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    const [a, b] = lines[i].split("-->");
    const start = toSec(a);
    const end = toSec((b ?? "").trim().split(/\s+/)[0] ?? "");
    const text = lines.slice(i + 1).join("\n").replace(/<[^>]+>/g, "").trim();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start && text) cues.push({ start, end, text });
  }
  return cues.sort((x, y) => x.start - y.start);
}

export function cueAt(cues: Cue[], t: number) {
  return cues.find((c) => t >= c.start && t < c.end) ?? null;
}
