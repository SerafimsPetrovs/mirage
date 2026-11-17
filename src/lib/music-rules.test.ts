import { describe, expect, it } from "vitest";
import { beatSegments, buildAss, cleanLrc, detectBeats, evenLrc, karaokeTags, lrcToVtt, lyricLines, parseLrc, renderArgs, toLrc } from "./music-rules";

describe("lyrics", () => {
  it("drops empty lines and [Chorus] tags", () => {
    expect(lyricLines("[Verse]\n  hello   world \n\n[Chorus]\nla la\r\n")).toEqual(["hello world", "la la"]);
  });
  it("parses LRC, including repeated stamps, and sorts", () => {
    const l = parseLrc("[ar:Someone]\n[00:12.50]first\n[00:05.00][01:00.00]chorus\nno stamp");
    expect(l).toEqual([
      { t: 5, text: "chorus" },
      { t: 12.5, text: "first" },
      { t: 60, text: "chorus" },
    ]);
    expect(parseLrc(toLrc(l))).toEqual(l);
  });
  it("cleans timings from the browser: increasing, inside the song", () => {
    expect(cleanLrc([{ t: 1, text: "a" }, { t: 0.5, text: "back" }, { t: 2, text: " " }, { t: 3, text: "b" }, { t: 999, text: "late" }, { t: "x", text: "nan" }], 100)).toEqual([
      { t: 1, text: "a" },
      { t: 3, text: "b" },
    ]);
    expect(cleanLrc("nope", 10)).toEqual([]);
  });
  it("spreads untimed lines over the song", () => {
    const l = evenLrc(["a", "b", "c"], 100);
    expect(l).toHaveLength(3);
    expect(l[0].t).toBeGreaterThan(0);
    expect(l[2].t).toBeLessThan(100);
  });
  it("makes WebVTT captions", () => {
    const v = lrcToVtt([{ t: 1, text: "hi" }, { t: 4, text: "yo" }], 10);
    expect(v).toContain("00:00:01.000 --> 00:00:04.000\n♪ hi");
    expect(v.startsWith("WEBVTT")).toBe(true);
  });
});

describe("karaoke subtitles", () => {
  it("word durations add up to the line", () => {
    const tags = karaokeTags("one three fifteen", 3);
    const sum = [...tags.matchAll(/\kf(\d+)/g)].reduce((a, m) => a + Number(m[1]), 0);
    expect(sum).toBe(300);
  });
  it("escapes override braces from user lyrics", () => {
    const ass = buildAss({ w: 1280, h: 720, style: "KARAOKE", title: "T {\b1}", artist: "A", lines: [{ t: 6, text: "x {\pos(0,0)} y" }], duration: 20 });
    expect(ass).not.toContain("{\pos(0,0)}");
    expect(ass.match(/^Dialogue:/gm)?.length).toBe(3);
  });
});

describe("beats", () => {
  it("finds 120 BPM in a click track", () => {
    const rate = 11025;
    const s = new Float32Array(rate * 20);
    for (let t = 0.25; t < 20; t += 0.5) for (let i = 0; i < 300; i++) s[Math.floor(t * rate) + i] = Math.sin(i / 3) * Math.exp(-i / 60);
    const { bpm, beats } = detectBeats(s, rate);
    expect(Math.abs(bpm - 120)).toBeLessThan(1.5);
    expect(Math.abs(beats[1] - beats[0] - 0.5)).toBeLessThan(0.02);
  });
  it("segments add up to the song and cut on beats", () => {
    const beats = Array.from({ length: 80 }, (_, i) => i * 0.5);
    const segs = beatSegments(beats, 40, 8);
    expect(segs.reduce((a, b) => a + b, 0)).toBeCloseTo(40, 3);
    expect(segs[0]).toBe(4);
    expect(beatSegments([], 10).reduce((a, b) => a + b, 0)).toBeCloseTo(10, 3);
  });
});

describe("render plan", () => {
  it("maps video + original audio, burns subtitles, keeps duration", () => {
    const a = renderArgs({ style: "BARS", orientation: "HORIZONTAL", duration: 30, audio: "a.mp3", cover: null, ass: "subs.ass", out: "o.mp4" });
    const fc = a[a.indexOf("-filter_complex") + 1];
    expect(fc).toContain("showfreqs");
    expect(fc).toContain("ass=subs.ass[v]");
    expect(a).toContain("0:a");
    expect(a[a.indexOf("-t") + 1]).toBe("30.000");
  });
  it("slideshow concatenates one input per segment", () => {
    const a = renderArgs({
      style: "SLIDESHOW", orientation: "VERTICAL", duration: 8, audio: "a.mp3", cover: null, ass: null, out: "o.mp4",
      segments: [{ file: "1.jpg", len: 4, video: false }, { file: "2.jpg", len: 4, video: false }],
    });
    expect(a.filter((x) => x === "-i")).toHaveLength(3);
    expect(a[a.indexOf("-filter_complex") + 1]).toContain("concat=n=2");
  });
});
