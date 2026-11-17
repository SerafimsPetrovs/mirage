import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { mediaUrl } from "@/lib/files";
import { musicChannels } from "@/lib/music";
import { songChart } from "@/lib/songs";
import { getI18n } from "@/i18n/server";
import { pick } from "@/i18n/shared";
import { EmptyState } from "@/components/ui/misc";
import { SongList } from "@/components/songs/song-list";
import { SongsNav } from "@/components/songs/songs-nav";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.songs.chart, description: t.songs.chartSub };
}

/** Weekly chart by ♥. Admins send songs from here to the music channel (a video is rendered automatically). */
export default async function ChartPage() {
  const [{ t, locale }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  const s = t.songs;
  const [chart, channels] = await Promise.all([songChart(), user?.role === "ADMIN" ? musicChannels() : Promise.resolve([])]);
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-[calc(var(--header-h)+24px)] md:px-10">
      <SongsNav active="chart" />
      <h1 className="font-display text-2xl font-bold md:text-3xl">{s.chart}</h1>
      <p className="mb-6 mt-1 text-muted">{s.chartSub}</p>
      {chart.length === 0 ? (
        <EmptyState icon={<BarChart3 size={24} />} title={s.empty} />
      ) : (
        <SongList
          numbered
          admin={user?.role === "ADMIN" ? { channels: channels.map((c) => ({ id: c.id, name: pick(c, "name", locale) })) } : undefined}
          songs={chart.map(({ song, week }) => ({
            id: song.id,
            title: song.title,
            artist: song.artist,
            cover: mediaUrl(song.coverRef),
            userName: song.user.name,
            aiTool: song.aiTool,
            saves: song.saves,
            airedTrackId: song.airedTrackId,
            durationSec: song.durationSec,
            week,
          }))}
        />
      )}
    </div>
  );
}
