-- CreateTable
CREATE TABLE "KidsAllowance" (
    "userId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "day" TEXT NOT NULL,

    PRIMARY KEY ("userId", "seriesId", "day"),
    CONSTRAINT "KidsAllowance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KidsAllowance_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PollBoost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "votes" INTEGER NOT NULL,
    "coins" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PollBoost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PollBoost_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PollBoost_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PollOption" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Skin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "episodeId" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '👗',
    "rarity" TEXT NOT NULL DEFAULT 'common',
    "videoUrl" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 40,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Skin_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SkinUnlock" (
    "userId" TEXT NOT NULL,
    "skinId" TEXT NOT NULL,
    "via" TEXT NOT NULL DEFAULT 'buy',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "skinId"),
    CONSTRAINT "SkinUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SkinUnlock_skinId_fkey" FOREIGN KEY ("skinId") REFERENCES "Skin" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BonusScene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "episodeId" TEXT NOT NULL,
    "titleRu" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL DEFAULT 30,
    "price" INTEGER NOT NULL DEFAULT 30,
    "triggerAtSec" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BonusScene_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SceneUnlock" (
    "userId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "sceneId"),
    CONSTRAINT "SceneUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SceneUnlock_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "BonusScene" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seriesId" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "taglineRu" TEXT NOT NULL DEFAULT '',
    "taglineEn" TEXT NOT NULL DEFAULT '',
    "greetingRu" TEXT NOT NULL DEFAULT '',
    "greetingEn" TEXT NOT NULL DEFAULT '',
    "persona" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "avatarUrl" TEXT,
    "hue" INTEGER NOT NULL DEFAULT 330,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Character_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CharacterPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "captionRu" TEXT NOT NULL DEFAULT '',
    "captionEn" TEXT NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL DEFAULT 25,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CharacterPhoto_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PhotoUnlock" (
    "userId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "photoId"),
    CONSTRAINT "PhotoUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PhotoUnlock_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "CharacterPhoto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "userMessages" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChatThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatThread_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "photoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "CharacterPhoto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CoinTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paid" INTEGER NOT NULL DEFAULT 0,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "episodeId" TEXT,
    "orderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoinTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoinTransaction_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CoinTransaction" ("amount", "paid", "bonus", "createdAt", "episodeId", "id", "note", "orderId", "reason", "userId") SELECT "amount", CASE WHEN "reason" = 'PURCHASE' THEN "amount" ELSE 0 END, CASE WHEN "reason" = 'PURCHASE' THEN 0 ELSE "amount" END, "createdAt", "episodeId", "id", "note", "orderId", "reason", "userId" FROM "CoinTransaction";
DROP TABLE "CoinTransaction";
ALTER TABLE "new_CoinTransaction" RENAME TO "CoinTransaction";
CREATE INDEX "CoinTransaction_userId_createdAt_idx" ON "CoinTransaction"("userId", "createdAt");
CREATE TABLE "new_CreatorEarning" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creatorId" TEXT NOT NULL,
    "episodeId" TEXT,
    "seriesId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'UNLOCK',
    "coins" INTEGER NOT NULL DEFAULT 0,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreatorEarning_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreatorEarning_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CreatorEarning_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CreatorEarning" ("coins", "createdAt", "creatorId", "episodeId", "id") SELECT "coins", "createdAt", "creatorId", "episodeId", "id" FROM "CreatorEarning";
DROP TABLE "CreatorEarning";
ALTER TABLE "new_CreatorEarning" RENAME TO "CreatorEarning";
CREATE INDEX "CreatorEarning_creatorId_createdAt_idx" ON "CreatorEarning"("creatorId", "createdAt");
CREATE TABLE "new_Series" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "titleRu" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "taglineRu" TEXT NOT NULL DEFAULT '',
    "taglineEn" TEXT NOT NULL DEFAULT '',
    "descriptionRu" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "orientation" TEXT NOT NULL DEFAULT 'VERTICAL',
    "posterUrl" TEXT,
    "backdropUrl" TEXT,
    "hue" INTEGER NOT NULL DEFAULT 330,
    "genres" TEXT NOT NULL DEFAULT '',
    "moods" TEXT NOT NULL DEFAULT '',
    "aiModels" TEXT NOT NULL DEFAULT '',
    "promptNotesRu" TEXT NOT NULL DEFAULT '',
    "promptNotesEn" TEXT NOT NULL DEFAULT '',
    "ageRating" TEXT NOT NULL DEFAULT '16+',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "rejectReason" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "isFamilySafe" BOOLEAN NOT NULL DEFAULT false,
    "freeEpisodes" INTEGER NOT NULL DEFAULT 5,
    "defaultCoinPrice" INTEGER NOT NULL DEFAULT 30,
    "views" INTEGER NOT NULL DEFAULT 0,
    "creatorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "publishedAt" DATETIME,
    CONSTRAINT "Series_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Series" ("ageRating", "aiModels", "backdropUrl", "createdAt", "creatorId", "defaultCoinPrice", "descriptionEn", "descriptionRu", "featured", "freeEpisodes", "genres", "hue", "id", "moods", "orientation", "posterUrl", "promptNotesEn", "promptNotesRu", "publishedAt", "rejectReason", "slug", "status", "taglineEn", "taglineRu", "titleEn", "titleRu", "updatedAt", "views") SELECT "ageRating", "aiModels", "backdropUrl", "createdAt", "creatorId", "defaultCoinPrice", "descriptionEn", "descriptionRu", "featured", "freeEpisodes", "genres", "hue", "id", "moods", "orientation", "posterUrl", "promptNotesEn", "promptNotesRu", "publishedAt", "rejectReason", "slug", "status", "taglineEn", "taglineRu", "titleEn", "titleRu", "updatedAt", "views" FROM "Series";
DROP TABLE "Series";
ALTER TABLE "new_Series" RENAME TO "Series";
CREATE UNIQUE INDEX "Series_slug_key" ON "Series"("slug");
CREATE INDEX "Series_status_featured_idx" ON "Series"("status", "featured");
CREATE INDEX "Series_creatorId_idx" ON "Series"("creatorId");
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kidsMode" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Session" ("createdAt", "expiresAt", "id", "userId") SELECT "createdAt", "expiresAt", "id", "userId" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
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
    "bio" TEXT,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("avatarHue", "banned", "bio", "createdAt", "email", "genCredits", "id", "name", "passwordHash", "role", "paidCoins", "bonusCoins") SELECT "avatarHue", "banned", "bio", "createdAt", "email", "genCredits", "id", "name", "passwordHash", "role", MIN("coins", MAX(0, COALESCE((SELECT SUM(t."amount") FROM "CoinTransaction" t WHERE t."userId" = "User"."id" AND t."reason" = 'PURCHASE'), 0))), "coins" - MIN("coins", MAX(0, COALESCE((SELECT SUM(t."amount") FROM "CoinTransaction" t WHERE t."userId" = "User"."id" AND t."reason" = 'PURCHASE'), 0))) FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PollBoost_pollId_idx" ON "PollBoost"("pollId");

-- CreateIndex
CREATE INDEX "Skin_episodeId_idx" ON "Skin"("episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "BonusScene_episodeId_key" ON "BonusScene"("episodeId");

-- CreateIndex
CREATE INDEX "Character_seriesId_idx" ON "Character"("seriesId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatThread_userId_characterId_key" ON "ChatThread"("userId", "characterId");

-- CreateIndex
CREATE INDEX "ChatMessage_threadId_createdAt_idx" ON "ChatMessage"("threadId", "createdAt");

