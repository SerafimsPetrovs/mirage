// The MIRAGE mascot ("Mr. Static"): a reporter whose mouth is hidden behind a gas mask, so no lip-sync is needed.
// This module is pure (shared by server and client): the emotion lexicon parser and the clip-bank helpers.

export const EMOTIONS = ["IDLE", "NEUTRAL_TALK", "HYPE_EXCITED", "ANGRY_RAGE", "LAUGH_SARCASM", "SHOCK_SCARED", "LOVE", "SAD", "CONFUSED", "GLITCH_TRANSITION"] as const;
export type Emotion = (typeof EMOTIONS)[number];
/** Emotions an admin can force for a whole script. */
export const TONES = ["AUTO", "ANGRY_RAGE", "HYPE_EXCITED", "LAUGH_SARCASM", "SHOCK_SCARED", "LOVE", "SAD", "CONFUSED"] as const;
export type Tone = (typeof TONES)[number];

export type TimelineItem = { phrase: string; emotion: Emotion; durationMs: number };

/** Speech speed used to estimate phrase length (≈ 14 characters per second, like a TV host). */
export const MS_PER_CHAR = 70;
export const PHRASE_BASE_MS = 200;
export const MIN_PHRASE_MS = 600;
export const PAUSE_MS = 350;
/** Sentences longer than this are cut at commas / conjunctions so emotions can change mid-sentence. */
const LONG_PHRASE = 70;

// Stems (prefix match on words) and multi-word phrases (substring match), RU + EN.
type Scored = "ANGRY_RAGE" | "HYPE_EXCITED" | "LAUGH_SARCASM" | "SHOCK_SCARED" | "LOVE" | "SAD" | "CONFUSED";

const LEXICON: Record<Scored, { stems: string[]; phrases: string[] }> = {
  ANGRY_RAGE: {
    stems: ["бесит", "бесят", "ужас", "провал", "сгорел", "сгорает", "трэш", "треш", "жесть", "жёстк", "жестк", "атак", "скандал", "уничтож", "бля", "сук", "ненавиж", "позор", "достал", "бред", "кошмар", "тупо", "идиот",
      "wtf", "angry", "crazy", "destroy", "hate", "furious", "disaster", "outrage", "scandal", "damn", "shame", "rage", "idiot", "stupid"],
    phrases: ["какого хрена", "какого черта", "какого чёрта", "what the hell", "are you kidding"],
  },
  HYPE_EXCITED: {
    stems: ["срочн", "бомб", "пушк", "баунти", "халяв", "монет", "джекпот", "крут", "невероятн", "рекорд", "топ", "эксклюзив", "поздравля", "раздач", "огонь", "ура", "побед", "приз", "бонус", "премьер", "супер",
      "win", "hype", "breaking", "bonus", "jackpot", "awesome", "amazing", "incredible", "record", "exclusive", "congrat", "giveaway", "epic", "premiere", "huge", "free"],
    phrases: ["прямо сейчас", "только сегодня", "right now", "only today", "big news"],
  },
  LAUGH_SARCASM: {
    stems: ["ахах", "хаха", "хех", "лол", "рофл", "смешн", "прикол", "шутк", "шучу", "клоун", "угар", "ржу", "ирони", "гени",
      "lol", "lmao", "rofl", "haha", "funny", "joke", "joking", "meme", "clown", "hilarious", "genius", "sarcas"],
    phrases: ["ну конечно", "ну да", "конечно же", "как всегда", "oh sure", "yeah right", "of course"],
  },
  SHOCK_SCARED: {
    stems: ["страшн", "страх", "крипов", "жутк", "секретн", "аномал", "труп", "призрак", "шок", "внезапн", "мистик", "тьм", "кровь", "пропал", "исчез", "тревог", "ужасающ",
      "creepy", "scp", "shock", "dead", "secret", "ghost", "anomal", "scary", "horror", "corpse", "vanish", "missing", "dark", "whisper", "haunt"],
    phrases: ["никто не ожидал", "не может быть", "nobody expected", "no one expected", "can't be"],
  },
  LOVE: {
    stems: ["люблю", "любим", "обожа", "мил", "сердеч", "нежн", "поцел", "спасиб", "обнима", "красот",
      "love", "lovely", "cute", "adore", "heart", "sweet", "kiss", "thank", "hug", "darling"],
    phrases: ["от всего сердца", "with all my heart"],
  },
  SAD: {
    stems: ["грус", "жаль", "печал", "увы", "плач", "слёз", "слез", "одинок", "тоск", "прощай", "потеря",
      "sad", "sorry", "unfortunately", "cry", "tears", "lonely", "miss", "goodbye", "lost"],
    phrases: ["к сожалению", "мне жаль", "so sad"],
  },
  CONFUSED: {
    stems: ["странн", "непонятн", "хм", "зачем", "почему", "запутал", "озадач",
      "weird", "strange", "confus", "hmm", "why", "huh", "puzzl"],
    phrases: ["как так", "что происходит", "не понял", "wait what", "what is going on"],
  },
};

