// Pure rules for turning a song into a music video (no DB, no ffmpeg) — unit-tested in music-rules.test.ts.

export const MUSIC_STYLES = ["KARAOKE", "BARS", "WAVE", "CIRCLE", "CQT", "VHS", "SLIDESHOW", "AI"] as const;
export type MusicStyle = (typeof MUSIC_STYLES)[number];
export const isMusicStyle = (s: string): s is MusicStyle => (MUSIC_STYLES as readonly string[]).includes(s);

export const MUSIC_MAX_SECONDS = 8 * 60;
export const MUSIC_AUDIO_MAX_BYTES = 30 * 1024 * 1024;
export const MUSIC_MAX_IMAGES = 12;
export const LYRICS_MAX = 8000;
/** A viewer pays this to put their own song on the music channel (moderated, refunded if rejected). */
export const MUSIC_ORDER_PRICE = 150;
export const MUSIC_ORDER_MAX_OPEN = 2;
/** AI style: how many generated scenes (each a few seconds, looped/cut on the beat). */
export const AI_SCENES = 6;

export type LrcLine = { t: number; text: string };

// ---------------------------------------------------------------- lyrics

/** Non-empty lyric lines (section tags like [Chorus] are dropped). */
export function lyricLines(lyrics: string): string[] {
  return lyrics
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l && !/^\[[^\]]*\]$/.test(l))
    .slice(0, 300);
}

