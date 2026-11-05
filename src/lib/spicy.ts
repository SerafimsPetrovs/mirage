// Pure rules for the paid "fan-service" add-ons (skins, uncut scenes, character chat).
// No DB / server imports — unit-tested in logic.test.ts.

export const ROULETTE_PRICE = 15;
export const DEFAULT_SKIN_PRICE = 40;
export const DEFAULT_SCENE_PRICE = 30;
export const DEFAULT_PHOTO_PRICE = 25;
export const CHAT_FREE_MESSAGES = 5;
export const CHAT_MESSAGE_PRICE = 2;
export const CHAT_MAX_LEN = 600;
/** Anti-spam / LLM cost guard per viewer (all characters together). */
export const CHAT_RATE_PER_MIN = 8;
export const CHAT_DAILY_LIMIT = 300;
/** The character sends an unsent photo after this many replies without one (or when asked). */
export const PHOTO_EVERY_REPLIES = 4;

export const RARITY_WEIGHT: Record<string, number> = { common: 60, rare: 30, epic: 10 };
export const RARITIES = ["common", "rare", "epic"] as const;
export type Rarity = (typeof RARITIES)[number];

/** Weighted pick among skins not owned yet. `r` in [0, 1). */
export function pickSkin<T extends { rarity: string }>(candidates: T[], r: number): T | null {
  if (!candidates.length) return null;
  const weights = candidates.map((c) => RARITY_WEIGHT[c.rarity] ?? RARITY_WEIGHT.common);
  const total = weights.reduce((a, b) => a + b, 0);
  let x = r * total;
  for (let i = 0; i < candidates.length; i++) {
    x -= weights[i];
    if (x < 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

/** Price of the viewer's next chat message (the first few are free). */
export function chatMessagePrice(sentSoFar: number) {
  return sentSoFar < CHAT_FREE_MESSAGES ? 0 : CHAT_MESSAGE_PRICE;
}

const PHOTO_ASK = /(фот|селфи|покажи|скинь|пришли|photo|pic|selfie|show me|send me)/i;

/** Should the character attach a photo to this reply? */
export function shouldSendPhoto(userText: string, repliesSinceLastPhoto: number, hasUnsent: boolean) {
  if (!hasUnsent) return false;
  return PHOTO_ASK.test(userText) || repliesSinceLastPhoto >= PHOTO_EVERY_REPLIES;
}

export type SpicyBlock = "auth" | "kids" | "age" | "family";

type Viewer = { kidsMode: boolean; adultConfirmedAt: Date | null; showAdult: boolean } | null;

/** The viewer confirmed 18+ AND switched 18+ content on, and is not in kids mode. */
export function isAdultMode(user: Viewer): boolean {
  return !!user && !user.kidsMode && user.showAdult && !!user.adultConfirmedAt;
}

/**
 * Who may see/buy 18+ add-ons: logged-in adults with 18+ content enabled, outside kids mode,
 * never on family-safe series. Returns null when allowed.
 */
export function spicyBlock(user: Viewer, series: { isFamilySafe: boolean }): SpicyBlock | null {
  if (series.isFamilySafe) return "family";
  if (!user) return "auth";
  if (user.kidsMode) return "kids";
  if (!isAdultMode(user)) return "age";
  return null;
}

/** Can this viewer open an 18+ series at all? Non-adult series are always fine. Returns null when allowed. */
export function adultSeriesBlock(user: Viewer, series: { isAdult: boolean }): Exclude<SpicyBlock, "family"> | null {
  if (!series.isAdult) return null;
  if (!user) return "auth";
  if (user.kidsMode) return "kids";
  if (!isAdultMode(user)) return "age";
  return null;
}
