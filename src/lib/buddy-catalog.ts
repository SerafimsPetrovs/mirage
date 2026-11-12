// Watch buddies: the catalog and pure rules (no DB — safe on the client, unit-tested).

export type BuddyId = "blip" | "kex" | "gosha" | "popcorn" | "bit" | "goose";
export type OutfitSlot = "hat" | "face" | "neck";
/** "free" items are owned by everyone; "gold" is earned by watching; "coins" are bought; "reward" only comes from an achievement. */
export type Currency = "free" | "gold" | "coins" | "reward";
export type Outfit = Partial<Record<OutfitSlot, string>>;

export type BuddyDef = {
  id: BuddyId;
  cur: Currency;
  price: number;
  /** Main colour (cards, glow). */
  color: string;
  /** Where outfit pieces sit on this body (viewBox 0 0 120 120): x, y and a scale. */
  anchors: Record<OutfitSlot, { x: number; y: number; s: number }>;
};

export const BUDDIES: BuddyDef[] = [
  { id: "blip", cur: "free", price: 0, color: "#3ee6c8", anchors: { hat: { x: 60, y: 44, s: 1 }, face: { x: 60, y: 72, s: 1 }, neck: { x: 60, y: 98, s: 1 } } },
  { id: "kex", cur: "free", price: 0, color: "#ff9d42", anchors: { hat: { x: 60, y: 36, s: 0.95 }, face: { x: 60, y: 62, s: 1 }, neck: { x: 60, y: 90, s: 0.95 } } },
  { id: "gosha", cur: "gold", price: 60, color: "#dfe6ff", anchors: { hat: { x: 60, y: 30, s: 1 }, face: { x: 60, y: 58, s: 1 }, neck: { x: 60, y: 84, s: 1 } } },
  { id: "popcorn", cur: "coins", price: 99, color: "#ff4d5e", anchors: { hat: { x: 60, y: 26, s: 1 }, face: { x: 60, y: 74, s: 1 }, neck: { x: 60, y: 100, s: 1.05 } } },
  { id: "bit", cur: "coins", price: 149, color: "#8fa3c0", anchors: { hat: { x: 60, y: 33, s: 1.05 }, face: { x: 60, y: 58, s: 1 }, neck: { x: 60, y: 95, s: 0.9 } } },
  { id: "goose", cur: "coins", price: 199, color: "#f4f4f4", anchors: { hat: { x: 58, y: 25, s: 0.62 }, face: { x: 58, y: 38, s: 0.58 }, neck: { x: 58, y: 66, s: 0.6 } } },
];

export type OutfitDef = { id: string; slot: OutfitSlot; cur: Currency; price: number };

export const OUTFITS: OutfitDef[] = [
  { id: "cap", slot: "hat", cur: "gold", price: 25 },
  { id: "beanie", slot: "hat", cur: "gold", price: 35 },
  { id: "party", slot: "hat", cur: "free", price: 0 },
  { id: "headphones", slot: "hat", cur: "coins", price: 49 },
  { id: "tophat", slot: "hat", cur: "coins", price: 69 },
  { id: "crown", slot: "hat", cur: "coins", price: 149 },
  { id: "shades", slot: "face", cur: "gold", price: 30 },
  { id: "glasses3d", slot: "face", cur: "gold", price: 45 },
  { id: "hearts", slot: "face", cur: "coins", price: 39 },
  { id: "scarf", slot: "neck", cur: "gold", price: 25 },
  { id: "bowtie", slot: "neck", cur: "coins", price: 29 },
  { id: "chain", slot: "neck", cur: "coins", price: 99 },
  // film & meme references
  { id: "fedora", slot: "hat", cur: "coins", price: 79 },
  { id: "wizard", slot: "hat", cur: "coins", price: 89 },
  { id: "headband", slot: "hat", cur: "gold", price: 40 },
  { id: "hockeymask", slot: "face", cur: "coins", price: 66 },
  { id: "matrix", slot: "face", cur: "gold", price: 50 },
  { id: "yellowsuit", slot: "neck", cur: "coins", price: 129 },
  { id: "cape", slot: "neck", cur: "gold", price: 55 },
  { id: "flugegeheimen", slot: "neck", cur: "coins", price: 101 },
  { id: "sixseven", slot: "neck", cur: "gold", price: 67 },
  // achievement rewards — can't be bought
  { id: "halo", slot: "hat", cur: "reward", price: 0 },
  { id: "laurel", slot: "hat", cur: "reward", price: 0 },
  { id: "starshades", slot: "face", cur: "reward", price: 0 },
  { id: "medal", slot: "neck", cur: "reward", price: 0 },
];

