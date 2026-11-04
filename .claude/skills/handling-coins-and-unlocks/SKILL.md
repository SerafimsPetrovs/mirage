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
- Balance is split: `User.paidCoins` (bought with money, only `PURCHASE`) and `User.bonusCoins` (welcome, check-in, admin). `getCurrentUser()` adds `coins` = total. Both are caches; truth is `CoinTransaction` (signed `amount` = `paid` + `bonus`; reasons PURCHASE | UNLOCK | CHECKIN | BONUS | REFUND | ADMIN | POLL_BOOST | SKIN | SCENE | CHAT | PHOTO).
- Every change = ledger row + balance update in ONE transaction. Credits: `grantCoins(userId, amount, reason, extra, tx)` (picks the bucket by reason).
- Debits: `spendCoins(tx, …)` (bonus first, conditional `updateMany` on both buckets, retries a lost race) — or for anything a creator sells, `chargeForContent(tx, {…})`, which also writes `CreatorEarning`: `coins` (withdrawable) = 50% of the **paid** part only, `credits` (= `genCredits` for AI generation) = the rest of the 50% share. Pure math: `splitCharge` / `splitShare` in `access.ts`.
- `unlockEpisode` creates the unique `Unlock` first (P2002 → whole tx rolls back), then `chargeForContent`. Add-ons (skins, roulette, scenes, poll boosts, chat messages, photos) live in `src/lib/extras.ts` and follow the same pattern; owners get them free.
- Kids mode: no one-tap spending — `unlockEpisodeAction` refuses; the parental gate (`actions/kids.ts`) needs the PIN. 18+ add-ons are gated by `spicyBlock()` (kids mode / family series / 18+ not confirmed).
- Already unlocked / free / own content → `{ charged: 0 }`, never a second charge.
- Price = `episode.coinPrice ?? series.defaultCoinPrice`, read on the server.

## Payments (`src/lib/payments/`)
`catalog.ts` = SKUs and prices (`COIN_PACKS`, `VIP_PLANS`). `createOrder()` → `provider.checkout()` → later `fulfillOrder(orderId)` which is idempotent (PENDING→PAID guard) and grants coins or extends VIP from the later of now/current end. `MockProvider` is used unless production without `ALLOW_MOCK_PAYMENTS=1`. Real providers: see `docs/payments.md`.

## Daily check-in
`dailyCheckIn(userId)` — one per UTC day (PK `userId+day`); streak/reward logic is pure in `src/lib/rewards.ts` (`nextCheckIn`, 7-day `CHECKIN_REWARDS`).

## Tests
`src/lib/coins.db.test.ts` and `src/lib/extras.db.test.ts` (real SQLite `prisma/test.db`) cover paid/bonus split, add-ons, chat pricing, kids PIN lockout, insufficient funds, idempotency, concurrent double-click, creator share, order idempotency, VIP extension, check-in. Any change here must keep `npm test` green and add a case for new behavior.

## Common mistakes
Checking access only in UI · `paidCoins - price` computed in JS then saved · charging before checking the existing unlock · forgetting the creator earning · granting coins without a ledger row.
