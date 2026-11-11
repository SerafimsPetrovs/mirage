-- CreateTable
CREATE TABLE "TvChannel" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TvClip" (
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
    CONSTRAINT "TvClip_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "TvChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TvClip_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TvSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "clipId" TEXT,
    "episodeId" TEXT,
    "textRu" TEXT NOT NULL DEFAULT '',
    "textEn" TEXT NOT NULL DEFAULT '',
    "breakClipId" TEXT,
    CONSTRAINT "TvSlot_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "TvChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TvSlot_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "TvClip" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TvSlot_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TvMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "reports" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TvMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "TvChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TvMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TvTicker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "coins" INTEGER NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TvTicker_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "TvChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TvTicker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TvOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "idea" TEXT NOT NULL,
    "prompt" TEXT NOT NULL DEFAULT '',
    "coins" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATING',
    "jobId" TEXT,
    "clipId" TEXT,
    "rejectReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "airedAt" DATETIME,
    CONSTRAINT "TvOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TvOrder_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "TvChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TvOrder_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "TvClip" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TvClipLike" (
    "userId" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "clipId"),
    CONSTRAINT "TvClipLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TvClipLike_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "TvClip" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TvChannel_slug_key" ON "TvChannel"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TvChannel_number_key" ON "TvChannel"("number");

-- CreateIndex
CREATE INDEX "TvClip_channelId_status_kind_idx" ON "TvClip"("channelId", "status", "kind");

-- CreateIndex
CREATE INDEX "TvSlot_channelId_day_idx" ON "TvSlot"("channelId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "TvSlot_channelId_startsAt_key" ON "TvSlot"("channelId", "startsAt");

-- CreateIndex
CREATE INDEX "TvMessage_channelId_createdAt_idx" ON "TvMessage"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "TvTicker_channelId_createdAt_idx" ON "TvTicker"("channelId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TvOrder_clipId_key" ON "TvOrder"("clipId");

-- CreateIndex
CREATE INDEX "TvOrder_status_createdAt_idx" ON "TvOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TvOrder_userId_idx" ON "TvOrder"("userId");

-- CreateIndex
CREATE INDEX "TvClipLike_clipId_createdAt_idx" ON "TvClipLike"("clipId", "createdAt");
