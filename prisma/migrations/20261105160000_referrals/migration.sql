-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarHue" INTEGER NOT NULL DEFAULT 330,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "paidCoins" INTEGER NOT NULL DEFAULT 0,
    "bonusCoins" INTEGER NOT NULL DEFAULT 0,
    "genCredits" INTEGER NOT NULL DEFAULT 100,
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
INSERT INTO "new_User" ("adultConfirmedAt", "avatarHue", "banned", "bio", "bonusCoins", "createdAt", "email", "genCredits", "id", "kidsPinFails", "kidsPinHash", "kidsPinLockedUntil", "name", "paidCoins", "passwordHash", "payoutCoins", "role", "showAdult") SELECT "adultConfirmedAt", "avatarHue", "banned", "bio", "bonusCoins", "createdAt", "email", "genCredits", "id", "kidsPinFails", "kidsPinHash", "kidsPinLockedUntil", "name", "paidCoins", "passwordHash", "payoutCoins", "role", "showAdult" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_refCode_key" ON "User"("refCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

