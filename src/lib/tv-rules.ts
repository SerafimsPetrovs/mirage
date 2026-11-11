// Pure rules of MIRAGE TV: schedule building, host lines, text filters, prices. No DB, no server-only — unit tested.
import { checkPrompt } from "./generation";

/** Sexual content together with minors (the hard platform rule shared with generation). */
function forbidden(t: string) {
  const c = checkPrompt(t.slice(0, 900));
  return !c.ok && c.reason === "forbidden";
}

export const TV_ORDER_PRICE = 100;
export const TV_ORDER_MAX_OPEN = 3;
export const TV_IDEA_MAX = 300;
export const TV_TICKER_PRICE = 10;
export const TV_TICKER_MAX = 80;
/** How long a paid greeting keeps crawling in the ticker. */
export const TV_TICKER_SHOW_MIN = 30;
export const TV_CHAT_MAX = 200;
export const TV_CHAT_PER_MIN = 6;
export const TV_CHAT_HIDE_AFTER_REPORTS = 3;

export const HOST_SEC = 8;
export const CHART_INTRO_SEC = 12;
export const BREAK_SEC = 30;
/** A host bumper at least this often (and always before a catalog episode). */
export const HOST_EVERY_SEC = 180;
export const BREAK_EVERY_SEC = 15 * 60;
export const CHART_EVERY_SEC = 3 * 3600;
export const CHART_SIZE = 10;
export const DAY_SEC = 86_400;
/** Number of host lines the showrunner writes per channel-day (reused with different titles). */
export const HOST_LINES = 12;
export const QUIZ_SEC = 25;
export const QUIZ_EVERY_SEC = 30 * 60;

export const CHANNEL_KINDS = ["ABSURD", "DOCS", "DARK", "MUSIC", "CHILL", "SERIES", "KIDS", "NIGHT"] as const;
export type ChannelKind = (typeof CHANNEL_KINDS)[number];
export const CLIP_KINDS = ["SHOW", "BUMPER", "AD", "MUSIC"] as const;
export type ClipKind = (typeof CLIP_KINDS)[number];
export type SlotKind = "CLIP" | "EPISODE" | "HOST" | "BREAK" | "CHART" | "QUIZ";

// ───────────── visibility ─────────────

export type TvViewer = { kids: boolean; adult: boolean };

/** Family mode sees only family channels; family channels are hidden otherwise; 18+ channels need 18+ mode. */
export function channelVisible(ch: { familyOnly: boolean; isAdult: boolean; active: boolean }, v: TvViewer) {
  if (!ch.active) return false;
  if (v.kids) return ch.familyOnly;
  if (ch.familyOnly) return false;
  return !ch.isAdult || v.adult;
}

// ───────────── deterministic randomness ─────────────

