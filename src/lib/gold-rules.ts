// Pure rules for gold and predictions (no DB — unit-tested).

/**
 * Gold is a free-to-earn currency. It is never sold and never converted from coins, so a prediction
 * stake has no money value: predictions stay a free game, not gambling.
 */
export type GoldEarnReason = "WELCOME" | "CHECKIN" | "WATCH" | "VOTE" | "RATE" | "TV_WATCH" | "TV_VOTE" | "TV_QUIZ" | "TV_GAME";

/** How much one action gives and how many times a day it pays. */
export const GOLD_EARN: Record<GoldEarnReason, { amount: number; perDay: number }> = {
  WELCOME: { amount: 20, perDay: 1 },
  CHECKIN: { amount: 5, perDay: 1 },
  WATCH: { amount: 2, perDay: 5 },
  VOTE: { amount: 3, perDay: 3 },
  RATE: { amount: 2, perDay: 3 },
  /** MIRAGE TV: every 10 minutes on air (up to an hour a day). */
  TV_WATCH: { amount: 2, perDay: 6 },
  /** "What's next?" vote on air. */
  TV_VOTE: { amount: 1, perDay: 5 },
  /** Correct quiz answer on air. */
  TV_QUIZ: { amount: 3, perDay: 5 },
  /** Good score in the ad-break mini game. */
  TV_GAME: { amount: 3, perDay: 3 },
};

/** Episode price in gold: cheaper in numbers than coins (gold is scarce), never below 1. */
export const GOLD_PER_COIN = 0.4;
export function goldPrice(coinPrice: number) {
  return Math.max(1, Math.ceil(coinPrice * GOLD_PER_COIN));
}

export const BET_MIN = 5;
export const BET_MAX = 200;
export const MIN_MULTIPLIER = 1.5;
export const MAX_MULTIPLIER = 10;
/** A viewer's own guess the creator accepted as correct. */
export const CUSTOM_MULTIPLIER = 3;
export const CUSTOM_MAX = 120;
export const PREDICTION_OPTIONS_MIN = 2;
export const PREDICTION_OPTIONS_MAX = 6;

/**
 * Pool-based payout for a ready option: everything staked is shared among those who guessed right,
 * proportionally to their stake. The fewer people guessed, the bigger the win — clamped to ×1.5…×10
 * (gold is free, so the platform tops up a small pool).
 */
export function poolMultiplier(pool: number, winningStake: number) {
  if (winningStake <= 0) return MAX_MULTIPLIER;
  return Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, pool / winningStake));
}

export function payoutFor(stake: number, multiplier: number) {
  return Math.floor(stake * multiplier);
}

/** Bets are accepted until a later episode than the one the question follows is published. */
export function predictionOpen(status: string, askedAfter: number, latestEpisode: number) {
  return status === "OPEN" && latestEpisode <= askedAfter;
}

export type BetInput = { optionId?: string | null; customText?: string | null; stake: number };
export type BetCheck = { ok: true } | { ok: false; reason: "stake" | "choice" | "custom_off" | "custom_text" };

export function checkBet(b: BetInput, allowCustom: boolean): BetCheck {
  if (!Number.isInteger(b.stake) || b.stake < BET_MIN || b.stake > BET_MAX) return { ok: false, reason: "stake" };
  const custom = b.customText?.trim() ?? "";
  if (!!b.optionId === !!custom) return { ok: false, reason: "choice" };
  if (custom && !allowCustom) return { ok: false, reason: "custom_off" };
  if (custom && (custom.length < 3 || custom.length > CUSTOM_MAX)) return { ok: false, reason: "custom_text" };
  return { ok: true };
}
