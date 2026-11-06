-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" DATETIME;

-- CreateTable
CREATE TABLE "EmailVerification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerification_tokenHash_key" ON "EmailVerification"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerification_userId_createdAt_idx" ON "EmailVerification"("userId", "createdAt");


-- Accounts created before email confirmation existed count as confirmed.
UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;
