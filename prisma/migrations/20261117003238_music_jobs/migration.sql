-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MusicTrack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL DEFAULT '',
    "audioRef" TEXT NOT NULL,
    "coverRef" TEXT,
    "imagesJson" TEXT NOT NULL DEFAULT '[]',
    "lyrics" TEXT NOT NULL DEFAULT '',
    "lrcJson" TEXT NOT NULL DEFAULT '',
    "style" TEXT NOT NULL DEFAULT 'KARAOKE',
    "orientation" TEXT NOT NULL DEFAULT 'HORIZONTAL',
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "bpm" REAL NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'ADMIN',
    "coins" INTEGER NOT NULL DEFAULT 0,
    "rightsOk" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "videoRef" TEXT,
    "clipId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MusicTrack_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "TvChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MusicTrack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Job_status_runAt_idx" ON "Job"("status", "runAt");

-- CreateIndex
CREATE INDEX "MusicTrack_status_idx" ON "MusicTrack"("status");

-- CreateIndex
CREATE INDEX "MusicTrack_userId_idx" ON "MusicTrack"("userId");
