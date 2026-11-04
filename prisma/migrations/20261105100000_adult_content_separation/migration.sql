-- 18+ separation: series flag + viewer opt-in (off by default).
ALTER TABLE "Series" ADD COLUMN "isAdult" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "showAdult" BOOLEAN NOT NULL DEFAULT false;
-- Viewers who already confirmed 18+ (bought fan-service) keep seeing it.
UPDATE "User" SET "showAdult" = true WHERE "adultConfirmedAt" IS NOT NULL;
