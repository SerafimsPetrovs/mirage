---
name: handling-coins-and-unlocks
description: Use when touching episode access, paywalls, coin balances, coin purchases, VIP subscriptions, daily check-in rewards, creator payouts, or any code that changes a user's balance or decides whether an episode can be watched in MIRAGE.
---

# Handling Coins and Unlocks

## Overview
Money logic is **server-side, transactional, ledger-based**. The client never decides access and never sends prices.

## Access (pure: `src/lib/access.ts` → `decideAccess(user, episode, unlocked)`)
Watchable if ANY: `episode.number <= series.freeEpisodes` · user is ADMIN or the series creator · active VIP (`subscription.status === "ACTIVE" && currentPeriodEnd > now`) · an `Unlock` row exists.
DB wrapper: `getEpisodeAccess(user, episodeId)` in `src/lib/coins.ts`. `/api/stream/[episodeId]` re-checks it on every request (and hides unpublished series from non-owners). Never send a locked episode's video URL to the client.

## Balance invariants
- `User.coins` is a cache; truth is `CoinTransaction` (signed `amount`, `reason`: PURCHASE | UNLOCK | CHECKIN | BONUS | REFUND | ADMIN).
- Every change = ledger row + balance update in ONE transaction. Use `grantCoins(userId, amount, reason, extra, tx)` for credits.
- Debit only via `unlockEpisode(userId, episodeId)`: conditional `updateMany({ where: { coins: { gte: price } } })`, unique `Unlock(userId, episodeId)` (P2002 → whole tx rolls back), creator earning = `floor(price * CREATOR_SHARE)` (0.5).
- Already unlocked / free / own content → `{ charged: 0 }`, never a second charge.
- Price = `episode.coinPrice ?? series.defaultCoinPrice`, read on the server.

## Payments (`src/lib/payments/`)
`catalog.ts` = SKUs and prices (`COIN_PACKS`, `VIP_PLANS`). `createOrder()` → `provider.checkout()` → later `fulfillOrder(orderId)` which is idempotent (PENDING→PAID guard) and grants coins or extends VIP from the later of now/current end. `MockProvider` is used unless production without `ALLOW_MOCK_PAYMENTS=1`. Real providers: see `docs/payments.md`.

## Daily check-in
`dailyCheckIn(userId)` — one per UTC day (PK `userId+day`); streak/reward logic is pure in `src/lib/rewards.ts` (`nextCheckIn`, 7-day `CHECKIN_REWARDS`).

## Tests
`src/lib/coins.db.test.ts` (real SQLite `prisma/test.db`) covers insufficient funds, idempotency, concurrent double-click, creator share, order idempotency, VIP extension, check-in. Any change here must keep `npm test` green and add a case for new behavior.

## Common mistakes
Checking access only in UI · `user.coins - price` computed in JS then saved · charging before checking the existing unlock · forgetting the creator earning · granting coins without a ledger row.
