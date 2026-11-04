import "server-only";
import { prisma } from "../db";
import { grantCoins } from "../coins";
import { findSku, priceFor } from "./catalog";

/**
 * Payment provider contract. A real provider (Stripe, YooKassa) creates a hosted
 * checkout and later calls `fulfillOrder(orderId)` from its webhook.
 */
export interface PaymentProvider {
  name: string;
  /** Returns a URL to redirect the user to, or null if payment completed synchronously. */
  checkout(order: { id: string; amountCents: number; currency: string; description: string }): Promise<string | null>;
}

const MockProvider: PaymentProvider = {
  name: "mock",
  async checkout(order) {
    await fulfillOrder(order.id);
    return null;
  },
};

export function getProvider(): PaymentProvider {
  const mockAllowed = process.env.NODE_ENV !== "production" || process.env.ALLOW_MOCK_PAYMENTS === "1";
  if (mockAllowed) return MockProvider;
  // Plug real providers here (see docs/payments.md).
  throw new Error("No payment provider configured");
}

export async function createOrder(userId: string, sku: string) {
  const item = findSku(sku);
  if (!item) throw new Error("UNKNOWN_SKU");
  const price = priceFor(item.kind === "COINS" ? item.pack : item.plan);
  const provider = getProvider();
  const order = await prisma.order.create({
    data: { userId, kind: item.kind, sku, provider: provider.name, ...price },
  });
  const redirectUrl = await provider.checkout({
    id: order.id,
    ...price,
    description: item.kind === "COINS" ? `${item.pack.coins + item.pack.bonus} coins` : `VIP ${item.plan.days}d`,
  });
  return { order, redirectUrl };
}

/** Idempotent: grants the purchase exactly once per order. */
export async function fulfillOrder(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const res = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (res.count === 0) return false;
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    const item = findSku(order.sku);
    if (!item) throw new Error("UNKNOWN_SKU");
    if (item.kind === "COINS") {
      await grantCoins(order.userId, item.pack.coins + item.pack.bonus, "PURCHASE", { orderId }, tx);
    } else {
      await extendVip(tx, order.userId, item.plan.days, item.plan.sku);
    }
    return true;
  });
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Adds `days` of VIP starting from the later of now / current period end. */
export async function extendVip(tx: Tx, userId: string, days: number, plan: string) {
  const existing = await tx.subscription.findUnique({ where: { userId } });
  const base = existing && existing.status === "ACTIVE" && existing.currentPeriodEnd > new Date() ? existing.currentPeriodEnd : new Date();
  const end = new Date(base.getTime() + days * 86400_000);
  await tx.subscription.upsert({
    where: { userId },
    create: { userId, plan, currentPeriodEnd: end },
    update: { plan, status: "ACTIVE", currentPeriodEnd: end },
  });
  return end;
}