function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 seeded by a string: the same channel+day gives the same schedule on every server. */
export function seededRandom(seed: string) {
  let a = hashString(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: readonly T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ───────────── schedule ─────────────

export type ProgramItem = { type: "CLIP" | "EPISODE"; id: string; durationSec: number; title: string };
export type ChartItem = { id: string; durationSec: number; title: string };

export type PlannedSlot = {
  offsetSec: number;
  durationSec: number;
  kind: SlotKind;
  clipId?: string;
  episodeId?: string;
  /** HOST/CHART: index into the host lines; CLIP in a chart: place (10…1). */
  hostLine?: number;
  /** QUIZ: running number of the quiz that day (picks the question). */
  quizIndex?: number;
  chartPlace?: number;
  prevTitle?: string;
  nextTitle?: string;
};

const clampDur = (d: number) => Math.max(5, Math.min(Math.round(d) || 30, 3 * 3600));

/**
 * Plans a whole UTC day of a channel (offsets from 00:00, contiguous, ends exactly at 24:00).
 * Programs are shuffled per day and repeated; a host bumper runs every HOST_EVERY_SEC and before every catalog
 * episode; an ad break every BREAK_EVERY_SEC; music channels get a Top-10 countdown every CHART_EVERY_SEC.
 * With no content at all the day is one long "test card" (HOST slots with no programme).
 */
export function planDay(opts: {
  seed: string;
  programs: ProgramItem[];
  chart?: ChartItem[];
  breaks?: boolean;
  startSec?: number;
  /** Hosts a quiz every QUIZ_EVERY_SEC. */
  quiz?: boolean;
  /** Rebuild after a viewer vote / admin break-in: this programme airs first. */
  first?: ProgramItem;
}): PlannedSlot[] {
  const rnd = seededRandom(opts.seed);
  const out: PlannedSlot[] = [];
  /** Rebuilding the rest of today starts mid-day. */
  let t = Math.max(0, Math.min(DAY_SEC, Math.floor(opts.startSec ?? 0)));
  const push = (s: Omit<PlannedSlot, "offsetSec">) => {
    if (t >= DAY_SEC) return;
    const durationSec = Math.min(s.durationSec, DAY_SEC - t);
    out.push({ ...s, offsetSec: t, durationSec });
    t += durationSec;
  };

  if (!opts.programs.length) {
    while (t < DAY_SEC) push({ kind: "HOST", durationSec: 3600, hostLine: -1 });
    return out;
  }

  let hostN = 0;
  let lastHost = -Infinity;
  let lastBreak = t;
  let lastChart = -Infinity;
  let prevTitle = "";
  const chart = (opts.chart ?? []).slice(0, CHART_SIZE);
  let deck: ProgramItem[] = [];
  let lastQuiz = t;
  let quizN = Math.floor(t / QUIZ_EVERY_SEC);
  if (opts.first) {
    push({ kind: "HOST", durationSec: HOST_SEC, hostLine: hostN++ % HOST_LINES, prevTitle, nextTitle: opts.first.title });
    lastHost = t;
    push(opts.first.type === "EPISODE" ? { kind: "EPISODE", episodeId: opts.first.id, durationSec: clampDur(opts.first.durationSec) } : { kind: "CLIP", clipId: opts.first.id, durationSec: clampDur(opts.first.durationSec) });
    prevTitle = opts.first.title;
  }

  while (t < DAY_SEC) {
    if (chart.length >= 3 && t - lastChart >= CHART_EVERY_SEC) {
      lastChart = t;
      push({ kind: "CHART", durationSec: CHART_INTRO_SEC, hostLine: hostN++ % HOST_LINES });
      // Countdown: lowest place first, number one last.
      for (let i = chart.length - 1; i >= 0; i--) {
        push({ kind: "CLIP", clipId: chart[i].id, durationSec: clampDur(chart[i].durationSec), chartPlace: i + 1 });
      }
      lastHost = t;
      prevTitle = chart[0].title;
      continue;
    }
    if (opts.quiz && t - lastQuiz >= QUIZ_EVERY_SEC) {
      lastQuiz = t;
      push({ kind: "QUIZ", durationSec: QUIZ_SEC, quizIndex: quizN++ });
      continue;
    }
    if (opts.breaks !== false && t - lastBreak >= BREAK_EVERY_SEC) {
      lastBreak = t;
      push({ kind: "BREAK", durationSec: BREAK_SEC });
      continue;
    }
    if (!deck.length) {
      deck = shuffle(opts.programs, rnd);
      // A new round must not start with the programme that just ended the previous one.
      if (deck.length > 1 && deck[0].title === prevTitle) deck.push(deck.shift()!);
    }
    const item = deck.shift()!;
    if (item.type === "EPISODE" || t - lastHost >= HOST_EVERY_SEC) {
      lastHost = t;
      push({ kind: "HOST", durationSec: HOST_SEC, hostLine: hostN++ % HOST_LINES, prevTitle, nextTitle: item.title });
    }
    push(item.type === "EPISODE" ? { kind: "EPISODE", episodeId: item.id, durationSec: clampDur(item.durationSec) } : { kind: "CLIP", clipId: item.id, durationSec: clampDur(item.durationSec) });
    prevTitle = item.title;
  }
  return out;
}

/** Seconds into the slot, never negative and never past its end. */
export function slotOffset(startsAtMs: number, durationSec: number, nowMs: number) {
  return Math.min(Math.max(0, (nowMs - startsAtMs) / 1000), durationSec);
}

/** Position inside a video that is shorter than its slot (it loops). */
export function loopedPosition(offsetSec: number, videoSec: number) {
  if (!(videoSec > 0)) return 0;
  return offsetSec % videoSec;
}

export function dayStart(day: string) {
  return new Date(day + "T00:00:00.000Z");
}

// ───────────── host lines ─────────────

type Lines = { ru: string[]; en: string[] };

/** Fallback lines per channel kind ({prev} / {next} are programme titles). */
export const HOST_TEMPLATES: Record<ChannelKind, Lines> = {
  ABSURD: {
    ru: [
      "Вы смотрели «{prev}». Мы тоже. Нам тоже стыдно. Дальше — «{next}»!",
      "Дорогие зрители всех измерений! Не переключайтесь: «{next}» уже греет свои щупальца.",
      "Напоминаем: этот канал не несёт ответственности за ваши мутации. А сейчас — «{next}».",
      "Если вы видите этот текст, ваш телевизор работает. Поздравляем! В эфире «{next}».",
      "Наши юристы просили сказать, что «{prev}» — вымысел. А «{next}» — тем более.",
      "Реклама кончилась, совесть тоже. Встречайте: «{next}»!",
    ],
    en: [
      "You just watched “{prev}”. So did we. We're also sorry. Up next — “{next}”!",
      "Viewers of all dimensions! Don't touch that dial: “{next}” is warming up its tentacles.",
      "Reminder: this channel is not responsible for your mutations. And now — “{next}”.",
      "If you can read this, your TV works. Congratulations! Now on air: “{next}”.",
      "Our lawyers asked us to say “{prev}” was fiction. “{next}” even more so.",
      "The ads are over, and so is our dignity. Here comes “{next}”!",
    ],
  },
  DOCS: {
    ru: [
      "Тихо… Не спугните. Мы наблюдаем дикую природу планеты, где снимали «{next}».",
      "После «{prev}» наша съёмочная группа нуждается в отдыхе. Но не вы. Смотрим «{next}».",
      "Учёные трёх галактик до сих пор спорят о том, что вы увидите в «{next}».",
      "Природа чужих миров жестока и прекрасна. Особенно в «{next}».",
      "Пристегнитесь к дивану. Экспедиция «{next}» выходит на связь.",
      "Помните: не кормите местную фауну. Начинаем «{next}».",
    ],
    en: [
      "Quiet… don't scare it away. We're watching the wildlife of the planet where “{next}” was filmed.",
      "After “{prev}” our film crew needs a rest. You don't. Here's “{next}”.",
      "Scientists in three galaxies still argue about what you're about to see in “{next}”.",
      "Nature on alien worlds is cruel and beautiful. Especially in “{next}”.",
      "Strap yourself to the couch. Expedition “{next}” is coming through.",
      "Remember: don't feed the local fauna. Starting “{next}”.",
    ],
  },
  DARK: {
    ru: [
      "Не выключайте свет. Это не совет — это инструкция. «{next}».",
      "Объект «{prev}» сдержан. Пока. Следующее досье — «{next}».",
      "Если в комнате кто-то есть, кроме вас, — поздоровайтесь. В эфире «{next}».",
      "Сигнал нестабилен. Мы не уверены, что это мы его передаём. «{next}».",
      "Архив открыт. Гриф «Совершенно секретно» снят ради вас. «{next}».",
      "Помехи на экране — это нормально. Шёпот — нет. «{next}».",
    ],
    en: [
      "Keep the lights on. That's not advice — it's procedure. “{next}”.",
      "Object “{prev}” has been contained. For now. Next file — “{next}”.",
      "If someone besides you is in the room — say hello. Now airing: “{next}”.",
      "The signal is unstable. We're not sure we're the ones sending it. “{next}”.",
      "The archive is open. Top Secret clearance waived, just for you. “{next}”.",
      "Static on the screen is normal. Whispering is not. “{next}”.",
    ],
  },
  MUSIC: {
    ru: [
      "Йоу-йоу, это MIRAGE MUSIC! Только что был «{prev}», а сейчас — «{next}». Качаем!",
      "Привет всем, кто шлёт SMS! Ваши приветы бегут внизу экрана. А у нас — «{next}»!",
      "Не забудьте поставить лайк любимому клипу — так он попадёт в Топ-10 недели. Дальше «{next}»!",
      "Это был «{prev}» — мурашки, да? Следующий трек — «{next}»!",
      "Звоните маме, пишите в строку, делайте громче. «{next}»!",
      "Музыка без остановки, как в старые добрые! Встречаем «{next}».",
    ],
    en: [
      "Yo yo yo, this is MIRAGE MUSIC! That was “{prev}”, and now — “{next}”. Turn it up!",
      "Shout-out to everyone texting in! Your greetings are crawling at the bottom. Next up — “{next}”!",
      "Like your favourite video to push it into this week's Top 10. Here's “{next}”!",
      "That was “{prev}” — goosebumps, right? Next track — “{next}”!",
      "Call your mom, text the ticker, turn it up. “{next}”!",
      "Non-stop music, just like the good old days! Here comes “{next}”.",
    ],
  },
  CHILL: {
    ru: ["Дышим глубже. «{next}».", "Никуда не спешим. Дальше — «{next}».", "Свет приглушён, звук мягкий. «{next}».", "Пусть мысли плывут. «{next}».", "Ещё немного тишины и цвета. «{next}».", "Здесь можно просто быть. «{next}»."],
    en: ["Breathe deeper. “{next}”.", "No rush. Next — “{next}”.", "Lights low, sound soft. “{next}”.", "Let your thoughts drift. “{next}”.", "A little more silence and colour. “{next}”.", "You can just be here. “{next}”."],
  },
  SERIES: {
    ru: [
      "Только что — «{prev}». Понравилось? Продолжение ждёт в Видеотеке. А сейчас — «{next}».",
      "Сериальный канал MIRAGE: первые серии лучших ИИ-историй. В эфире «{next}».",
      "Если «{prev}» зацепил — жмите «Смотреть продолжение». Дальше — «{next}».",
      "Попкорн готов? Начинаем «{next}».",
      "Новая история — новые интриги. «{next}».",
      "Не переключайтесь: впереди «{next}».",
    ],
    en: [
      "That was “{prev}”. Hooked? The rest is waiting in the Library. And now — “{next}”.",
      "MIRAGE Series channel: first episodes of the best AI stories. Now airing “{next}”.",
      "If “{prev}” got you — hit “Continue watching”. Next — “{next}”.",
      "Popcorn ready? Starting “{next}”.",
      "New story, new intrigue. “{next}”.",
      "Stay tuned: “{next}” is up next.",
    ],
  },
  KIDS: {
    ru: ["Устраивайся поудобнее — начинается сказка «{next}».", "А теперь — «{next}»! Слушай внимательно.", "Звёздочки зажглись, значит пора: «{next}».", "Сказочник открыл новую книгу: «{next}».", "Тише-тише… «{next}».", "Ещё одна добрая история: «{next}»."],
    en: ["Get comfy — the story “{next}” is starting.", "And now — “{next}”! Listen closely.", "The stars are out, so it's time: “{next}”.", "The storyteller opened a new book: “{next}”.", "Shh… “{next}”.", "One more kind story: “{next}”."],
  },
  NIGHT: {
    ru: ["Ночь длинная, а мы только начали. «{next}».", "Для тех, кто не спит. «{next}».", "Свет выключен, пульт в руке. «{next}».", "После полуночи правила другие. «{next}».", "Тсс… только для взрослых. «{next}».", "Продолжаем ночной эфир: «{next}»."],
    en: ["The night is long and we've only started. “{next}”.", "For those who can't sleep. “{next}”.", "Lights off, remote in hand. “{next}”.", "After midnight the rules change. “{next}”.", "Shh… adults only. “{next}”.", "The night broadcast continues: “{next}”."],
  },
};

export const CHART_TEMPLATES: Lines = {
  ru: ["Внимание! Хит-парад «Топ-10 недели» MIRAGE MUSIC! Места выбирали вы — лайками. Поехали с десятого!"],
  en: ["Attention! It's the MIRAGE MUSIC Top 10 of the week! You picked the places with your likes. Starting from number ten!"],
};

/** Fills {prev}/{next}; a line about {prev} with nothing before it falls back to a neutral line. */
export function renderHostLine(line: string, prev: string, next: string) {
  if (!prev && line.includes("{prev}")) return null;
  return line.replaceAll("{prev}", prev).replaceAll("{next}", next);
}

/** Picks the n-th line, skipping ones that cannot be rendered; always returns something. */
export function hostText(lines: string[], n: number, prev: string, next: string) {
  for (let i = 0; i < lines.length; i++) {
    const r = renderHostLine(lines[(n + i) % lines.length], prev, next);
    if (r) return r;
  }
  return next;
}

/**
 * Parses the showrunner's JSON answer: {"ru":[…],"en":[…]} with ≥ 4 lines each that use {next}.
 * Lines are trimmed to 220 chars. Anything else → null (templates are used).
 */
export function parseHostLines(raw: string): Lines | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]) as { ru?: unknown; en?: unknown };
    const clean = (a: unknown) =>
      Array.isArray(a)
        ? a.filter((x): x is string => typeof x === "string" && x.includes("{next}") && !forbidden(x)).map((x) => x.trim().slice(0, 220))
        : [];
    const ru = clean(j.ru);
    const en = clean(j.en);
    if (ru.length < 4 || en.length < 4) return null;
    return { ru: ru.slice(0, HOST_LINES), en: en.slice(0, HOST_LINES) };
  } catch {
    return null;
  }
}

