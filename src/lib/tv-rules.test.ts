import { describe, expect, it } from "vitest";
import {
  BREAK_EVERY_SEC,
  CHART_SIZE,
  DAY_SEC,
  channelVisible,
  chatTextProblem,
  hostText,
  ideaProblem,
  loopedPosition,
  parseHostLines,
  planDay,
  seededRandom,
  slotOffset,
  tickerTextProblem,
  type ProgramItem,
} from "./tv-rules";

const programs: ProgramItem[] = [
  { type: "CLIP", id: "c1", durationSec: 40, title: "Clip one" },
  { type: "CLIP", id: "c2", durationSec: 70, title: "Clip two" },
  { type: "EPISODE", id: "e1", durationSec: 90, title: "Series · 1" },
];

function contiguous(slots: { offsetSec: number; durationSec: number }[]) {
  let t = 0;
  for (const s of slots) {
    if (s.offsetSec !== t) return false;
    t += s.durationSec;
  }
  return t === DAY_SEC;
}

describe("planDay", () => {
  it("fills exactly 24 hours without gaps or overlaps", () => {
    const day = planDay({ seed: "absurd:2026-11-09", programs });
    expect(contiguous(day)).toBe(true);
  });

  it("is deterministic for the same seed and differs between days", () => {
    const a = planDay({ seed: "x:2026-11-09", programs });
    const b = planDay({ seed: "x:2026-11-09", programs });
    const c = planDay({ seed: "x:2026-11-10", programs });
    expect(a).toEqual(b);
    expect(a.slice(0, 30).map((s) => s.clipId ?? s.episodeId)).not.toEqual(c.slice(0, 30).map((s) => s.clipId ?? s.episodeId));
  });

  it("puts a host bumper right before every catalog episode", () => {
    const day = planDay({ seed: "s", programs });
    day.forEach((s, i) => {
      if (s.kind === "EPISODE") expect(day[i - 1].kind).toBe("HOST");
    });
  });

  it("has an ad break at least every 15 minutes (plus one programme)", () => {
    const day = planDay({ seed: "s", programs });
    const breaks = day.filter((s) => s.kind === "BREAK").map((s) => s.offsetSec);
    expect(breaks[0]).toBeLessThan(BREAK_EVERY_SEC + 200);
    for (let i = 1; i < breaks.length; i++) expect(breaks[i] - breaks[i - 1]).toBeLessThan(BREAK_EVERY_SEC + 200);
  });

  it("can switch ad breaks off", () => {
    expect(planDay({ seed: "s", programs, breaks: false }).some((s) => s.kind === "BREAK")).toBe(false);
  });

  it("an empty channel is a test card all day", () => {
    const day = planDay({ seed: "s", programs: [] });
    expect(day.every((s) => s.kind === "HOST" && s.hostLine === -1)).toBe(true);
    expect(contiguous(day)).toBe(true);
  });

  it("music charts count down from the lowest place to number one", () => {
    const chart = Array.from({ length: 12 }, (_, i) => ({ id: `m${i + 1}`, durationSec: 60, title: `Song ${i + 1}` }));
    const day = planDay({ seed: "music", programs, chart });
    const i = day.findIndex((s) => s.kind === "CHART");
    expect(i).toBeGreaterThanOrEqual(0);
    const places = day.slice(i + 1, i + 1 + CHART_SIZE).map((s) => s.chartPlace);
    expect(places).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(day[i + CHART_SIZE].clipId).toBe("m1");
  });

  it("clamps silly durations", () => {
    const day = planDay({ seed: "s", programs: [{ type: "CLIP", id: "z", durationSec: 0, title: "Zero" }], breaks: false });
    expect(day.filter((s) => s.kind === "CLIP").every((s) => s.durationSec >= 5)).toBe(true);
  });
});

describe("timing", () => {
  it("offset is clamped to the slot", () => {
    expect(slotOffset(1000, 10, 500)).toBe(0);
    expect(slotOffset(1000, 10, 6000)).toBe(5);
    expect(slotOffset(1000, 10, 60_000)).toBe(10);
  });
  it("short videos loop inside a long slot", () => {
    expect(loopedPosition(25, 10)).toBe(5);
    expect(loopedPosition(25, 0)).toBe(0);
  });
  it("seeded random is stable", () => {
    const r1 = seededRandom("a");
    const r2 = seededRandom("a");
    expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()]);
  });
});

describe("visibility", () => {
  const normal = { familyOnly: false, isAdult: false, active: true };
  const kids = { familyOnly: true, isAdult: false, active: true };
  const night = { familyOnly: false, isAdult: true, active: true };
  it("family mode sees only family channels", () => {
    const v = { kids: true, adult: false };
    expect([normal, kids, night].map((c) => channelVisible(c, v))).toEqual([false, true, false]);
  });
  it("18+ channel needs 18+ mode; family channel is hidden for grown-ups", () => {
    expect([normal, kids, night].map((c) => channelVisible(c, { kids: false, adult: false }))).toEqual([true, false, false]);
    expect(channelVisible(night, { kids: false, adult: true })).toBe(true);
    expect(channelVisible({ ...normal, active: false }, { kids: false, adult: true })).toBe(false);
  });
});

