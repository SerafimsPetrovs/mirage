import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { mediaUrl } from "@/lib/files";
import { mySongs } from "@/lib/songs";
import { getI18n } from "@/i18n/server";
import { btn } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { SongList, type ListSong } from "@/components/songs/song-list";
import { SongsNav } from "@/components/songs/songs-nav";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.songs.library };
}

type Row = Awaited<ReturnType<typeof mySongs>>["saved"][number] & { status?: string };
const toList = (x: Row): ListSong => ({
  id: x.id,
  title: x.title,
  artist: x.artist,
  cover: mediaUrl(x.coverRef),
  userName: x.user.name,
  aiTool: x.aiTool,
  saves: x.saves,
  airedTrackId: x.airedTrackId,
  durationSec: x.durationSec,
  hidden: x.status === "HIDDEN",
});

/** "My music": every song ♥'d in the feed, plus my own uploads. */
export default async function LibraryPage() {
  const user = await requireUser("/songs/library");
  const { t } = await getI18n();
  const s = t.songs;
  const { saved, uploaded } = await mySongs(user.id);
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-[calc(var(--header-h)+24px)] md:px-10">
      <SongsNav active="library" />
      <h1 className="mb-5 font-display text-2xl font-bold md:text-3xl">{s.library}</h1>
      {saved.length ? (
        <SongList songs={saved.map(toList)} />
      ) : (
        <EmptyState icon={<Heart size={24} />} title={s.noSaved} action={<Link href="/songs" className={btn("primary", "md")}>{s.feed}</Link>} />
      )}
      {uploaded.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-xl font-semibold">{s.myUploads}</h2>
          <SongList songs={uploaded.map(toList)} />
        </section>
      )}
    </div>
  );
}
