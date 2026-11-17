-- CreateTable
CREATE TABLE "TvChannelStat" (
    "channelId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "peak" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("channelId", "day", "hour")
);

-- CreateIndex
CREATE INDEX "TvChannelStat_day_idx" ON "TvChannelStat"("day");