describe("host lines", () => {
  it("skips lines about the previous show when there is none", () => {
    expect(hostText(["After {prev} comes {next}", "Now: {next}"], 0, "", "B")).toBe("Now: B");
    expect(hostText(["After {prev} comes {next}"], 0, "A", "B")).toBe("After A comes B");
  });
  it("parses the showrunner JSON and rejects junk", () => {
    const ok = JSON.stringify({ ru: ["а {next}", "б {next}", "в {next}", "г {next}"], en: ["a {next}", "b {next}", "c {next}", "d {next}", "no placeholder"] });
    expect(parseHostLines(`Sure! ${ok}`)?.en).toHaveLength(4);
    expect(parseHostLines("nope")).toBeNull();
    expect(parseHostLines(JSON.stringify({ ru: ["{next}"], en: ["{next}"] }))).toBeNull();
  });
});

describe("text filters", () => {
  it("chat: links and slurs are blocked, normal talk is fine", () => {
    expect(chatTextProblem("лол что это было 😂")).toBeNull();
    expect(chatTextProblem("go to www.spam.com")).toBe("links");
    expect(chatTextProblem("join t.me/xxx")).toBe("links");
    expect(chatTextProblem("   ")).toBe("empty");
    expect(chatTextProblem("x".repeat(201))).toBe("too_long");
    expect(chatTextProblem("my kids love this channel")).toBeNull();
  });
  it("ticker is stricter than chat", () => {
    expect(tickerTextProblem("Привет Маше из Риги ❤️")).toBeNull();
    expect(tickerTextProblem("сука привет")).toBe("banned");
    expect(chatTextProblem("сука привет")).toBeNull();
    expect(tickerTextProblem("x".repeat(81))).toBe("too_long");
  });
  it("order ideas", () => {
    expect(ideaProblem("Реклама зубной пасты для драконов")).toBeNull();
    expect(ideaProblem("abc")).toBe("empty");
    expect(ideaProblem("nude underage teen")).toBe("banned");
  });
});

describe("no repeats", () => {
  it("never airs the same programme twice in a row", () => {
    const two: ProgramItem[] = [
      { type: "CLIP", id: "a", durationSec: 30, title: "a" },
      { type: "CLIP", id: "b", durationSec: 30, title: "b" },
    ];
    const ids = planDay({ seed: "rep", programs: two, breaks: false })
      .filter((s) => s.kind === "CLIP")
      .map((s) => s.clipId);
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
  });
});

import { gameVerdict, pollWinner, QUIZ_EVERY_SEC, shuffledQuiz, superchatTier, watchCredit, watchRewardsDue } from "./tv-rules";

describe("v2 rules", () => {
  it("quiz every half hour when enabled; a forced first programme airs right away", () => {
    const day = planDay({ seed: "q", programs, quiz: true });
    const quizzes = day.filter((s) => s.kind === "QUIZ");
    expect(quizzes.length).toBeGreaterThanOrEqual(DAY_SEC / QUIZ_EVERY_SEC - 2);
    expect(quizzes.map((q) => q.quizIndex)).toEqual(quizzes.map((_, i) => i));
    const first = { type: "CLIP" as const, id: "winner", durationSec: 30, title: "winner" };
    const rest = planDay({ seed: "q", programs, startSec: 5000, first });
    expect(rest[0].kind).toBe("HOST");
    expect(rest[1].clipId).toBe("winner");
    expect(rest[0].offsetSec).toBe(5000);
  });

  it("watch credit ignores spam and long gaps; rewards every 10 minutes", () => {
    expect(watchCredit(null, 1000)).toBe(0);
    expect(watchCredit(0, 10_000)).toBe(0);
    expect(watchCredit(0, 60_000)).toBe(60);
    expect(watchCredit(0, 120_000)).toBe(90);
    expect(watchCredit(0, 600_000)).toBe(0);
    expect(watchRewardsDue(599, 0)).toBe(0);
    expect(watchRewardsDue(1250, 0)).toBe(2);
    expect(watchRewardsDue(1250, 2)).toBe(0);
  });

  it("mini game needs a real round and a human score", () => {
    expect(gameVerdict(0, 5_000, 10)).toBe("too_fast");
    expect(gameVerdict(0, 21_000, 12)).toBe("ok");
    expect(gameVerdict(0, 21_000, 999)).toBe("cheat");
    expect(gameVerdict(0, 21_000, 1.5)).toBe("cheat");
    expect(gameVerdict(0, 10 * 60_000, 12)).toBe("too_late");
  });

  it("poll winner: most votes, ties to the first", () => {
    expect(pollWinner([1, 5, 2])).toBe(1);
    expect(pollWinner([3, 3, 0])).toBe(0);
    expect(pollWinner([0, 0, 0])).toBe(0);
  });

  it("shuffled quiz keeps the right answer right", () => {
    const q = { options: ["a", "b", "c", "d"], correct: 2 };
    for (const seed of ["1", "2", "3", "4", "5"]) {
      const s = shuffledQuiz(q, seed);
      expect(s.options[s.correct]).toBe("c");
      expect([...s.options].sort()).toEqual(["a", "b", "c", "d"]);
    }
  });

  it("super chat tiers", () => {
    expect(superchatTier(10)).toBeNull();
    expect(superchatTier(30)?.pinSec).toBe(60);
    expect(superchatTier(150)?.coins).toBe(100);
    expect(superchatTier(300)?.coins).toBe(300);
  });
});
