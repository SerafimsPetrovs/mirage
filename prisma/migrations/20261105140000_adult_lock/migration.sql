-- Moderator-set 18+ flag that creators cannot remove
ALTER TABLE "Series" ADD COLUMN "adultLocked" BOOLEAN NOT NULL DEFAULT false;
