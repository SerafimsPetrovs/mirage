-- AlterTable
ALTER TABLE "User" ADD COLUMN "tvMutedUntil" DATETIME;

-- CreateTable
CREATE TABLE "TvPoll" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "winner" INTEGER,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TvPoll_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "TvChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TvPollVote" (
    "pollId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "option" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("pollId", "userId"),
    CONSTRAINT "TvPollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "TvPoll" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TvPollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TvQuizAnswer" (
    "slotId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "choice" INTEGER NOT NULL,
    "rewarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("slotId", "userId"),
    CONSTRAINT "TvQuizAnswer_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "TvSlot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TvQuizAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TvWatch" (
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "rewarded" INTEGER NOT NULL DEFAULT 0,
    "lastBeat" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "day"),
    CONSTRAINT "TvWatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TvGame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "score" INTEGER,
    "gold" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TvGame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TvFactoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SHOW',
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "jobId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "clipId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TvFactoryItem_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "TvChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "quiz" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_TvChannel" ("active", "createdAt", "familyOnly", "genres", "hostName", "hostPersona", "hue", "id", "isAdult", "kind", "nameEn", "nameRu", "number", "slug", "taglineEn", "taglineRu", "ticker") SELECT "active", "createdAt", "familyOnly", "genres", "hostName", "hostPersona", "hue", "id", "isAdult", "kind", "nameEn", "nameRu", "number", "slug", "taglineEn", "taglineRu", "ticker" FROM "TvChannel";
DROP TABLE "TvChannel";
ALTER TABLE "new_TvChannel" RENAME TO "TvChannel";
CREATE UNIQUE INDEX "TvChannel_slug_key" ON "TvChannel"("slug");
CREATE UNIQUE INDEX "TvChannel_number_key" ON "TvChannel"("number");
CREATE TABLE "new_TvMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "paid" INTEGER NOT NULL DEFAULT 0,
    "reports" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TvMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "TvChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TvMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TvMessage" ("channelId", "createdAt", "hidden", "id", "reports", "text", "userId") SELECT "channelId", "createdAt", "hidden", "id", "reports", "text", "userId" FROM "TvMessage";
DROP TABLE "TvMessage";
ALTER TABLE "new_TvMessage" RENAME TO "TvMessage";
CREATE INDEX "TvMessage_channelId_createdAt_idx" ON "TvMessage"("channelId", "createdAt");
CREATE TABLE "new_TvSlot" (
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
    "data" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "TvSlot_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "TvChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TvSlot_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "TvClip" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TvSlot_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TvSlot" ("breakClipId", "channelId", "clipId", "day", "durationSec", "episodeId", "id", "kind", "startsAt", "textEn", "textRu") SELECT "breakClipId", "channelId", "clipId", "day", "durationSec", "episodeId", "id", "kind", "startsAt", "textEn", "textRu" FROM "TvSlot";
DROP TABLE "TvSlot";
ALTER TABLE "new_TvSlot" RENAME TO "TvSlot";
CREATE INDEX "TvSlot_channelId_day_idx" ON "TvSlot"("channelId", "day");
CREATE UNIQUE INDEX "TvSlot_channelId_startsAt_key" ON "TvSlot"("channelId", "startsAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TvPoll_channelId_resolved_endsAt_idx" ON "TvPoll"("channelId", "resolved", "endsAt");

-- CreateIndex
CREATE INDEX "TvGame_userId_startedAt_idx" ON "TvGame"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "TvFactoryItem_channelId_createdAt_idx" ON "TvFactoryItem"("channelId", "createdAt");