export const DEFAULT_BUDDY: BuddyId = "blip";

export function buddyDef(id: string): BuddyDef {
  return BUDDIES.find((b) => b.id === id) ?? BUDDIES[0];
}
export function outfitDef(id: string): OutfitDef | undefined {
  return OUTFITS.find((o) => o.id === id);
}
/** Any sellable thing by id (buddies and outfit pieces share one id space). */
export function itemDef(id: string): { id: string; cur: Currency; price: number } | undefined {
  return BUDDIES.find((b) => b.id === id) ?? outfitDef(id);
}

export function owns(owned: ReadonlySet<string>, id: string) {
  const d = itemDef(id);
  return !!d && (d.cur === "free" || owned.has(id));
}

/** Reads a stored outfit, keeping only known pieces in their right slot. Never throws. */
export function parseOutfit(raw: string | null | undefined): Outfit {
  let v: unknown;
  try {
    v = JSON.parse(raw ?? "{}");
  } catch {
    return {};
  }
  const out: Outfit = {};
  if (!v || typeof v !== "object") return out;
  for (const slot of ["hat", "face", "neck"] as const) {
    const id = (v as Record<string, unknown>)[slot];
    if (typeof id === "string" && outfitDef(id)?.slot === slot) out[slot] = id;
  }
  return out;
}

/** What the viewer may wear: unknown or not-owned pieces are dropped (server-side check before saving). */
export function sanitizeLook(owned: ReadonlySet<string>, buddy: string, outfit: Outfit): { buddy: BuddyId; outfit: Outfit } | null {
  if (!BUDDIES.some((b) => b.id === buddy) || !owns(owned, buddy)) return null;
  const clean: Outfit = {};
  const parsed = parseOutfit(JSON.stringify(outfit));
  // a piece in the wrong slot or an unknown key is a malformed request, not something to quietly drop
  if (Object.values(outfit).filter(Boolean).length !== Object.keys(parsed).length) return null;
  for (const [slot, id] of Object.entries(parsed) as [OutfitSlot, string][]) {
    if (!owns(owned, id)) return null;
    clean[slot] = id;
  }
  return { buddy: buddy as BuddyId, outfit: clean };
}

// ───────────── behaviour ─────────────

/** What the buddy reacts to. Every event has lines in the buddy's own voice (i18n `buddy.lines`). */
export type BuddyEvent =
  | "hello"
  | "night"
  | "show"
  | "horror"
  | "comedy"
  | "romance"
  | "music"
  | "news"
  | "ads"
  | "quiz"
  | "host"
  | "laugh"
  | "love"
  | "wow"
  | "chat"
  | "idle"
  | "poke"
  | "annoyed"
  | "sleep"
  | "gold";

export type BuddyMood = "idle" | "happy" | "laugh" | "love" | "shock" | "scared" | "sad" | "bored" | "sleep" | "hype";

