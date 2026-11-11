import { describe, expect, it } from "vitest";
import { capsRun, detectEmotion, stripTags, tagSegments, TAG_PAUSE_MS, fitTimeline, parseScriptToEmotionalTimeline, pickClip, splitScript, timelineAt, timelineDuration, type MascotClipDTO } from "./mascot";

describe("mascot emotion parser", () => {
  it("reproduces the brief's example timeline", () => {
    const t = parseScriptToEmotionalTimeline("Срочное включение! На третьем канале творится какая-то дичь... А Вася снова слил все монеты в рулетку, ахаха!");
    const spoken = t.filter((x) => x.emotion !== "IDLE");
    expect(spoken.map((x) => x.emotion)).toEqual(["HYPE_EXCITED", "SHOCK_SCARED", "LAUGH_SARCASM"]);
    expect(spoken[0].phrase).toBe("Срочное включение!");
    // IDLE pauses between sentences, not after the last one.
    expect(t.map((x) => x.emotion)).toEqual(["HYPE_EXCITED", "IDLE", "SHOCK_SCARED", "IDLE", "LAUGH_SARCASM"]);
    expect(t.every((x) => x.durationMs >= 300)).toBe(true);
  });

  it("detects anger by caps, ?! and !!! and the lexicon", () => {
    expect(detectEmotion("ЭТО ПРОСТО НЕВОЗМОЖНО терпеть")).toBe("ANGRY_RAGE");
    expect(detectEmotion("Ты серьёзно?!")).toBe("ANGRY_RAGE");
    expect(detectEmotion("Нет!!!")).toBe("ANGRY_RAGE");
    expect(detectEmotion("Какой позорный провал")).toBe("ANGRY_RAGE");
    expect(detectEmotion("I hate this disaster")).toBe("ANGRY_RAGE");
    expect(capsRun("ЭТО ПРОСТО НЕВОЗМОЖНО")).toBe(3);
    expect(capsRun("TV и SCP")).toBe(1);
  });

  it("detects hype, laughter and shock in both languages", () => {
    expect(detectEmotion("Breaking: huge bonus today")).toBe("HYPE_EXCITED");
    expect(detectEmotion("Получилось!")).toBe("HYPE_EXCITED");
    expect(detectEmotion("lol, what a clown")).toBe("LAUGH_SARCASM");
    expect(detectEmotion("Ну конечно, он гений")).toBe("LAUGH_SARCASM");
    expect(detectEmotion("Секретные архивы открыты")).toBe("SHOCK_SCARED");
    expect(detectEmotion("Что это было???")).toBe("SHOCK_SCARED");
    expect(detectEmotion("Nobody expected the ghost")).toBe("SHOCK_SCARED");
  });

  it("falls back to neutral talk", () => {
    expect(detectEmotion("Погода в Москве облачная")).toBe("NEUTRAL_TALK");
    expect(detectEmotion("Next up: a documentary about rivers")).toBe("NEUTRAL_TALK");
  });

  it("forces a tone for every spoken phrase but keeps pauses", () => {
    const t = parseScriptToEmotionalTimeline("Привет. Как дела?", "ANGRY_RAGE");
    expect(t.map((x) => x.emotion)).toEqual(["ANGRY_RAGE", "IDLE", "ANGRY_RAGE"]);
  });

  it("splits long sentences at commas and conjunctions, glues tiny pieces", () => {
    const parts = splitScript("Сегодня в эфире очень длинная новость про инопланетян, которые прилетели на Землю, но решили остаться в баре до утра.");
    expect(parts).toHaveLength(1);
    expect(parts[0].length).toBeGreaterThan(1);
    expect(parts[0].join(" ")).toContain("инопланетян");
    expect(splitScript("")).toEqual([]);
    expect(splitScript("Без точки в конце")).toEqual([["Без точки в конце"]]);
  });

  it("finds the phrase at a moment and stretches to the audio length", () => {
    const t = parseScriptToEmotionalTimeline("Раз. Два.");
    const total = timelineDuration(t);
    expect(timelineAt(t, 0)?.index).toBe(0);
    expect(timelineAt(t, t[0].durationMs + 1)?.item.emotion).toBe("IDLE");
    expect(timelineAt(t, total)).toBeNull();
    const fit = fitTimeline(t, total * 2);
    expect(Math.abs(timelineDuration(fit) - total * 2)).toBeLessThan(5);
  });

  it("picks clips inside the emotion without repeating and falls back", () => {
    const bank: MascotClipDTO[] = [
      { id: "a", emotion: "HYPE_EXCITED", url: "a", durationMs: 800 },
      { id: "b", emotion: "HYPE_EXCITED", url: "b", durationMs: 800 },
      { id: "n", emotion: "NEUTRAL_TALK", url: "n", durationMs: 800 },
    ];
    for (let i = 0; i < 10; i++) expect(pickClip(bank, "HYPE_EXCITED", "a", Math.random)?.id).toBe("b");
    expect(pickClip(bank, "ANGRY_RAGE", null, () => 0)?.id).toBe("n");
    expect(pickClip(bank, "GLITCH_TRANSITION", null, () => 0)).toBeNull();
    expect(pickClip([], "IDLE", null, () => 0)).toBeNull();
  });

  it("detects love, sadness and confusion", () => {
    expect(detectEmotion("Я вас обожаю, спасибо!")).toBe("LOVE");
    expect(detectEmotion("К сожалению, сериал закрыли")).toBe("SAD");
    expect(detectEmotion("Хм, а зачем он это сделал?")).toBe("CONFUSED");
    expect(detectEmotion("Ты серьёзно?!")).toBe("ANGRY_RAGE");
  });

  it("inline [tags] set the emotion until the next tag; [pause] adds silence", () => {
    const t = parseScriptToEmotionalTimeline("[злится] Это провал. Совсем. [смеётся] Шучу! [пауза] [love] Люблю вас");
    const spoken = t.filter((x) => x.phrase);
    expect(spoken.map((x) => x.emotion)).toEqual(["ANGRY_RAGE", "ANGRY_RAGE", "LAUGH_SARCASM", "LOVE"]);
    expect(spoken.map((x) => x.phrase)).toEqual(["Это провал.", "Совсем.", "Шучу!", "Люблю вас"]);
    expect(t.some((x) => x.emotion === "IDLE" && x.durationMs === TAG_PAUSE_MS)).toBe(true);
    // a tag beats the forced tone; unknown tags are dropped silently
    expect(parseScriptToEmotionalTimeline("[sad] Bye [wat] friends", "HYPE_EXCITED")[0].emotion).toBe("SAD");
    expect(tagSegments("[wat] hi")).toEqual([{ emotion: null, text: " hi", pause: false }]);
    expect(stripTags("[angry] Hi  [pause] there")).toBe("Hi there");
  });
});