// ───────────── text filters ─────────────

const LINK_RE = /(https?:\/\/|www\.|\b[\w-]+\.(com|ru|net|org|io|me|tv|xyz|link|ly)\b|t\.me|@[\w]{3,})/i;
const SLUR_RE = /(пидор|нигг|nigg|faggot|nazi|нацист|зиг хайл|sieg heil)/i;
const PROFANITY_RE = /(хуй|хуе|пизд|ебат|ебан|бляд|сука|fuck|cunt)/i;

export type TextProblem = "empty" | "too_long" | "links" | "banned";

export function normalizeText(raw: string) {
  return raw.replace(/\s+/g, " ").trim();
}

/** Live chat: no links, no slurs, nothing about minors. Mild swearing is the viewers' business. */
export function chatTextProblem(raw: string): TextProblem | null {
  const t = normalizeText(raw);
  if (!t) return "empty";
  if (t.length > TV_CHAT_MAX) return "too_long";
  if (LINK_RE.test(t)) return "links";
  if (SLUR_RE.test(t) || forbidden(t)) return "banned";
  return null;
}

/** Ticker greetings are broadcast to every viewer: stricter (no swearing either). */
export function tickerTextProblem(raw: string): TextProblem | null {
  const t = normalizeText(raw);
  if (!t) return "empty";
  if (t.length > TV_TICKER_MAX) return "too_long";
  if (LINK_RE.test(t)) return "links";
  if (SLUR_RE.test(t) || PROFANITY_RE.test(t)) return "banned";
  return null;
}