/** Tie-breaker: the stronger emotion wins when scores are equal. */
const PRIORITY: Emotion[] = ["ANGRY_RAGE", "SHOCK_SCARED", "SAD", "LOVE", "LAUGH_SARCASM", "CONFUSED", "HYPE_EXCITED"];

function words(text: string) {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** Longest run of fully upper-case words (2+ letters) — "SHOUTING IN CAPS". */
export function capsRun(text: string) {
  let best = 0;
  let run = 0;
  for (const w of text.split(/\s+/)) {
    const letters = w.replace(/[^\p{L}]/gu, "");
    if (letters.length >= 2 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) best = Math.max(best, ++run);
    else if (letters.length) run = 0;
  }
  return best;
}

/** Scores of every emotion for one phrase (exported for tests and the admin preview). */
export function emotionScores(phrase: string) {
  const low = ` ${phrase.toLowerCase().replace(/\s+/g, " ")} `;
  const ws = words(phrase);
  const score: Record<string, number> = { ANGRY_RAGE: 0, HYPE_EXCITED: 0, LAUGH_SARCASM: 0, SHOCK_SCARED: 0, LOVE: 0, SAD: 0, CONFUSED: 0 };
  const hitWeight = { ANGRY_RAGE: 3, SHOCK_SCARED: 3, LAUGH_SARCASM: 3, HYPE_EXCITED: 2, LOVE: 3, SAD: 3, CONFUSED: 2 } as const;
  for (const [emotion, lex] of Object.entries(LEXICON) as [keyof typeof LEXICON, (typeof LEXICON)[keyof typeof LEXICON]][]) {
    for (const w of ws) if (lex.stems.some((s) => w.startsWith(s))) score[emotion] += hitWeight[emotion];
    for (const p of lex.phrases) if (low.includes(p)) score[emotion] += hitWeight[emotion];
  }
  if (capsRun(phrase) > 2) score.ANGRY_RAGE += 3;
  if (/\?!|!\?/.test(phrase)) score.ANGRY_RAGE += 2;
  if (/!!!/.test(phrase)) score.ANGRY_RAGE += 2;
  else if (/!/.test(phrase)) score.HYPE_EXCITED += 1;
  if (/\.\.\.|…/.test(phrase)) score.SHOCK_SCARED += 2;
  if (/\?\?\?/.test(phrase)) score.SHOCK_SCARED += 2;
  // A plain question (not "?!" or "???") sounds puzzled.
  if (/(?<![?!])\?(?![?!])/.test(phrase)) score.CONFUSED += 1;
  return score;
}

export function detectEmotion(phrase: string): Emotion {
  const score = emotionScores(phrase);
  let best: Emotion = "NEUTRAL_TALK";
  let max = 0;
  for (const e of PRIORITY) {
    if (score[e] > max) {
      best = e;
      max = score[e];
    }
  }
  return best;
}

export function phraseDuration(phrase: string) {
  return Math.max(MIN_PHRASE_MS, PHRASE_BASE_MS + phrase.length * MS_PER_CHAR);
}

/** Sentences (punctuation kept), long ones cut at commas, dashes and conjunctions. */
export function splitScript(text: string): string[][] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?…]+(?:[.!?…]+|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [clean];
  return sentences.map((s) => {
    if (s.length <= LONG_PHRASE) return [s];
    const parts = s.split(/(?<=[,;:—–])\s+|\s+(?=(?:но|а|однако|зато|but|and then|so|however)\s)/i).map((p) => p.trim()).filter(Boolean);
    // Glue tiny pieces to the previous one ("ну, да, …" shouldn't make 3-word phrases).
    const out: string[] = [];
    for (const p of parts) {
      if (out.length && (p.length < 18 || out[out.length - 1].length < 18)) out[out.length - 1] += ` ${p}`;
      else out.push(p);
    }
    return out;
  });
}

