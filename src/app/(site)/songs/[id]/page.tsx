import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Headphones, Heart, Music2, Radio, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { mediaUrl } from "@/lib/files";
import { getSong } from "@/lib/songs";
import { isAiMusic } from "@/lib/song-rules";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/shared";
import { SongList } from "@/components/songs/song-list";
import { SongsNav } from "@/components/songs/songs-nav";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [s, { t }] = await Promise.all([getSong(id), getI18n()]);
  if (!s || s.status !== "PUBLISHED") return {};
  const image = mediaUrl(s.coverRef);
  const title = `${s.title} — ${s.artist || s.user.name}`;
  return {
    title,
    description: t.songs.tapHint,
    openGraph: { type: "music.song", title, images: image ? [{ url: image }] : undefined, audio: [{ url: `/api/songs/${s.id}/audio` }] },
    twitter: { card: "summary", title, images: image ? [image] : undefined },
  };
}

/** Public song page: play it, ♥ it, read the lyrics; shared links land here. */
export default async function SongPage({ params }: Props) {
  const { id } = await params;
  const [s, { t }, user] = await Promise.all([getSong(id), getI18n(), getCurrentUser()]);
  if (!s) notFound();
  const visible = s.status === "PUBLISHED" || (user && (user.id === s.user.id || user.role === "ADMIN"));
  if (!visible) notFound();
  const cover = mediaUrl(s.coverRef);
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-[calc(var(--header-h)+24px)] md:px-10">
      <SongsNav active="song" />
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <div className="h-48 w-48 shrink-0 overflow-hidden rounded-3xl bg-gradient-to-br from-[#7c5cff] to-[#ff2e63] shadow-2xl ring-1 ring-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cover ? <img src={cover} alt={s.title} className="h-full w-full object-cover" /> : <Music2 size={64} className="m-auto mt-16 text-white/80" />}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5">
            {isAiMusic(s.aiTool) && <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold"><Sparkles size={12} /> {t.songs.ai}</span>}
            {s.airedTrackId && <span className="flex items-center gap-1 rounded-full bg-[#ff3b3b]/20 px-2 py-0.5 text-xs font-semibold text-[#ff8080]"><Radio size={12} /> {t.songs.aired}</span>}
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">{s.title}</h1>
          <p className="mt-1 text-lg text-muted">{s.artist || s.user.name}</p>
          <p className="mt-2 flex gap-4 text-sm text-muted">
            <span className="flex items-center gap-1"><Heart size={14} /> {s.saves}</span>
            <span className="flex items-center gap-1"><Headphones size={14} /> {fmt(t.songs.plays, { n: s.plays })}</span>
          </p>
        </div>
      </div>
      <div className="mt-6">
        <SongList songs={[{ id: s.id, title: s.title, artist: s.artist, cover, userName: s.user.name, aiTool: s.aiTool, saves: s.saves, airedTrackId: s.airedTrackId, durationSec: s.durationSec }]} />
      </div>
      {s.lyrics.trim() && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg font-semibold">{t.songs.lyrics}</h2>
          <pre className="whitespace-pre-wrap rounded-3xl bg-surface p-5 font-sans text-[15px] leading-relaxed text-white/85 ring-1 ring-line">{s.lyrics}</pre>
        </section>
      )}
    </div>
  );
}