export function ideaProblem(raw: string): TextProblem | null {
  const t = normalizeText(raw);
  if (t.length < 5) return "empty";
  if (t.length > TV_IDEA_MAX) return "too_long";
  if (LINK_RE.test(t)) return "links";
  if (SLUR_RE.test(t) || forbidden(t)) return "banned";
  return null;
}

// ───────────── v2: super chat, reactions, watch rewards, mini game, polls, quiz ─────────────

/** Paid highlighted chat messages: price → how long it stays pinned on screen and in chat. */
export const SUPERCHAT_TIERS = [
  { coins: 30, pinSec: 60, color: "#7dffb2" },
  { coins: 100, pinSec: 180, color: "#ffc83d" },
  { coins: 300, pinSec: 600, color: "#ff2e63" },
] as const;

export function superchatTier(coins: number) {
  return [...SUPERCHAT_TIERS].reverse().find((t) => coins >= t.coins) ?? null;
}

/** Cheapest paid option: the message is just coloured in the chat (not pinned). */
export const HIGHLIGHT_PRICE = 5;
export const HIGHLIGHT_COLOR = "#a78bfa";

/** Colour of a paid chat message (highlight or super chat). */
export function paidColor(coins: number) {
  return superchatTier(coins)?.color ?? (coins >= HIGHLIGHT_PRICE ? HIGHLIGHT_COLOR : null);
}

