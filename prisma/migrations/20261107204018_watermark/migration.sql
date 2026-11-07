-- CreateTable
CREATE TABLE "WatermarkAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceRef" TEXT NOT NULL,
    "dir" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "segments" INTEGER NOT NULL DEFAULT 0,
    "segSec" INTEGER NOT NULL DEFAULT 2,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" DATETIME
);

-- CreateTable
CREATE TABLE "WatermarkSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatermarkSession_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "WatermarkAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WatermarkSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WatermarkAsset_sourceRef_key" ON "WatermarkAsset"("sourceRef");

-- CreateIndex
CREATE UNIQUE INDEX "WatermarkAsset_dir_key" ON "WatermarkAsset"("dir");

-- CreateIndex
CREATE UNIQUE INDEX "WatermarkSession_assetId_userId_key" ON "WatermarkSession"("assetId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "WatermarkSession_assetId_code_key" ON "WatermarkSession"("assetId", "code");