/**
 * Inline emotion tags, like ElevenLabs audio tags: "[злится] Это провал. [смеётся] Шучу!" — a tag sets the
 * emotion of everything after it until the next tag; [pause] / [пауза] inserts a short silence.
 */
export const EMOTION_TAGS: Record<string, Emotion> = {
  angry: "ANGRY_RAGE", rage: "ANGRY_RAGE", mad: "ANGRY_RAGE", shouts: "ANGRY_RAGE", yells: "ANGRY_RAGE",
  злится: "ANGRY_RAGE", злой: "ANGRY_RAGE", злость: "ANGRY_RAGE", ярость: "ANGRY_RAGE", кричит: "ANGRY_RAGE", орёт: "ANGRY_RAGE",
  hype: "HYPE_EXCITED", excited: "HYPE_EXCITED", happy: "HYPE_EXCITED", cheers: "HYPE_EXCITED",
  хайп: "HYPE_EXCITED", радостно: "HYPE_EXCITED", восторг: "HYPE_EXCITED", радуется: "HYPE_EXCITED",
  laughs: "LAUGH_SARCASM", laugh: "LAUGH_SARCASM", sarcastic: "LAUGH_SARCASM", giggles: "LAUGH_SARCASM",
  смеётся: "LAUGH_SARCASM", смеется: "LAUGH_SARCASM", смех: "LAUGH_SARCASM", сарказм: "LAUGH_SARCASM", ирония: "LAUGH_SARCASM",
  shock: "SHOCK_SCARED", shocked: "SHOCK_SCARED", scared: "SHOCK_SCARED", gasps: "SHOCK_SCARED", creepy: "SHOCK_SCARED",
  шок: "SHOCK_SCARED", страх: "SHOCK_SCARED", испуганно: "SHOCK_SCARED", ахает: "SHOCK_SCARED", жутко: "SHOCK_SCARED",
  love: "LOVE", loving: "LOVE", flirty: "LOVE", tender: "LOVE",
  любовь: "LOVE", нежно: "LOVE", влюблённо: "LOVE", влюбленно: "LOVE", флирт: "LOVE",
  sad: "SAD", sighs: "SAD", cries: "SAD", crying: "SAD",
  грустно: "SAD", грусть: "SAD", вздыхает: "SAD", плачет: "SAD",
  confused: "CONFUSED", thinking: "CONFUSED", hmm: "CONFUSED", puzzled: "CONFUSED",
  растерянно: "CONFUSED", думает: "CONFUSED", недоумение: "CONFUSED", озадаченно: "CONFUSED",
  neutral: "NEUTRAL_TALK", calm: "NEUTRAL_TALK", спокойно: "NEUTRAL_TALK", нейтрально: "NEUTRAL_TALK",
};
const PAUSE_TAGS = new Set(["pause", "пауза", "beat"]);
export const TAG_PAUSE_MS = 700;

/** Removes [tags] (for captions and plain text). */
export function stripTags(text: string) {
  return text.replace(/\[[^\]\n]{1,24}\]/g, " ").replace(/\s+/g, " ").trim();
}

/** Splits a script into segments with the emotion set by an inline tag (null = detect automatically). */
export function tagSegments(text: string): { emotion: Emotion | null; text: string; pause: boolean }[] {
  const out: { emotion: Emotion | null; text: string; pause: boolean }[] = [];
  let current: Emotion | null = null;
  let last = 0;
  const re = /\[([^\]\n]{1,24})\]/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const before = text.slice(last, m.index);
    if (before.trim()) out.push({ emotion: current, text: before, pause: false });
    const tag = m[1].trim().toLowerCase();
    if (PAUSE_TAGS.has(tag)) out.push({ emotion: "IDLE", text: "", pause: true });
    else if (EMOTION_TAGS[tag]) current = EMOTION_TAGS[tag];
    last = m.index + m[0].length;
  }
  const rest = text.slice(last);
  if (rest.trim()) out.push({ emotion: current, text: rest, pause: false });
  return out;
}

