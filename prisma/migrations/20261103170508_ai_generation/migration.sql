-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "style" TEXT NOT NULL DEFAULT 'cinematic',
    "orientation" TEXT NOT NULL DEFAULT 'VERTICAL',
    "durationSec" INTEGER NOT NULL DEFAULT 5,
    "seed" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "resultUrl" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "GenerationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "coins" INTEGER NOT NULL DEFAULT 0,
    "genCredits" INTEGER NOT NULL DEFAULT 100,
    "bio" TEXT,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("avatarHue", "banned", "bio", "coins", "createdAt", "email", "id", "name", "passwordHash", "role") SELECT "avatarHue", "banned", "bio", "coins", "createdAt", "email", "id", "name", "passwordHash", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "GenerationJob_userId_createdAt_idx" ON "GenerationJob"("userId", "createdAt");
