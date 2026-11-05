-- CreateTable
CREATE TABLE "AdView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "unlocked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "AdView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AdView_userId_episodeId_idx" ON "AdView"("userId", "episodeId");

-- CreateIndex
CREATE INDEX "AdView_userId_startedAt_idx" ON "AdView"("userId", "startedAt");

