"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Heart, Music2, Pause, Play, Radio, Sparkles } from "lucide-react";
import { btn } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { isAiMusic } from "@/lib/song-rules";
import { hideSongAction, sendSongToAirAction, toggleSaveAction } from "@/app/actions/songs";
import { useMusicPlayer, type PlayerSong } from "./player";

export type ListSong = PlayerSong & { aiTool: string; saves: number; airedTrackId: string | null; userName: string; durationSec: number; week?: number; hidden?: boolean };

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** A list of songs that plays through the site-wide player (library, uploads, chart). */
export function SongList({ songs, numbered = false, admin }: { songs: ListSong[]; numbered?: boolean; admin?: { channels: { id: string; name: string }[] } }) {
  const { t } = useI18n();
  const s = t.songs;
  const player = useMusicPlayer();
  const queue = songs.filter((x) => !x.hidden);
  return (
    <div>
      {queue.length > 1 && (
        <button type="button" onClick={() => player.play(queue[0], queue)} className={btn("primary", "md", "mb-4")}>
          <Play size={17} /> {s.playAll}
        </button>
      )}
      <ol className="divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">
        {songs.map((x, i) => {
          const on = player.current?.id === x.id;
          return (
            <li key={x.id} className={clsx("flex flex-wrap items-center gap-3 px-3 py-2.5", x.hidden && "opacity-50")}>
              {numbered && <span className="w-6 text-right font-display text-lg font-bold text-muted">{i + 1}</span>}
              <button
                type="button"
                disabled={x.hidden}
                onClick={() => (on ? player.toggle() : player.play(x, queue))}
                aria-label={on && player.playing ? t.party.pause : t.party.play}
                className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-surface-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {x.cover ? <img src={x.cover} alt="" className="h-full w-full object-cover" /> : <Music2 size={20} className="m-auto text-muted" />}
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition hover:opacity-100">
                  {on && player.playing ? <Pause size={18} /> : <Play size={18} />}
                </span>
              </button>
              <Link href={`/songs/${x.id}`} className="min-w-0 flex-1">
                <span className={clsx("block truncate font-semibold", on && "text-accent")}>{x.title}</span>
                <span className="flex items-center gap-1.5 truncate text-sm text-muted">
                  {x.artist || x.userName}
                  {isAiMusic(x.aiTool) && <Sparkles size={12} aria-label={s.ai} />}
                  {x.airedTrackId && <Radio size={12} className="text-[#ff3b3b]" aria-label={s.aired} />}
                  {x.hidden && <span className="text-xs">· {s.hidden}</span>}
                </span>
              </Link>
              <span className="text-xs tabular-nums text-muted">{x.week !== undefined ? fmt(s.week, { n: x.week }) : mmss(x.durationSec)}</span>
              <SaveHeart id={x.id} />
              {admin && <AdminSongTools song={x} channels={admin.channels} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SaveHeart({ id }: { id: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={t.songs.save}
      onClick={() =>
        start(async () => {
          const r = await toggleSaveAction(id);
          if (r.ok) toast(r.saved ? t.songs.saved : t.adm.done);
        })
      }
      className="rounded-full p-2 text-muted hover:text-accent"
    >
      <Heart size={17} />
    </button>
  );
}

function AdminSongTools({ song, channels }: { song: ListSong; channels: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const s = t.songs;
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ch, setCh] = useState(channels[0]?.id ?? "");
  return (
    <span className="flex w-full items-center justify-end gap-2 sm:w-auto">
      {song.airedTrackId ? (
        <span className="text-xs font-semibold text-[#ff3b3b]">● {s.aired2}</span>
      ) : (
        <>
          <select value={ch} onChange={(e) => setCh(e.target.value)} aria-label={t.music.channel} className="h-8 max-w-36 rounded-lg bg-surface-2 px-2 text-xs ring-1 ring-line">
            {channels.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !ch}
            onClick={() =>
              start(async () => {
                const r = await sendSongToAirAction(song.id, ch, "KARAOKE");
                toast(r.ok ? s.aired2 : t.common.error, r.ok ? "ok" : "error");
                router.refresh();
              })
            }
            className={btn("primary", "sm")}
          >
            <Radio size={14} /> {s.toAir}
          </button>
        </>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => void (await hideSongAction(song.id, !song.hidden), router.refresh()))}
        className={btn("ghost", "sm", "text-xs")}
      >
        {song.hidden ? s.show : s.hide}
      </button>
    </span>
  );
}
