export const DEFAULT_COIN_PRICE = 30;
export const CREATOR_SHARE = 0.5;

export type AccessUser = {
  id: string;
  role: "VIEWER" | "CREATOR" | "ADMIN";
  subscription: { status: string; currentPeriodEnd: Date } | null;
} | null;

export type AccessEpisode = {
  id: string;
  number: number;
  coinPrice: number | null;
  series: { freeEpisodes: number; defaultCoinPrice: number; creatorId: string };
};

export type AccessResult =
  | { ok: true; reason: "free" | "vip" | "unlocked" | "owner" }
  | { ok: false; reason: "login" | "locked"; price: number };

export function episodePrice(ep: AccessEpisode) {
  return ep.coinPrice ?? ep.series.defaultCoinPrice ?? DEFAULT_COIN_PRICE;
}

/** Pure access decision. `unlocked` = whether an Unlock row exists for this user+episode. */
export function decideAccess(user: AccessUser, ep: AccessEpisode, unlocked: boolean, now = new Date()): AccessResult {
  if (ep.number <= ep.series.freeEpisodes) return { ok: true, reason: "free" };
  const price = episodePrice(ep);
  if (!user) return { ok: false, reason: "login", price };
  if (user.role === "ADMIN" || user.id === ep.series.creatorId) return { ok: true, reason: "owner" };
  if (user.subscription && user.subscription.status === "ACTIVE" && user.subscription.currentPeriodEnd > now) {
    return { ok: true, reason: "vip" };
  }
  if (unlocked) return { ok: true, reason: "unlocked" };
  return { ok: false, reason: "locked", price };
}
