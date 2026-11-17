-- CreateTable
CREATE TABLE "TvMoment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "channelSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "startSec" REAL NOT NULL,
    "durationSec" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "videoRef" TEXT,
    "thumbRef" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TvMoment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TvMoment_userId_idx" ON "TvMoment"("userId");
