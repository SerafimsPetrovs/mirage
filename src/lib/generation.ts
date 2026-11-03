// Pure logic for AI video generation (no DB / server imports — unit-tested).

export const GEN_STYLES = ["cinematic", "anime", "noir", "dreamy", "neon", "realistic"] as const;
export type GenStyle = (typeof GEN_STYLES)[number];

export const GEN_DURATIONS = [5, 10] as const;
export const GEN_CREDITS_PER_SECOND = 2;
export const GEN_STARTER_CREDITS = 100;
export const PROMPT_MAX = 1000;

export function costFor(durationSec: number) {
  return durationSec * GEN_CREDITS_PER_SECOND;
}

/** Simulated timings for the mock provider. */
const QUEUE_MS = 3000;
const MS_PER_OUTPUT_SECOND = 3000;

export function mockTotalMs(durationSec: number) {
  return QUEUE_MS + durationSec * MS_PER_OUTPUT_SECOND;
}

export type MockState = { status: "QUEUED" | "RUNNING" | "DONE"; progress: number };

/** Where a mock job is, given how long ago it was created. */
export function mockState(elapsedMs: number, durationSec: number): MockState {
  if (elapsedMs < QUEUE_MS) return { status: "QUEUED", progress: 0 };
  const total = mockTotalMs(durationSec);
  if (elapsedMs >= total) return { status: "DONE", progress: 1 };
  return { status: "RUNNING", progress: (elapsedMs - QUEUE_MS) / (total - QUEUE_MS) };
}

const DEMO_V = ["v-amber", "v-crimson", "v-ice", "v-rose", "v-teal", "v-violet"];
const DEMO_H = ["h-desert", "h-dusk", "h-ember", "h-ocean"];

/** Deterministic placeholder clip for a seed. */
export function mockResult(seed: number, orientation: "VERTICAL" | "HORIZONTAL") {
  const list = orientation === "VERTICAL" ? DEMO_V : DEMO_H;
  return `demo:${list[Math.abs(seed) % list.length]}.mp4`;
}

// Hard platform rule: no sexual content involving minors. Generation is
// otherwise unfiltered; this check is a floor, not a full moderation system.
const MINOR =
  /(child|kid|minor|underage|teen(?!s?\s*\+)|preteen|loli|shota|schoolgirl|schoolboy|\b1[0-7]\s*(?:yo|y\/o|years?\s*old)|ребён|ребен|дет(?:и|ск|ей)|малолет|несовершеннолет|подрост|школьни|девочк|мальчик|\b1[0-7]\s*(?:лет|год))/i;
const SEXUAL =
  /(sex|nude|naked|porn|nsfw|erotic|explicit|lewd|hentai|undress|топлес|голы|голая|обнаж|порн|секс|эрот|интим|раздет)/i;

export type PromptCheck = { ok: true } | { ok: false; reason: "empty" | "too_long" | "forbidden" };

export function checkPrompt(prompt: string): PromptCheck {
  const p = prompt.trim();
  if (!p) return { ok: false, reason: "empty" };
  if (p.length > PROMPT_MAX) return { ok: false, reason: "too_long" };
  if (MINOR.test(p) && SEXUAL.test(p)) return { ok: false, reason: "forbidden" };
  return { ok: true };
}
