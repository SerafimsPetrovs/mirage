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

/** Extra votes in "What's next?" polls: price per vote. */
export const POLL_VOTE_PRICE = 5;

/**
 * Splits a price between the buyer's bonus and paid coins. Bonus coins are spent first.
 * Returns null when the total balance is not enough.
 */
export function splitCharge(price: number, balance: { paidCoins: number; bonusCoins: number }) {
  if (price <= 0) return { bonus: 0, paid: 0 };
  if (balance.paidCoins + balance.bonusCoins < price) return null;
  const bonus = Math.min(balance.bonusCoins, price);
  return { bonus, paid: price - bonus };
}

/**
 * Creator's 50% share of a charge. Only the part paid with real-money coins is withdrawable;
 * the share of bonus coins becomes generation credits (anti bot-farming).
 */
export function splitShare(charge: { paid: number; bonus: number }, share = CREATOR_SHARE) {
  const total = Math.floor((charge.paid + charge.bonus) * share);
  const coins = Math.floor(charge.paid * share);
  return { coins, credits: total - coins };
}

export function totalCoins(u: { paidCoins: number; bonusCoins: number }) {
  return u.paidCoins + u.bonusCoins;
}
