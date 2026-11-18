-- CreateTable
CREATE TABLE "SongUse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "songId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "atSec" REAL NOT NULL DEFAULT 0,
    "lenSec" REAL NOT NULL DEFAULT 30,
    "addedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SongUse_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SongUse_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TvClip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SHOW',
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL DEFAULT '',
    "beatJson" TEXT NOT NULL DEFAULT '',
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
INSERT INTO "new_TvClip" ("ageRating", "aiTools", "artist", "bountyPaidAt", "bountyZone", "captions", "channelId", "createdAt", "creatorId", "durationSec", "id", "kind", "lore", "orientation", "plays", "prompts", "seriesId", "sponsorName", "status", "tags", "title", "videoUrl") SELECT "ageRating", "aiTools", "artist", "bountyPaidAt", "bountyZone", "captions", "channelId", "createdAt", "creatorId", "durationSec", "id", "kind", "lore", "orientation", "plays", "prompts", "seriesId", "sponsorName", "status", "tags", "title", "videoUrl" FROM "TvClip";
DROP TABLE "TvClip";
ALTER TABLE "new_TvClip" RENAME TO "TvClip";
CREATE INDEX "TvClip_channelId_status_kind_idx" ON "TvClip"("channelId", "status", "kind");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SongUse_episodeId_idx" ON "SongUse"("episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "SongUse_songId_episodeId_key" ON "SongUse"("songId", "episodeId");
