export type CoinPack = { sku: string; coins: number; bonus: number; rub: number; usd: number; badge?: "popular" | "best" };
export type VipPlan = { sku: string; days: number; rub: number; usd: number; badge?: "popular" | "best" };

export const COIN_PACKS: CoinPack[] = [
  { sku: "coins_100", coins: 100, bonus: 0, rub: 99, usd: 1.99 },
  { sku: "coins_300", coins: 300, bonus: 30, rub: 279, usd: 4.99 },
  { sku: "coins_600", coins: 600, bonus: 90, rub: 549, usd: 9.99, badge: "popular" },
  { sku: "coins_1500", coins: 1500, bonus: 300, rub: 1290, usd: 19.99, badge: "best" },
];

export const VIP_PLANS: VipPlan[] = [
  { sku: "vip_week", days: 7, rub: 199, usd: 2.99 },
  { sku: "vip_month", days: 30, rub: 549, usd: 7.99, badge: "popular" },
  { sku: "vip_year", days: 365, rub: 3990, usd: 59.99, badge: "best" },
];

export function findSku(sku: string) {
  const pack = COIN_PACKS.find((p) => p.sku === sku);
  if (pack) return { kind: "COINS" as const, pack };
  const plan = VIP_PLANS.find((p) => p.sku === sku);
  if (plan) return { kind: "VIP" as const, plan };
  return null;
}

export function priceFor(item: { rub: number; usd: number }, locale: string) {
  return locale === "en"
    ? { amountCents: Math.round(item.usd * 100), currency: "USD" }
    : { amountCents: Math.round(item.rub * 100), currency: "RUB" };
}