export const REACTIONS = ["😂", "🔥", "❤️", "😱", "👽", "👏"] as const;
export const REACTIONS_PER_10S = 8;

/** Watch rewards: a heartbeat every minute; gaps longer than this don't count (tab closed, PC asleep). */
export const WATCH_BEAT_MAX_GAP = 150;
export const WATCH_REWARD_EVERY = 600;

/** Seconds a heartbeat adds: the time since the previous beat, capped (no credit for long gaps or spam). */
export function watchCredit(lastBeatMs: number | null, nowMs: number) {
  if (lastBeatMs == null) return 0;
  const gap = (nowMs - lastBeatMs) / 1000;
  if (gap < 20 || gap > WATCH_BEAT_MAX_GAP) return 0;
  return Math.round(Math.min(gap, 90));
}

/** How many new 10-minute rewards are due. */
export function watchRewardsDue(seconds: number, rewarded: number) {
  return Math.max(0, Math.floor(seconds / WATCH_REWARD_EVERY) - rewarded);
}

/** "Catch the UFO": a round lasts GAME_SEC; a score needs a real round and a human-possible number of catches. */
export const GAME_SEC = 20;
export const GAME_MAX_SCORE = 45;
export const GAME_GOOD_SCORE = 10;

export function gameVerdict(startedMs: number, nowMs: number, score: number): "ok" | "too_fast" | "too_late" | "cheat" {
  const sec = (nowMs - startedMs) / 1000;
  if (sec < GAME_SEC - 2) return "too_fast";
  if (sec > GAME_SEC + 120) return "too_late";
  if (!Number.isInteger(score) || score < 0 || score > GAME_MAX_SCORE) return "cheat";
  return "ok";
}

/** "What's next?" poll on air. */
export const POLL_SEC = 150;
export const POLL_EVERY_SEC = 12 * 60;
export const POLL_OPTIONS = 3;

/** Winning option: most votes; a tie goes to the earliest option. */
export function pollWinner(counts: number[]) {
  let best = 0;
  for (let i = 1; i < counts.length; i++) if (counts[i] > counts[best]) best = i;
  return best;
}

/** A quiz question with its options shuffled per slot (so the right answer isn't always in the same place). */
export function shuffledQuiz<T extends { options: unknown[]; correct: number }>(q: T, seed: string) {
  const order = shuffle(q.options.map((_, i) => i), seededRandom(seed));
  return { ...q, options: order.map((i) => q.options[i]), correct: order.indexOf(q.correct) };
}
