import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { mediaUrl } from "@/lib/files";
import { songFeed } from "@/lib/songs";
import { getI18n } from "@/i18n/server";
import { SongFeed } from "@/components/songs/song-feed";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.songs.nav, description: t.songs.tapHint };
}

/** The song feed: hooks, one per screen. */
export default async function SongsFeedPage() {
  const user = await getCurrentUser();
  const viewer = user && !user.kidsMode ? user : null;
  const items = await songFeed(viewer);
  return <SongFeed loggedIn={!!viewer} initial={items.map((s) => ({ ...s, cover: mediaUrl(s.coverRef) }))} />;
}
