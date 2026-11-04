-- Creator payouts: withdrawable balance cache + withdrawal requests.
ALTER TABLE "User" ADD COLUMN "payoutCoins" INTEGER NOT NULL DEFAULT 0;
UPDATE "User" SET "payoutCoins" = COALESCE((SELECT SUM("coins") FROM "CreatorEarning" WHERE "creatorId" = "User"."id"), 0);

CREATE TABLE "Payout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "coins" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "method" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    CONSTRAINT "Payout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Payout_userId_createdAt_idx" ON "Payout"("userId", "createdAt");
CREATE INDEX "Payout_status_createdAt_idx" ON "Payout"("status", "createdAt");
