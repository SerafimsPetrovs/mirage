-- AlterTable
ALTER TABLE "Party" ADD COLUMN "foodEtaSetAt" DATETIME;

-- CreateTable
CREATE TABLE "OutboundClick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "userId" TEXT,
    "partyId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "OutboundClick_kind_createdAt_idx" ON "OutboundClick"("kind", "createdAt");
