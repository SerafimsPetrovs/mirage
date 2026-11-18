"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Clapperboard, Heart, Music2 } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { useToast } from "@/components/ui/toast";
import { toggleSaveAction } from "@/app/actions/songs";

export type ChipSong = { id: string; title: string; artist: string; cover?: string | null };
export type ChipUse = { episodeId: string; number: number; seriesSlug: string; seriesTitle: string; atSec: number };

/**
 * "♪ This song is playing": shown over a series episode (or a TV episode) while a tagged song plays.
 * ♥ puts it in "My music" right away; the title opens the song in the music section.
 */
export function SongChip({ song, loggedIn, className }: { song: ChipSong; loggedIn: boolean; className?: string }) {
  const { t } = useI18n();
  const l = t.songs.link;
  const toast = useToast();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!loggedIn) return router.push(`/register?next=/songs/${song.id}`);
    setBusy(true);
    const r = await toggleSaveAction(song.id);
    setBusy(false);
    if (!r.ok) return toast(t.common.error, "error");
    setSaved(r.saved);
    if (r.saved) toast(t.songs.saved);
  };
  return (
    <div className={clsx("animate-pop flex max-w-[min(340px,calc(100vw-32px))] items-center gap-2.5 rounded-2xl bg-black/65 p-1.5 pr-2 text-white ring-1 ring-white/15 backdrop-blur-md", className)}>
      <Link href={`/songs/${song.id}`} className="flex min-w-0 flex-1 items-center gap-2.5" title={l.open}>
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#7c5cff] to-[#ff2e63]">
          {song.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={song.cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <Music2 size={18} />
          )}
          <span aria-hidden className="song-eq absolute inset-x-1 bottom-1 flex h-2.5 items-end gap-[2px]">
            <i /><i /><i />
          </span>
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/60">{l.nowPlaying}</span>
          <span className="block truncate text-sm font-semibold leading-tight">{song.title}</span>
          <span className="block truncate text-xs text-white/70">{song.artist}</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={save}
        disabled={busy}
        aria-pressed={saved}
        aria-label={saved ? t.songs.saved : l.toMusic}
        title={saved ? t.songs.saved : l.toMusic}
        className={clsx("flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition active:scale-95", saved ? "bg-accent text-white" : "bg-white text-black hover:bg-white/90")}
      >
        <Heart size={14} className={saved ? "fill-white" : ""} />
        <span className="max-sm:hidden">{saved ? t.songs.saved : l.toMusic}</span>
      </button>
    </div>
  );
}

/** "Plays in <series> · ep. N" → that moment of the episode. */
export function SeriesChip({ use, className, compact = false }: { use: ChipUse; className?: string; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <Link
      href={`/watch/${use.episodeId}${use.atSec > 1 ? `?t=${Math.floor(use.atSec)}` : ""}`}
      className={clsx("inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/15 backdrop-blur hover:bg-white/20", className)}
    >
      <Clapperboard size={14} className="shrink-0 text-accent" />
      <span className="truncate">{fmt(compact ? t.songs.link.playsInShort : t.songs.link.playsIn, { s: use.seriesTitle, n: use.number })}</span>
    </Link>
  );
}