/**
 * Turns the host's script into an emotional timeline for the DynamicMascotPlayer — no LLM, deterministic,
 * microseconds per call. IDLE pauses go between sentences. Inline [tags] win; then `tone` (forced for the whole
 * script); otherwise the lexicon decides per phrase.
 */
export function parseScriptToEmotionalTimeline(text: string, tone: Tone = "AUTO"): TimelineItem[] {
  const out: TimelineItem[] = [];
  const segments = tagSegments(text);
  segments.forEach((seg, si) => {
    if (seg.pause) {
      out.push({ phrase: "", emotion: "IDLE", durationMs: TAG_PAUSE_MS });
      return;
    }
    const sentences = splitScript(seg.text);
    sentences.forEach((phrases, i) => {
      for (const phrase of phrases) {
        const emotion = seg.emotion ?? (tone === "AUTO" ? detectEmotion(phrase) : tone);
        out.push({ phrase, emotion, durationMs: phraseDuration(phrase) });
      }
      const lastSentence = i === sentences.length - 1;
      const nextIsPause = segments[si + 1]?.pause;
      if (!lastSentence || (si < segments.length - 1 && !nextIsPause && /[.!?…]$/.test(phrases[phrases.length - 1] ?? ""))) out.push({ phrase: "", emotion: "IDLE", durationMs: PAUSE_MS });
    });
  });
  while (out.length && out[out.length - 1].emotion === "IDLE" && !out[out.length - 1].phrase && out[out.length - 1].durationMs === PAUSE_MS) out.pop();
  return out;
}

export function timelineDuration(t: TimelineItem[]) {
  return t.reduce((a, x) => a + x.durationMs, 0);
}

/** Which phrase is playing `ms` after the start (null = finished). */
export function timelineAt(t: TimelineItem[], ms: number): { index: number; item: TimelineItem; into: number } | null {
  let acc = 0;
  for (let i = 0; i < t.length; i++) {
    if (ms < acc + t[i].durationMs) return { index: i, item: t[i], into: ms - acc };
    acc += t[i].durationMs;
  }
  return null;
}

/** Stretches a timeline to a real audio length (server TTS), keeping proportions. */
export function fitTimeline(t: TimelineItem[], totalMs: number): TimelineItem[] {
  const cur = timelineDuration(t);
  if (!cur || !(totalMs > 0)) return t;
  const k = totalMs / cur;
  return t.map((x) => ({ ...x, durationMs: Math.round(x.durationMs * k) }));
}

export type MascotClipDTO = { id: string; emotion: Emotion; url: string; durationMs: number };

/**
 * Next micro-clip inside an emotion: random, but never the same clip twice in a row (when there is a choice).
 * Falls back to NEUTRAL_TALK, then IDLE clips when the bank has none for this emotion.
 */
export function pickClip(bank: MascotClipDTO[], emotion: Emotion, prevId: string | null, rnd: () => number): MascotClipDTO | null {
  const order: Emotion[] = emotion === "GLITCH_TRANSITION" ? ["GLITCH_TRANSITION"] : [emotion, "NEUTRAL_TALK", "IDLE"];
  for (const e of order) {
    const pool = bank.filter((c) => c.emotion === e);
    if (!pool.length) continue;
    const fresh = pool.length > 1 ? pool.filter((c) => c.id !== prevId) : pool;
    return fresh[Math.floor(rnd() * fresh.length) % fresh.length];
  }
  return null;
}

/** Seconds between cuts inside one emotion: 0.5–1.0 s (calmer when idle). */
export function nextCutMs(emotion: Emotion, rnd: () => number) {
  return emotion === "IDLE" ? 900 + rnd() * 600 : 500 + rnd() * 500;
}

/** Probability that a cut is covered by a short glitch transition. */
export const GLITCH_CHANCE = 0.22;
export const GLITCH_MS = 200;
