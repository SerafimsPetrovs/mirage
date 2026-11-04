/** All prices are in euros (one currency for every locale). */
export const CURRENCY = "EUR";

export type CoinPack = { sku: string; coins: number; bonus: number; eur: number; badge?: "popular" | "best" };
export type VipPlan = { sku: string; days: number; eur: number; badge?: "popular" | "best" };

export const COIN_PACKS: CoinPack[] = [
  { sku: "coins_100", coins: 100, bonus: 0, eur: 0.99 },
  { sku: "coins_300", coins: 300, bonus: 30, eur: 2.99 },
  { sku: "coins_600", coins: 600, bonus: 90, eur: 5.49, badge: "popular" },
  { sku: "coins_1500", coins: 1500, bonus: 300, eur: 12.99, badge: "best" },
];

export const VIP_PLANS: VipPlan[] = [
  { sku: "vip_week", days: 7, eur: 1.99 },
  { sku: "vip_month", days: 30, eur: 5.49, badge: "popular" },
  { sku: "vip_year", days: 365, eur: 39.99, badge: "best" },
];

export function findSku(sku: string) {
  const pack = COIN_PACKS.find((p) => p.sku === sku);
  if (pack) return { kind: "COINS" as const, pack };
  const plan = VIP_PLANS.find((p) => p.sku === sku);
  if (plan) return { kind: "VIP" as const, plan };
  return null;
}

export function priceFor(item: { eur: number }) {
  return { amountCents: Math.round(item.eur * 100), currency: CURRENCY };
}
