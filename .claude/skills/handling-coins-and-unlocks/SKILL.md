---
name: handling-coins-and-unlocks
description: Use when touching episode access, paywalls, coin balances, coin purchases, VIP subscriptions, daily check-in rewards, creator payouts, or any code that changes a user's balance or decides whether an episode can be watched in MIRAGE.
---

# Handling Coins and Unlocks

## Overview
Money logic must be **server-side, transactional, and ledger-based**. The client never decides access and never sends prices.

## Access rule (single function: `src/lib/access.ts` → `canWatch(user, episode)`)
An episode is watchable if ANY is true:
1. `episode.number <= series.freeEpisodes`
2. user has active VIP (`subscription.status === "active" && currentPeriodEnd > now`)
3. an `Unlock` row exists for (userId, episodeId)
4. user is the series creator or an admin

Video URLs for locked episodes are NEVER sent to the client. The stream route (`/api/stream/[episodeId]`) re-checks `canWatch`.

## Balance invariants
- `User.coins` is a cache; truth is the `CoinTransaction` ledger (`amount` signed, `reason` enum: PURCHASE, UNLOCK, CHECKIN, BONUS, REFUND, ADMIN).
- Every balance change = ledger insert + balance update in ONE `prisma.$transaction`.
- Debit uses a conditional update so balance can't go negative under concurrency:
```ts
await prisma.$transaction(async (tx) => {
  const res = await tx.user.updateMany({
    where: { id: userId, coins: { gte: price } },
    data: { coins: { decrement: price } },
  });
  if (res.count === 0) throw new InsufficientCoinsError();
  await tx.coinTransaction.create({ data: { userId, amount: -price, reason: "UNLOCK", episodeId } });
  await tx.unlock.create({ data: { userId, episodeId } }); // unique(userId, episodeId) prevents double-pay
  await tx.creatorEarning.create({ data: { creatorId, episodeId, coins: Math.floor(price * CREATOR_SHARE) } });
});
```
- Unlocking an already-unlocked episode is a no-op success, never a second charge.
- Price comes from `episode.coinPrice` read on the server.

## Payments
`src/lib/payments/` has a `PaymentProvider` interface. Default is `MockProvider` (instant success, dev only, disabled when `NODE_ENV=production` unless `ALLOW_MOCK_PAYMENTS=1`). Real providers (Stripe / YooKassa) plug in via webhook → `grantPurchase(orderId)` which must be idempotent on `orderId`.

## Daily check-in
One per UTC day per user (unique on `userId + day`). Streak reward table lives in `src/lib/rewards.ts`.

## Common mistakes
- Checking access only in the UI.
- `user.coins - price` computed in JS then saved (race condition).
- Charging before verifying the unlock doesn't exist.
- Forgetting the creator earning row.
