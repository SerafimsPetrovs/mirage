// Pure rules of watch parties (no DB) — unit-tested in party-rules.test.ts.

export const PARTY_MAX_MEMBERS = 12;
/** A member counts as "here" while their page polled within this window. */
export const PARTY_ONLINE_MS = 20_000;
/** Rooms nobody touched for this long are closed. */
export const PARTY_IDLE_MS = 12 * 3600_000;
export const PARTY_CHAT_MAX = 300;
export const PARTY_TITLE_MAX = 60;
export const PARTY_COUNTDOWN_SEC = 3;
/** Episode mode: re-sync when a member is further than this from the room's position. */
export const PARTY_DRIFT_SEC = 1.5;
export const PARTY_POLL_OPTIONS_MAX = 6;
export const PARTY_FOOD_ITEMS_MAX = 40;

export const PARTY_REACTIONS = ["😂", "😱", "🔥", "😭", "👏", "💀", "❤️", "🍿"] as const;
export const PARTY_THEMES = ["CINEMA", "NEON", "COZY", "SPACE"] as const;
export type PartyTheme = (typeof PARTY_THEMES)[number];

/**
 * Food delivery services. There is no public ordering API for consumers (Bolt Food, Wolt, Glovo, Uber Eats
 * only offer merchant/courier APIs), so the room plans the order together and one person opens the service;
 * a real in-app checkout needs a partnership agreement (see docs/watch-party.md).
 */
export const FOOD_SERVICES = {
  BOLT: { name: "Bolt Food", url: "https://food.bolt.eu/", color: "#34d186" },
  WOLT: { name: "Wolt", url: "https://wolt.com/", color: "#00c2e8" },
  GLOVO: { name: "Glovo", url: "https://glovoapp.com/", color: "#ffc244" },
  UBER: { name: "Uber Eats", url: "https://www.ubereats.com/", color: "#06c167" },
  YANDEX: { name: "Яндекс Еда", url: "https://eda.yandex.ru/", color: "#fce000" },
} as const;
export type FoodService = keyof typeof FOOD_SERVICES;
export const isFoodService = (s: string): s is FoodService => s in FOOD_SERVICES;

/** Readable invite code without look-alike characters (0/O, 1/I/L). `rand` returns [0, 1). */
export function partyCode(rand: () => number = Math.random, len = 6) {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += abc[Math.floor(rand() * abc.length)];
  return s;
}
export const PARTY_CODE_RE = /^[A-HJKMNP-Z2-9]{6}$/;

export type Playback = { playing: boolean; positionSec: number; stateAt: number };

/** Where the room's episode is right now. */
export function expectedPosition(p: Playback, now: number, duration = Infinity) {
  const pos = p.playing ? p.positionSec + Math.max(0, now - p.stateAt) / 1000 : p.positionSec;
  return Math.max(0, Math.min(pos, duration));
}

/** A member's player should jump when it drifted too far from the room. */
export function needsSeek(local: number, expected: number, playing: boolean) {
  return Math.abs(local - expected) > (playing ? PARTY_DRIFT_SEC : 0.3);
}

export function isOnline(lastSeen: number, now: number) {
  return now - lastSeen < PARTY_ONLINE_MS;
}

/** The host and whoever holds the remote control playback, channel and episode. */
export function canControl(userId: string, party: { hostId: string; remoteId: string }) {
  return userId === party.hostId || userId === party.remoteId;
}

export type FoodLine = { userId: string; priceCents: number | null; qty: number };

/**
 * Who pays what. "items": everyone pays for their own items, the delivery fee is split equally among people
 * who ordered something. "equal": the whole bill is split equally among the given people.
 * Cents are distributed so the shares add up exactly to the total.
 */
export function foodSplit(lines: FoodLine[], opts: { mode: "items" | "equal"; deliveryCents?: number; people?: string[] }) {
  const delivery = Math.max(0, Math.round(opts.deliveryCents ?? 0));
  const own = new Map<string, number>();
  for (const l of lines) own.set(l.userId, (own.get(l.userId) ?? 0) + Math.max(0, l.priceCents ?? 0) * Math.max(1, l.qty));
  const itemsTotal = [...own.values()].reduce((a, b) => a + b, 0);
  const total = itemsTotal + delivery;
  const people = opts.mode === "equal" ? [...new Set(opts.people?.length ? opts.people : [...own.keys()])] : [...own.keys()];
  const out = new Map<string, number>();
  if (!people.length) return { total, perUser: out };
  const even = (amount: number) => {
    const base = Math.floor(amount / people.length);
    let rest = amount - base * people.length;
    for (const p of people) {
      out.set(p, (out.get(p) ?? 0) + base + (rest > 0 ? 1 : 0));
      if (rest > 0) rest--;
    }
  };
  if (opts.mode === "equal") even(total);
  else {
    for (const p of people) out.set(p, own.get(p) ?? 0);
    even(delivery);
  }
  return { total, perUser: out };
}

export type PartyPoll = { id: string; question: string; options: string[] };

export function parsePoll(json: string | null): PartyPoll | null {
  if (!json) return null;
  try {
    const p = JSON.parse(json) as PartyPoll;
    return typeof p?.id === "string" && Array.isArray(p.options) ? p : null;
  } catch {
    return null;
  }
}

export function tally(votes: { option: number }[], optionCount: number) {
  const counts = Array.from({ length: optionCount }, () => 0);
  for (const v of votes) if (v.option >= 0 && v.option < optionCount) counts[v.option]++;
  return counts;
}

/** Seconds left in a countdown (null when none or finished). */
export function countdownLeft(to: number | null, now: number) {
  if (!to) return null;
  const left = Math.ceil((to - now) / 1000);
  return left > 0 ? left : null;
}
