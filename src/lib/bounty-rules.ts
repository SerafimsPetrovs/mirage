// Channel deficit charts & bounties (pure rules, unit-tested).

export type BountyZone = "GREEN" | "YELLOW" | "RED";

/** A clip counts as "fresh" until it aired this many times. */
export const FRESH_PLAYS = 5;
/** …or while it is younger than this. */
export const FRESH_DAYS = 7;
/** Base reward for an approved pool clip, in generation credits. */
export const BOUNTY_BASE_CREDITS = 20;
/** Extra bonus coins for filling a red (hot) channel. */
export const HOT_BONUS_COINS = 30;
export const ZONE_GREEN = 0.8;
export const ZONE_YELLOW = 0.4;

export function zoneFor(fill: number): BountyZone {
  if (fill > ZONE_GREEN) return "GREEN";
  if (fill >= ZONE_YELLOW) return "YELLOW";
  return "RED";
}

/** Reward multiplier: x1.0 green, +25 % yellow, x2 red; the admin's manual boost is always x2. */
export function multiplier(zone: BountyZone, boosted: boolean) {
  if (boosted) return 2;
  return zone === "GREEN" ? 1 : zone === "YELLOW" ? 1.25 : 2;
}

/** Buffer fill for the next 24 and 48 hours: fresh minutes vs. what the channel needs. */
export function bufferFill(freshMinutes: number, targetPerDayMin: number) {
  const target = Math.max(1, targetPerDayMin);
  return { fill24: Math.min(1, freshMinutes / target), fill48: Math.min(1, freshMinutes / (2 * target)) };
}

/** Minutes missing to reach a green 24 h buffer (for "30 minutes short tonight" alerts). */
export function minutesShort(freshMinutes: number, targetPerDayMin: number) {
  return Math.max(0, Math.ceil(targetPerDayMin * ZONE_GREEN - freshMinutes));
}

export function isFresh(clip: { plays: number; createdAt: Date }, now: Date) {
  return clip.plays < FRESH_PLAYS || now.getTime() - clip.createdAt.getTime() < FRESH_DAYS * 86400_000;
}

/** What an approved clip earns: zone is fixed at upload time ("BOOST" = admin's manual x2). */
export function bountyReward(zone: string): { credits: number; coins: number } {
  if (zone === "BOOST") return { credits: BOUNTY_BASE_CREDITS * 2, coins: HOT_BONUS_COINS };
  if (zone !== "GREEN" && zone !== "YELLOW" && zone !== "RED") return { credits: 0, coins: 0 };
  return { credits: Math.round(BOUNTY_BASE_CREDITS * multiplier(zone, false)), coins: zone === "RED" ? HOT_BONUS_COINS : 0 };
}
