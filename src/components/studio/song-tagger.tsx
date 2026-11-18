"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Loader2, Music2, Plus, Search, X } from "lucide-react";
import { btn, inputCls, labelCls } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { findSongsAction, tagSongAction, untagSongAction } from "@/app/actions/song-links";

type Found = { id: string; title: string; artist: string; durationSec: number };
export type TaggedSong = { id: string; episodeNumber: number; atSec: number; lenSec: number; title: string; artist: string; songId: string; hidden: boolean };

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
/** "1:23", "83" or "1:23.5" → seconds; NaN when unreadable. */
function parseTime(v: string) {
  const m = /^\s*(?:(\d+):)?(\d+(?:\.\d+)?)\s*$/.exec(v);
  if (!m) return NaN;
  return (Number(m[1] ?? 0) * 60) + Number(m[2]);
}

/**
 * Studio: tag songs from the songs section in episodes ("plays at 12:30 for ~40 s"). Viewers then get a
 * "♪ Add to My music" chip while it plays, and the song links back to the episode.
 */
export function SongTagger({ episodes, tagged }: { episodes: { id: string; number: number; durationSec: number }[]; tagged: TaggedSong[] }) {
  const { t } = useI18n();
  const l = t.songs.link.studio;
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [episodeId, setEpisodeId] = useState(episodes[0]?.id ?? "");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [searching, setSearching] = useState(false);
  const [song, setSong] = useState<Found | null>(null);
  const [at, setAt] = useState("0:00");
  const [len, setLen] = useState(30);

  useEffect(() => {
    if (song) return;
    let alive = true;
    const id = window.setTimeout(async () => {
      setSearching(true);
      const rows = await findSongsAction(q).catch(() => []);
      if (!alive) return;
      setFound(rows);
      setSearching(false);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [q, song]);

  const err = (code: string) => (l.errors as Record<string, string>)[code] ?? t.common.error;
  const atSec = parseTime(at);
  const ep = episodes.find((e) => e.id === episodeId);
  const badTime = !isFinite(atSec) || (!!ep && ep.durationSec > 0 && atSec > ep.durationSec);

  const add = () => {
    if (!song || badTime) return;
    start(async () => {
      const r = await tagSongAction({ episodeId, songId: song.id, atSec, lenSec: len });
      if (!r.ok) return toast(err(r.error), "error");
      toast(l.added);
      setSong(null);
      setQ("");
      router.refresh();
    });
  };
  const remove = (id: string) =>
    start(async () => {
      const r = await untagSongAction(id);
      if (!r.ok) return toast(err(r.error), "error");
      router.refresh();
    });

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-muted">{l.sub}</p>
      {episodes.length > 0 && (
        <div className="space-y-4 rounded-2xl bg-surface-2/50 p-4 ring-1 ring-line">
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <div>
              <label htmlFor="st-ep" className={labelCls}>{l.episode}</label>
              <select id="st-ep" value={episodeId} onChange={(e) => setEpisodeId(e.target.value)} className={inputCls}>
                {episodes.map((e) => (
                  <option key={e.id} value={e.id}>
                    {t.common.episode} {e.number}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="st-q" className={labelCls}>{l.song}</label>
              {song ? (
                <div className="flex h-12 items-center gap-2 rounded-2xl bg-surface-2 px-3 ring-1 ring-accent/50">
                  <Music2 size={16} className="shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {song.title} <span className="font-normal text-muted">— {song.artist}</span>
                  </span>
                  <button type="button" onClick={() => setSong(null)} aria-label={l.remove} className="rounded-full p-1 text-muted hover:text-text">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input id="st-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={l.search} className={clsx(inputCls, "pl-10")} autoComplete="off" />
                  {searching && <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-muted" />}
                </div>
              )}
            </div>
          </div>

          {!song && (
            <div className="space-y-1">
              {found.map((f) => (
                <button key={f.id} type="button" onClick={() => setSong(f)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-white/[.06]">
                  <Music2 size={14} className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate">
                    <b className="font-semibold">{f.title}</b> <span className="text-muted">— {f.artist}</span>
                  </span>
                  <span className="text-xs tabular-nums text-muted">{mmss(f.durationSec)}</span>
                </button>
              ))}
              {!searching && found.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted">
                  {l.noSongs}{" "}
                  <Link href="/songs/new" className="font-semibold text-accent hover:underline">{l.upload}</Link>
                </p>
              )}
            </div>
          )}

          {song && (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="st-at" className={labelCls}>{l.at}</label>
                <input id="st-at" value={at} onChange={(e) => setAt(e.target.value)} inputMode="decimal" className={clsx(inputCls, "w-28 tabular-nums", badTime && "border-red-400/60")} />
              </div>
              <div>
                <label htmlFor="st-len" className={labelCls}>{l.len}</label>
                <input id="st-len" type="number" min={5} max={600} value={len} onChange={(e) => setLen(Math.max(5, Math.min(600, Number(e.target.value) || 30)))} className={clsx(inputCls, "w-24 tabular-nums")} />
              </div>
              <button type="button" onClick={add} disabled={pending || badTime} className={btn("primary", "md")}>
                {pending ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} {l.add}
              </button>
            </div>
          )}
        </div>
      )}

      {tagged.length === 0 ? (
        <p className="text-sm text-muted">{l.empty}</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
          {tagged.map((x) => (
            <li key={x.id} className={clsx("flex items-center gap-3 px-4 py-3 text-sm", x.hidden && "opacity-50")}>
              <span className="w-16 shrink-0 text-muted">
                {t.common.episode} {x.episodeNumber}
              </span>
              <span className="w-24 shrink-0 tabular-nums text-muted">
                {mmss(x.atSec)}–{mmss(x.atSec + x.lenSec)}
              </span>
              <Link href={`/songs/${x.songId}`} className="min-w-0 flex-1 truncate hover:underline">
                <b className="font-semibold">{x.title}</b> <span className="text-muted">— {x.artist}</span>
              </Link>
              <Check size={16} className="shrink-0 text-ok" aria-hidden />
              <button type="button" onClick={() => remove(x.id)} disabled={pending} aria-label={l.remove} title={l.remove} className="rounded-full p-1.5 text-muted hover:bg-white/[.06] hover:text-text">
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
