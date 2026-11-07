-- CreateTable
CREATE TABLE "GoldTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refId" TEXT,
    "day" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GoldTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seriesId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "questionRu" TEXT NOT NULL,
    "questionEn" TEXT NOT NULL,
    "allowCustom" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Prediction_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Prediction_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PredictionOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "predictionId" TEXT NOT NULL,
    "labelRu" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PredictionOption_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "Prediction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PredictionBet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "predictionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optionId" TEXT,
    "customText" TEXT,
    "stake" INTEGER NOT NULL,
    "customOk" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payout" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PredictionBet_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "Prediction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PredictionBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PredictionBet_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PredictionOption" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" DATETIME,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarHue" INTEGER NOT NULL DEFAULT 330,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "paidCoins" INTEGER NOT NULL DEFAULT 0,
    "bonusCoins" INTEGER NOT NULL DEFAULT 0,
    "genCredits" INTEGER NOT NULL DEFAULT 100,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "kidsPinHash" TEXT,
    "kidsPinFails" INTEGER NOT NULL DEFAULT 0,
    "kidsPinLockedUntil" DATETIME,
    "adultConfirmedAt" DATETIME,
    "showAdult" BOOLEAN NOT NULL DEFAULT false,
    "payoutCoins" INTEGER NOT NULL DEFAULT 0,
    "refCode" TEXT,
    "referredById" TEXT,
    "refRewardedAt" DATETIME,
    "bio" TEXT,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("adultConfirmedAt", "avatarHue", "banned", "bio", "bonusCoins", "createdAt", "email", "emailVerifiedAt", "genCredits", "id", "kidsPinFails", "kidsPinHash", "kidsPinLockedUntil", "name", "paidCoins", "passwordHash", "payoutCoins", "refCode", "refRewardedAt", "referredById", "role", "showAdult") SELECT "adultConfirmedAt", "avatarHue", "banned", "bio", "bonusCoins", "createdAt", "email", "emailVerifiedAt", "genCredits", "id", "kidsPinFails", "kidsPinHash", "kidsPinLockedUntil", "name", "paidCoins", "passwordHash", "payoutCoins", "refCode", "refRewardedAt", "referredById", "role", "showAdult" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_refCode_key" ON "User"("refCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "GoldTransaction_userId_reason_day_idx" ON "GoldTransaction"("userId", "reason", "day");

-- CreateIndex
CREATE INDEX "GoldTransaction_userId_createdAt_idx" ON "GoldTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Prediction_seriesId_createdAt_idx" ON "Prediction"("seriesId", "createdAt");

-- CreateIndex
CREATE INDEX "Prediction_episodeId_idx" ON "Prediction"("episodeId");

-- CreateIndex
CREATE INDEX "PredictionBet_predictionId_idx" ON "PredictionBet"("predictionId");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionBet_predictionId_userId_key" ON "PredictionBet"("predictionId", "userId");
