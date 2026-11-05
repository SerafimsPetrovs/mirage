-- CreateTable
CREATE TABLE "Cameo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "seriesId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'BOUGHT',
    "coins" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "episodeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cameo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Cameo_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Cameo_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShowScript" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seriesId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pollQuestion" TEXT NOT NULL,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "episodeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShowScript_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "isAdult" BOOLEAN NOT NULL DEFAULT false,
    "adultLocked" BOOLEAN NOT NULL DEFAULT false,
    "interactive" BOOLEAN NOT NULL DEFAULT false,
    "freeEpisodes" INTEGER NOT NULL DEFAULT 5,
    "defaultCoinPrice" INTEGER NOT NULL DEFAULT 30,
    "views" INTEGER NOT NULL DEFAULT 0,
    "creatorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "publishedAt" DATETIME,
    CONSTRAINT "Series_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Series" ("adultLocked", "ageRating", "aiModels", "backdropUrl", "createdAt", "creatorId", "defaultCoinPrice", "descriptionEn", "descriptionRu", "featured", "freeEpisodes", "genres", "hue", "id", "isAdult", "isFamilySafe", "moods", "orientation", "posterUrl", "promptNotesEn", "promptNotesRu", "publishedAt", "rejectReason", "slug", "status", "taglineEn", "taglineRu", "titleEn", "titleRu", "updatedAt", "views") SELECT "adultLocked", "ageRating", "aiModels", "backdropUrl", "createdAt", "creatorId", "defaultCoinPrice", "descriptionEn", "descriptionRu", "featured", "freeEpisodes", "genres", "hue", "id", "isAdult", "isFamilySafe", "moods", "orientation", "posterUrl", "promptNotesEn", "promptNotesRu", "publishedAt", "rejectReason", "slug", "status", "taglineEn", "taglineRu", "titleEn", "titleRu", "updatedAt", "views" FROM "Series";
DROP TABLE "Series";
ALTER TABLE "new_Series" RENAME TO "Series";
CREATE UNIQUE INDEX "Series_slug_key" ON "Series"("slug");
CREATE INDEX "Series_status_featured_idx" ON "Series"("status", "featured");
CREATE INDEX "Series_creatorId_idx" ON "Series"("creatorId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Cameo_seriesId_status_idx" ON "Cameo"("seriesId", "status");

-- CreateIndex
CREATE INDEX "Cameo_userId_idx" ON "Cameo"("userId");

-- CreateIndex
CREATE INDEX "ShowScript_seriesId_number_idx" ON "ShowScript"("seriesId", "number");