/** Parses "[mm:ss.xx] text" (LRC). Lines without a timestamp are ignored; result is sorted. */
export function parseLrc(text: string): LrcLine[] {
  const out: LrcLine[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const stamps = [...raw.matchAll(/\[(\d{1,2}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)];
    if (!stamps.length) continue;
    const words = raw.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim();
    if (!words) continue;
    for (const m of stamps) out.push({ t: Number(m[1]) * 60 + Number(m[2].replace(":", ".")), text: words });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Validates timings coming from the browser: finite, increasing, inside the song, sane length. */
export function cleanLrc(lines: unknown, duration: number): LrcLine[] {
  if (!Array.isArray(lines)) return [];
  const out: LrcLine[] = [];
  let last = -1;
  for (const l of lines.slice(0, 300)) {
    const t = Number((l as LrcLine)?.t);
    const text = String((l as LrcLine)?.text ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (!text || !Number.isFinite(t) || t < 0 || t <= last || (duration > 0 && t > duration)) continue;
    out.push({ t: Math.round(t * 100) / 100, text });
    last = t;
  }
  return out;
}

/** No timings yet: spread the lines evenly over the song (skipping a short intro and outro). */
export function evenLrc(lines: string[], duration: number): LrcLine[] {
  if (!lines.length || duration <= 0) return [];
  const start = Math.min(8, duration * 0.08);
  const end = duration - Math.min(6, duration * 0.05);
  const step = (end - start) / lines.length;
  return lines.map((text, i) => ({ t: Math.round((start + i * step) * 100) / 100, text }));
}

export function toLrc(lines: LrcLine[]) {
  const ts = (t: number) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${(t % 60).toFixed(2).padStart(5, "0")}`;
  return lines.map((l) => `[${ts(l.t)}]${l.text}`).join("\n");
}

/** WebVTT captions for the muted broadcast (TvClip.captions). */
export function lrcToVtt(lines: LrcLine[], duration: number) {
  const ts = (t: number) => {
    const ms = Math.max(0, Math.round(t * 1000));
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
  };
  const cues = lines.map((l, i) => {
    const end = Math.min(lines[i + 1]?.t ?? duration, l.t + 8);
    return `${ts(l.t)} --> ${ts(Math.max(end, l.t + 0.5))}\n♪ ${l.text}`;
  });
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}

// ---------------------------------------------------------------- beats

/**
 * Tempo + beat grid from mono PCM: energy-flux onset envelope, autocorrelation for the period (70–180 BPM,
 * folded toward 90–160), then the phase with the most onset energy. Good enough to cut pictures on the beat.
 */
export function detectBeats(samples: Float32Array, rate: number): { bpm: number; beats: number[] } {
  const hop = Math.max(1, Math.round(rate / 43));
  const fps = rate / hop;
  const n = Math.floor(samples.length / hop);
  const duration = samples.length / rate;
  if (n < fps * 4) return { bpm: 120, beats: grid(0, 0.5, duration) };
  const energy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = i * hop, e = j + hop; j < e; j++) s += samples[j] * samples[j];
    energy[i] = Math.log1p(1000 * Math.sqrt(s / hop));
  }
  const onset = new Float32Array(n);
  for (let i = 1; i < n; i++) onset[i] = Math.max(0, energy[i] - energy[i - 1]);
  // remove the slow trend so loud passages don't dominate
  const win = Math.round(fps);
  let acc = 0;
  const mean = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    acc += onset[i] - (i >= win ? onset[i - win] : 0);
    mean[i] = acc / Math.min(i + 1, win);
  }
  for (let i = 0; i < n; i++) onset[i] = Math.max(0, onset[i] - mean[i]);

  const score = (bpm: number) => {
    const lag = (60 / bpm) * fps;
    const l0 = Math.floor(lag);
    const f = lag - l0;
    let s = 0;
    for (let i = 0; i + l0 + 1 < n; i++) s += onset[i] * (onset[i + l0] * (1 - f) + onset[i + l0 + 1] * f);
    return s;
  };
  let best = 120;
  let bestScore = -1;
  for (let bpm = 70; bpm <= 180; bpm += 0.5) {
    // prefer the usual pop/dance range a little
    const w = bpm >= 90 && bpm <= 160 ? 1 : 0.85;
    const s = score(bpm) * w;
    if (s > bestScore) {
      bestScore = s;
      best = bpm;
    }
  }
  // refine with a comb over several multiples of the period (sharper than one lag)
  const comb = (bpm: number) => {
    let s = 0;
    for (let k = 1; k <= 4; k++) {
      const lag = (60 / bpm) * fps * k;
      for (let i = 0; i + lag + 1 < n; i++) {
        const j = i + lag;
        const j0 = Math.floor(j);
        s += onset[i] * (onset[j0] * (1 - (j - j0)) + onset[j0 + 1] * (j - j0));
      }
    }
    return s;
  };
  let fine = best;
  let fineScore = -1;
  for (let bpm = best - 2; bpm <= best + 2; bpm += 0.1) {
    const s = comb(bpm);
    if (s > fineScore) {
      fineScore = s;
      fine = bpm;
    }
  }
  best = fine;
  const period = 60 / best;
  const lag = period * fps;
  let phase = 0;
  let phaseScore = -1;
  for (let p = 0; p < lag; p++) {
    let s = 0;
    for (let x = p; x < n; x += lag) s += onset[Math.round(x)] ?? 0;
    if (s > phaseScore) {
      phaseScore = s;
      phase = p;
    }
  }
  return { bpm: Math.round(best * 10) / 10, beats: grid(phase / fps, period, duration) };
}

function grid(start: number, period: number, duration: number) {
  const out: number[] = [];
  for (let t = start; t < duration; t += period) out.push(Math.round(t * 1000) / 1000);
  return out;
}

/**
 * Picture cuts that land on beats: every `beatsPerCut` beats (≈ 3–5 s), first cut at 0, last segment ends at the song end.
 * Returns segment lengths that add up to `duration` exactly.
 */
export function beatSegments(beats: number[], duration: number, beatsPerCut = 8): number[] {
  const cuts = [0];
  for (let i = beatsPerCut; i < beats.length; i += beatsPerCut) {
    const t = beats[i];
    if (t - cuts[cuts.length - 1] >= 1.5 && duration - t >= 1.5) cuts.push(t);
  }
  if (cuts.length === 1) for (let t = 4; duration - t >= 1.5; t += 4) cuts.push(t);
  return cuts.map((c, i) => Math.round(((cuts[i + 1] ?? duration) - c) * 1000) / 1000);
}

// ---------------------------------------------------------------- subtitles (ASS)

const assText = (s: string) => s.replace(/\\/g, "∖").replace(/[{}]/g, (c) => (c === "{" ? "(" : ")")).replace(/\n/g, " ");
const assTime = (t: number) => {
  const cs = Math.max(0, Math.round(t * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};

/** Word-by-word karaoke fill: each word gets time in proportion to its length. */
export function karaokeTags(text: string, seconds: number) {
  const words = text.split(" ").filter(Boolean);
  const total = words.reduce((a, w) => a + w.length + 1, 0);
  let used = 0;
  return words
    .map((w, i) => {
      const cs = i === words.length - 1 ? Math.max(1, Math.round(seconds * 100) - used) : Math.max(1, Math.round((seconds * 100 * (w.length + 1)) / total));
      used += cs;
      return `{\\kf${cs}}${assText(w)}`;
    })
    .join(" ");
}

/**
 * Subtitle script for the video: a title card (artist — title) at the start, then the lyrics.
 * KARAOKE: big centered current line with a word-by-word fill and the next line dimmed under it.
 * Other styles: the current line at the bottom like normal subtitles.
 */
export function buildAss(opts: { w: number; h: number; style: MusicStyle; title: string; artist: string; lines: LrcLine[]; duration: number }) {
  const { w, h, style, lines, duration } = opts;
  const big = Math.round(h * (style === "KARAOKE" ? 0.085 : 0.055));
  const vertical = h > w;
  const head = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${w}`,
    `PlayResY: ${h}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    // colours are &HAABBGGRR; accent #ff2e63, mint #3ee6c8
    `Style: Title,Arial,${Math.round(h * 0.075)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,1,0,1,3,2,5,40,40,0,1`,
    `Style: Artist,Arial,${Math.round(h * 0.04)},&H00C8E63E,&H00C8E63E,&H00000000,&H64000000,-1,0,0,0,100,100,3,0,1,2,1,5,40,40,0,1`,
    `Style: Kara,Arial,${big},&H00632EFF,&H00FFFFFF,&H00000000,&H78000000,-1,0,0,0,100,100,0,0,1,${Math.max(2, Math.round(big / 14))},2,5,60,60,0,1`,
    `Style: Next,Arial,${Math.round(big * 0.62)},&H8CFFFFFF,&H8CFFFFFF,&H00000000,&H78000000,0,0,0,0,100,100,0,0,1,2,1,5,60,60,0,1`,
    `Style: Sub,Arial,${big},&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,${Math.max(2, Math.round(big / 16))},2,2,60,60,${Math.round(h * (vertical ? 0.16 : 0.07))},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  const ev: string[] = [];
  const titleEnd = Math.min(5, Math.max(2, (lines[0]?.t ?? 6) - 0.3), duration);
  const cy = Math.round(h * 0.45);
  ev.push(`Dialogue: 2,${assTime(0.3)},${assTime(titleEnd)},Title,,0,0,0,,{\\fad(400,400)\\pos(${w / 2},${cy})}${assText(opts.title)}`);
  if (opts.artist) ev.push(`Dialogue: 2,${assTime(0.6)},${assTime(titleEnd)},Artist,,0,0,0,,{\\fad(400,400)\\pos(${w / 2},${cy + Math.round(h * 0.09)})}${assText(opts.artist)}`);
  lines.forEach((l, i) => {
    const end = Math.min(lines[i + 1]?.t ?? duration, l.t + 8, duration);
    if (end - l.t < 0.2) return;
    if (style === "KARAOKE") {
      const y = Math.round(h * (vertical ? 0.5 : 0.52));
      ev.push(`Dialogue: 1,${assTime(l.t)},${assTime(end)},Kara,,0,0,0,,{\\fad(120,120)\\pos(${w / 2},${y})}${karaokeTags(l.text, Math.max(0.3, (end - l.t) * 0.92))}`);
      const next = lines[i + 1];
      if (next) ev.push(`Dialogue: 0,${assTime(l.t)},${assTime(end)},Next,,0,0,0,,{\\fad(120,120)\\pos(${w / 2},${y + Math.round(big * 1.35)})}${assText(next.text)}`);
    } else {
      ev.push(`Dialogue: 1,${assTime(l.t)},${assTime(end)},Sub,,0,0,0,,{\\fad(150,150)}${assText(l.text)}`);
    }
  });
  return [...head, ...ev].join("\n") + "\n";
}

// ---------------------------------------------------------------- ffmpeg plan

export const FRAME = { HORIZONTAL: [1280, 720], VERTICAL: [720, 1280] } as const;

/**
 * ffmpeg arguments for one music video. Paths are relative to the work dir (the renderer runs ffmpeg there,
 * which keeps the libass path free of drive letters). Inputs: `audio`, optional `cover`, and for SLIDESHOW/AI
 * the visual segments (image or clip file + length).
 */
export function renderArgs(p: {
  style: MusicStyle;
  orientation: "HORIZONTAL" | "VERTICAL";
  duration: number;
  audio: string;
  cover: string | null;
  segments?: { file: string; len: number; video: boolean }[];
  ass: string | null;
  out: string;
}) {
  const [w, h] = FRAME[p.orientation];
  const d = p.duration.toFixed(3);
  const args: string[] = ["-hide_banner", "-loglevel", "error", "-y", "-i", p.audio];
  const f: string[] = [];
  const bg = "bg";
  const segs = (p.style === "SLIDESHOW" || p.style === "AI") && p.segments?.length ? p.segments : null;

  if (segs) {
    segs.forEach((s, i) => {
      const k = i + 1;
      const frames = Math.max(1, Math.round(s.len * 30));
      if (s.video) {
        args.push("-stream_loop", "-1", "-t", s.len.toFixed(3), "-i", s.file);
        f.push(`[${k}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},fps=30,setsar=1,format=yuv420p,trim=duration=${s.len.toFixed(3)},setpts=PTS-STARTPTS[s${i}]`);
      } else {
        args.push("-i", s.file);
        // Ken Burns: alternate zoom-in / zoom-out and the drift direction per picture
        const zin = i % 2 === 0;
        const z = zin ? `min(1+0.12*on/${frames},1.12)` : `max(1.12-0.12*on/${frames},1)`;
        const x = i % 3 === 0 ? "iw/2-(iw/zoom/2)" : i % 3 === 1 ? `(iw-iw/zoom)*on/${frames}` : `(iw-iw/zoom)*(1-on/${frames})`;
        f.push(
          `[${k}:v]scale=${w * 2}:${h * 2}:force_original_aspect_ratio=increase,crop=${w * 2}:${h * 2},setsar=1,zoompan=z='${z}':x='${x}':y='ih/2-(ih/zoom/2)':d=${frames}:s=${w}x${h}:fps=30,format=yuv420p[s${i}]`,
        );
      }
    });
    f.push(`${segs.map((_, i) => `[s${i}]`).join("")}concat=n=${segs.length}:v=1:a=0[bg]`);
  } else if (p.cover) {
    args.push("-loop", "1", "-framerate", "30", "-t", d, "-i", p.cover);
    f.push(`[1:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},gblur=sigma=28,eq=brightness=-0.22:saturation=1.25,setsar=1,format=yuv420p[bgb]`);
    // the sharp cover as a centered "record sleeve" for the visualizer styles
    const side = Math.round(Math.min(w, h) * (p.style === "KARAOKE" ? 0.28 : 0.42));
    const cy = p.style === "KARAOKE" ? Math.round(h * 0.06) : Math.round((h - side) / 2 - h * 0.06);
    f.push(`[1:v]scale=${side}:${side}:force_original_aspect_ratio=increase,crop=${side}:${side},setsar=1[cov]`);
    f.push(`[bgb][cov]overlay=x=(W-w)/2:y=${cy}:shortest=1[bg]`);
  } else {
    f.push(`color=c=0x140a26:s=${w}x${h}:r=30:d=${d},format=yuv420p,noise=alls=6:allf=t[bg]`);
  }

  // audio visualizer layer
  const vw = w;
  const vh = Math.round(h * 0.32);
  const viz: Record<MusicStyle, string | null> = {
    KARAOKE: `[0:a]showwaves=s=${vw}x${Math.round(h * 0.12)}:mode=cline:rate=30:colors=0xff2e63@0.7,format=rgba[viz]`,
    BARS: `[0:a]showfreqs=s=${vw}x${vh}:mode=bar:ascale=log:fscale=log:win_size=1024:averaging=2:colors=0xff2e63|0x7c4dff,format=rgba,colorkey=black:0.08:0[viz]`,
    WAVE: `[0:a]showwaves=s=${vw}x${vh}:mode=cline:rate=30:colors=0x3ee6c8,format=rgba,split[w1][w2];[w2]gblur=sigma=10[w3];[w3][w1]overlay[viz]`,
    // the right channel slightly delayed turns even a mono song into loops instead of a flat line
    CIRCLE: `[0:a]aformat=channel_layouts=stereo,channelsplit[cl][cr];[cr]adelay=3[crd];[cl][crd]join=inputs=2:channel_layout=stereo,avectorscope=s=${Math.round(Math.min(w, h) * 0.8)}x${Math.round(Math.min(w, h) * 0.8)}:mode=lissajous_xy:draw=line:scale=sqrt:zoom=1.6:rc=255:gc=46:bc=99:ac=255:rf=12:gf=12:bf=8:rate=30,format=rgba,colorkey=black:0.05:0[viz]`,
    CQT: `[0:a]showcqt=s=${w}x${Math.round(h * 0.5)}:fps=30:bar_g=3:bar_v=9:sono_h=0:axis=0,format=rgba,colorkey=black:0.04:0[viz]`,
    VHS: `[0:a]showwaves=s=${vw}x${vh}:mode=p2p:rate=30:colors=0xf5f0d8,format=rgba[viz]`,
    SLIDESHOW: `[0:a]showwaves=s=${vw}x${Math.round(h * 0.1)}:mode=cline:rate=30:colors=white@0.55,format=rgba[viz]`,
    AI: null,
  };
  const pos: Record<MusicStyle, string> = {
    KARAOKE: `x=0:y=H-h`,
    BARS: `x=0:y=H-h`,
    WAVE: `x=0:y=(H-h)/2+${Math.round(h * 0.28)}`,
    CIRCLE: `x=(W-w)/2:y=(H-h)/2`,
    CQT: `x=0:y=H-h`,
    VHS: `x=0:y=(H-h)/2`,
    SLIDESHOW: `x=0:y=H-h`,
    AI: "",
  };
  let last = bg;
  const v = viz[p.style];
  if (v) {
    f.push(v);
    f.push(`[${last}][viz]overlay=${pos[p.style]}:shortest=1[v1]`);
    last = "v1";
  }
  if (p.style === "VHS") {
    f.push(`[${last}]noise=alls=22:allf=t,rgbashift=rh=-5:bh=5,eq=saturation=0.75:contrast=1.15,drawgrid=w=iw:h=3:t=1:c=black@0.3[v2]`);
    last = "v2";
  }
  if (p.ass) {
    f.push(`[${last}]ass=${p.ass}[v]`);
    last = "v";
  }
  args.push(
    "-filter_complex", f.join(";"),
    "-map", `[${last}]`, "-map", "0:a",
    "-t", d,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-r", "30",
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    p.out,
  );
  return args;
}

/** A drop: where the track suddenly gets big (bass + loudness jump after a quieter build), and for how long. */
export type Drop = { t: number; len: number };
/** What the TV needs to make the watch buddy rave in time: tempo, first beat, drops. */
export type BeatMap = { bpm: number; beat0: number; drops: Drop[] };

/**
 * Finds drops in mono PCM: a bass-weighted loudness curve (0.25 s frames, ~1 s smoothing), then points where the
 * next 2 s are much louder than the 1–4 s before and loud for this song overall (≥ 80 % of its 70th percentile). At least 16 s apart, at most 6,
 * snapped to the nearest beat. No clear jump → the single biggest one if it's still a real lift.
 */
export function detectDrops(samples: Float32Array, rate: number, beats: number[] = []): Drop[] {
  const frame = Math.max(1, Math.round(rate / 4));
  const n = Math.floor(samples.length / frame);
  if (n < 32) return [];
  // one-pole low-pass ≈ 150 Hz for the bass part
  const a = Math.exp((-2 * Math.PI * 150) / rate);
  let lp = 0;
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let full = 0;
    let bass = 0;
    for (let j = i * frame, end = j + frame; j < end; j++) {
      const x = samples[j];
      lp = (1 - a) * x + a * lp;
      full += x * x;
      bass += lp * lp;
    }
    e[i] = 0.4 * Math.sqrt(full / frame) + 0.6 * Math.sqrt(bass / frame) * 2;
  }
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    let c = 0;
    for (let k = Math.max(0, i - 2); k <= Math.min(n - 1, i + 1); k++, c++) acc += e[k];
    s[i] = acc / c;
  }
  const sorted = Array.from(s).sort((x, y) => x - y);
  const p70 = sorted[Math.floor(sorted.length * 0.7)];
  const peak = sorted[sorted.length - 1] || 1;
  const mean = (from: number, to: number) => {
    let acc = 0;
    let c = 0;
    for (let k = Math.max(0, from); k < Math.min(n, to); k++, c++) acc += s[k];
    return c ? acc / c : 0;
  };
  const cands: { i: number; ratio: number; post: number }[] = [];
  for (let i = 8; i < n - 8; i++) {
    const pre = mean(i - 16, i - 4);
    const post = mean(i, i + 8);
    cands.push({ i, ratio: post / (pre + peak * 0.02), post });
  }
  const pick = (minRatio: number) => {
    const out: typeof cands = [];
    for (const c of [...cands].filter((c) => c.ratio >= minRatio && c.post >= p70 * 0.8).sort((x, y) => y.ratio - x.ratio)) {
      if (out.length >= 6) break;
      if (out.every((o) => Math.abs(o.i - c.i) >= 64)) out.push(c);
    }
    return out;
  };
  let found = pick(1.6);
  if (!found.length) found = pick(1.3).slice(0, 1);
  const snap = (t: number) => {
    let best = t;
    for (const b of beats) if (Math.abs(b - t) < Math.abs(best - t) && Math.abs(b - t) < 0.4) best = b;
    return best;
  };
  return found
    .map(({ i, post }) => {
      // the drop lasts while it stays loud (≥ 70 % of its first seconds), 6–20 s
      let j = i + 8;
      while (j < n && j - i < 80 && s[j] >= post * 0.7) j++;
      const t = snap(i / 4);
      return { t: Math.round(t * 100) / 100, len: Math.max(6, Math.min(20, (j - i) / 4)) };
    })
    .sort((x, y) => x.t - y.t);
}

/** Is `sec` inside a drop? Returns how far into it (0..1) or -1. */
export function dropAt(drops: Drop[], sec: number) {
  for (const d of drops) if (sec >= d.t && sec < d.t + d.len) return (sec - d.t) / d.len;
  return -1;
}

/** Parses a stored beat map; anything malformed → null. */
export function parseBeatMap(json: string | null | undefined): BeatMap | null {
  if (!json) return null;
  try {
    const m = JSON.parse(json) as BeatMap;
    if (!(m.bpm > 0) || !Array.isArray(m.drops)) return null;
    return { bpm: m.bpm, beat0: Number(m.beat0) || 0, drops: m.drops.filter((d) => d.t >= 0 && d.len > 0).slice(0, 8) };
  } catch {
    return null;
  }
}
