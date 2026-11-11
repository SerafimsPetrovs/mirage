-- AlterTable
ALTER TABLE "Episode" ADD COLUMN "publishAt" DATETIME;

-- CreateTable
CREATE TABLE "TvFunnelClick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seriesId" TEXT NOT NULL,
    "channelId" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TvFunnelClick_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TvFunnelClick_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "TvChannel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TvAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT,
    "text" TEXT NOT NULL,
    "until" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TvAlert_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "TvChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TvInjection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT,
    "text" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'PIP',
    "tone" TEXT NOT NULL DEFAULT 'AUTO',
    "timeline" TEXT NOT NULL,
    "audioUrl" TEXT,
    "startsAt" DATETIME NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TvInjection_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "TvChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MascotClip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "emotion" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 800,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CreatorInvite" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "usedById" TEXT,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreatorInvite_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreatorInvite_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreatorTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creatorId" TEXT NOT NULL,
    "seriesId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "dueAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "checklist" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CreatorTask_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreatorTask_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiApp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taglineRu" TEXT NOT NULL DEFAULT '',
    "taglineEn" TEXT NOT NULL DEFAULT '',
    "descriptionRu" TEXT NOT NULL DEFAULT '',
    "descriptionEn" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'TOOLS',
    "hue" INTEGER NOT NULL DEFAULT 260,
    "priceCoins" INTEGER NOT NULL DEFAULT 0,
    "winFile" TEXT NOT NULL DEFAULT '',
    "macFile" TEXT NOT NULL DEFAULT '',
    "webUrl" TEXT NOT NULL DEFAULT '',
    "requirements" TEXT NOT NULL DEFAULT '',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AiAppPurchase" (
    "userId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "coins" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "appId"),
    CONSTRAINT "AiAppPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiAppPurchase_appId_fkey" FOREIGN KEY ("appId") REFERENCES "AiApp" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TvChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "taglineRu" TEXT NOT NULL DEFAULT '',
    "taglineEn" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL,
    "genres" TEXT NOT NULL DEFAULT '',
    "hue" INTEGER NOT NULL DEFAULT 330,
    "hostName" TEXT NOT NULL,
    "hostPersona" TEXT NOT NULL DEFAULT '',
    "familyOnly" BOOLEAN NOT NULL DEFAULT false,
    "isAdult" BOOLEAN NOT NULL DEFAULT false,
    "ticker" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quiz" BOOLEAN NOT NULL DEFAULT true,
    "bufferTargetMin" INTEGER NOT NULL DEFAULT 120,
    "bountyUntil" DATETIME
);
INSERT INTO "new_TvChannel" ("active", "createdAt", "familyOnly", "genres", "hostName", "hostPersona", "hue", "id", "isAdult", "kind", "nameEn", "nameRu", "number", "quiz", "slug", "taglineEn", "taglineRu", "ticker") SELECT "active", "createdAt", "familyOnly", "genres", "hostName", "hostPersona", "hue", "id", "isAdult", "kind", "nameEn", "nameRu", "number", "quiz", "slug", "taglineEn", "taglineRu", "ticker" FROM "TvChannel";
DROP TABLE "TvChannel";
ALTER TABLE "new_TvChannel" RENAME TO "TvChannel";
CREATE UNIQUE INDEX "TvChannel_slug_key" ON "TvChannel"("slug");
CREATE UNIQUE INDEX "TvChannel_number_key" ON "TvChannel"("number");
CREATE TABLE "new_TvClip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SHOW',
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL DEFAULT '',
    "videoUrl" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL DEFAULT 30,
    "orientation" TEXT NOT NULL DEFAULT 'HORIZONTAL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sponsorName" TEXT,
    "creatorId" TEXT,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lore" TEXT NOT NULL DEFAULT '',
    "aiTools" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '',
    "ageRating" TEXT NOT NULL DEFAULT '12+',
    "prompts" TEXT NOT NULL DEFAULT '',
    "captions" TEXT NOT NULL DEFAULT '',
    "seriesId" TEXT,
    "bountyZone" TEXT NOT NULL DEFAULT '',
    "bountyPaidAt" DATETIME,
    CONSTRAINT "TvClip_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "TvChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TvClip_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TvClip_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TvClip" ("artist", "channelId", "createdAt", "creatorId", "durationSec", "id", "kind", "orientation", "plays", "sponsorName", "status", "title", "videoUrl") SELECT "artist", "channelId", "createdAt", "creatorId", "durationSec", "id", "kind", "orientation", "plays", "sponsorName", "status", "title", "videoUrl" FROM "TvClip";
DROP TABLE "TvClip";
ALTER TABLE "new_TvClip" RENAME TO "TvClip";
CREATE INDEX "TvClip_channelId_status_kind_idx" ON "TvClip"("channelId", "status", "kind");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TvFunnelClick_seriesId_createdAt_idx" ON "TvFunnelClick"("seriesId", "createdAt");

-- CreateIndex
CREATE INDEX "TvAlert_until_idx" ON "TvAlert"("until");

-- CreateIndex
CREATE INDEX "TvInjection_startsAt_idx" ON "TvInjection"("startsAt");

-- CreateIndex
CREATE INDEX "MascotClip_emotion_active_idx" ON "MascotClip"("emotion", "active");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorInvite_usedById_key" ON "CreatorInvite"("usedById");

-- CreateIndex
CREATE INDEX "CreatorInvite_ownerId_idx" ON "CreatorInvite"("ownerId");

-- CreateIndex
CREATE INDEX "CreatorTask_creatorId_status_idx" ON "CreatorTask"("creatorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AiApp_slug_key" ON "AiApp"("slug");
