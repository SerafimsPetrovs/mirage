/** Manual check (not in CI): renders a synthetic song in every style and saves one frame per style. Run with MUSIC_MANUAL=1. */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { analyzeAudio } from "./music-render";
import { beatSegments, buildAss, evenLrc, MUSIC_STYLES, renderArgs } from "./music-rules";

const OUT = process.env.MUSIC_OUT ?? path.join(process.cwd(), "storage", "tmp", "music-manual");

describe.runIf(process.env.MUSIC_MANUAL === "1")("music render (manual)", () => {
  it("renders every style", { timeout: 600_000 }, async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const ff = ffmpegPath as string;
    const audio = path.join(OUT, "song.mp3");
    // 120 BPM kick + a chord pad, 20 s
    execFileSync(ff, ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "aevalsrc='0.9*sin(2*PI*55*t)*exp(-25*mod(t\\,0.5))+0.3*random(0)*exp(-60*mod(t+0.25\,0.5))+0.15*sin(2*PI*220*t)+0.12*sin(2*PI*277*t)+0.1*sin(2*PI*330*t)+0.1*sin(2*PI*880*t)*(1+sin(2*PI*0.5*t))':s=44100:d=20", "-b:a", "128k", audio]);
    const cover = path.join(OUT, "cover.png");
    execFileSync(ff, ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "mandelbrot=s=800x800", "-frames:v", "1", cover]);
    const { duration, bpm, beats } = await analyzeAudio(audio);
    console.log("duration", duration, "bpm", bpm, "beats", beats.slice(0, 6));
    expect(Math.abs(bpm - 120) < 3 || Math.abs(bpm - 60) < 2).toBe(true);
    const lines = evenLrc(["Ultra mega line number one", "Second line goes here", "And the chorus hits hard", "Last line of the song"], duration);
    for (const style of (process.env.MUSIC_STYLES ? process.env.MUSIC_STYLES.split(",") : MUSIC_STYLES) as typeof MUSIC_STYLES[number][]) {
      const dir = path.join(OUT, style);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "subs.ass"), buildAss({ w: 1280, h: 720, style, title: "Test Song", artist: "MIRAGE Band", lines, duration }));
      const segs = style === "SLIDESHOW" || style === "AI"
        ? beatSegments(beats, duration, 8).map((len, i) => (style === "AI" ? { file: path.join(process.cwd(), "media", "demo", ["h-desert.mp4", "h-ocean.mp4"][i % 2]), len, video: true } : { file: cover, len, video: false }))
        : undefined;
      const out = path.join(dir, "out.mp4");
      const t0 = Date.now();
      execFileSync(ff, renderArgs({ style, orientation: "HORIZONTAL", duration, audio, cover, segments: segs, ass: "subs.ass", out }), { cwd: dir });
      execFileSync(ff, ["-y", "-loglevel", "error", "-ss", "9", "-i", out, "-frames:v", "1", path.join(OUT, `${style}.png`)]);
      console.log(style, "rendered in", Date.now() - t0, "ms");
    }
  });
});