export const EVENT_MOOD: Record<BuddyEvent, BuddyMood> = {
  hello: "happy",
  night: "bored",
  show: "happy",
  horror: "scared",
  comedy: "laugh",
  romance: "love",
  music: "hype",
  news: "shock",
  ads: "bored",
  quiz: "hype",
  host: "idle",
  laugh: "laugh",
  love: "love",
  wow: "shock",
  chat: "shock",
  idle: "idle",
  poke: "happy",
  annoyed: "sad",
  sleep: "sleep",
  gold: "hype",
};

type SlotLike = { kind: string; clipKind: string | null; info: { tags: string[] } | null };

/** The event a new programme triggers: by slot kind first, then the clip's genre, then the channel. */
export function slotEvent(slot: SlotLike, channelKind: string): BuddyEvent {
  if (slot.kind === "NEWS") return "news";
  if (slot.kind === "BREAK" || slot.clipKind === "AD") return "ads";
  if (slot.kind === "QUIZ") return "quiz";
  if (slot.kind === "HOST") return "host";
  if (slot.kind === "CHART" || slot.clipKind === "MUSIC") return "music";
  const tags = slot.info?.tags ?? [];
  if (tags.some((g) => g === "horror" || g === "thriller")) return "horror";
  if (tags.includes("comedy")) return "comedy";
  if (tags.includes("romance")) return "romance";
  if (channelKind === "DARK") return "horror";
  if (channelKind === "MUSIC") return "music";
  if (channelKind === "ABSURD") return "comedy";
  return "show";
}

/** The mood a chat reaction emoji puts the buddy in, as an event. */
export function reactionEvent(emoji: string): BuddyEvent | null {
  if (["😂", "🤣", "😆"].includes(emoji)) return "laugh";
  if (["❤️", "😍", "🥰", "💖"].includes(emoji)) return "love";
  if (["🔥", "😱", "🤯", "😮", "👏"].includes(emoji)) return "wow";
  return null;
}

/**
 * Picks a line the buddy hasn't said recently (`recent` = the last lines said, newest last).
 * Falls back to anything but the very last line once the whole pool has been used.
 */
export function pickFresh(lines: readonly string[], recent: readonly string[], rnd = Math.random): string {
  if (lines.length === 0) return "";
  const fresh = lines.filter((l) => !recent.includes(l));
  if (fresh.length) return fresh[Math.floor(rnd() * fresh.length) % fresh.length];
  return pickLine(lines, recent.at(-1) ?? null, rnd);
}

/** Little things the buddy does on its own between lines. 67 mode adds the unhinged ones. */
export const ACTS = ["hop", "look", "wave", "peek", "squash", "spin"] as const;
export const CHAOS_ACTS = ["flip", "zoomies", "big", "sixseven", "spin3", "glitch"] as const;
export type BuddyAct = (typeof ACTS)[number] | (typeof CHAOS_ACTS)[number];
/** How long each act plays, ms (matches the CSS animations). */
export const ACT_MS: Record<BuddyAct, number> = {
  hop: 1400,
  look: 2400,
  wave: 1600,
  peek: 2600,
  squash: 1200,
  spin: 900,
  flip: 4200,
  zoomies: 3000,
  big: 3200,
  sixseven: 3000,
  spin3: 1600,
  glitch: 1500,
};

/** The next act: normal ones, plus (often) chaos ones in 67 mode; the goose prefers trouble. */
export function pickAct(chaos: boolean, buddy: BuddyId, rnd = Math.random): BuddyAct {
  const pool: readonly BuddyAct[] = chaos && rnd() < 0.65 ? CHAOS_ACTS : ACTS;
  if (buddy === "goose" && !chaos && rnd() < 0.3) return "spin";
  return pool[Math.floor(rnd() * pool.length) % pool.length];
}

/** Picks one line, avoiding the one said last time when possible. */
export function pickLine(lines: readonly string[], last: string | null, rnd = Math.random): string {
  if (lines.length === 0) return "";
  const pool = lines.length > 1 ? lines.filter((l) => l !== last) : lines;
  return pool[Math.floor(rnd() * pool.length) % pool.length];
}
