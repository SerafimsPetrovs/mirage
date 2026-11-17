"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { songPlayedAction } from "@/app/actions/songs";

export type PlayerSong = { id: string; title: string; artist: string; cover: string | null; userName?: string };

type Ctx = {
  current: PlayerSong | null;
  playing: boolean;
  /** Play `song`; `queue` = what plays next (e.g. the whole library). */
  play: (song: PlayerSong, queue?: PlayerSong[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
  /** The feed pauses the player while it plays hooks. */
  pause: () => void;
};

const PlayerCtx = createContext<Ctx | null>(null);
export const useMusicPlayer = () => {
  const c = useContext(PlayerCtx);
  if (!c) throw new Error("MusicPlayerProvider missing");
  return c;
};

/**
 * One audio element for the whole site: songs keep playing while you browse, and the phone's lock screen /
 * headphones control it through the Media Session API (the installed PWA keeps playing in the background).
 */
export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<PlayerSong[]>([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const current = index >= 0 ? queue[index] ?? null : null;

  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    audio.current = a;
    const on = () => setPlaying(true);
    const off = () => setPlaying(false);
    a.addEventListener("play", on);
    a.addEventListener("pause", off);
    return () => {
      a.pause();
      a.removeEventListener("play", on);
      a.removeEventListener("pause", off);
    };
  }, []);

  // load + play when the current song changes
  useEffect(() => {
    const a = audio.current;
    if (!a || !current) return;
    a.src = `/api/songs/${current.id}/audio`;
    a.currentTime = 0;
    a.play().catch(() => setPlaying(false));
    void songPlayedAction(current.id);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title,
        artist: current.artist || current.userName || "MIRAGE",
        album: "MIRAGE",
        artwork: current.cover ? [{ src: current.cover, sizes: "512x512" }] : [{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }],
      });
    }
  }, [current]);

  const next = useCallback(() => setIndex((i) => (i + 1 < queue.length ? i + 1 : i)), [queue.length]);
  const prev = useCallback(() => {
    const a = audio.current;
    if (a && a.currentTime > 3) a.currentTime = 0;
    else setIndex((i) => Math.max(0, i - 1));
  }, []);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const ended = () => (index + 1 < queue.length ? setIndex(index + 1) : setPlaying(false));
    a.addEventListener("ended", ended);
    return () => a.removeEventListener("ended", ended);
  }, [index, queue.length]);

  const play = useCallback((song: PlayerSong, q?: PlayerSong[]) => {
    const list = q && q.some((s) => s.id === song.id) ? q : [song];
    setQueue(list);
    setIndex(list.findIndex((s) => s.id === song.id));
  }, []);
  const toggle = useCallback(() => {
    const a = audio.current;
    if (!a || !a.src) return;
    if (a.paused) void a.play().catch(() => {});
    else a.pause();
  }, []);
  const pause = useCallback(() => audio.current?.pause(), []);
  const stop = useCallback(() => {
    audio.current?.pause();
    setIndex(-1);
    setQueue([]);
  }, []);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    ms.setActionHandler("play", toggle);
    ms.setActionHandler("pause", toggle);
    ms.setActionHandler("nexttrack", next);
    ms.setActionHandler("previoustrack", prev);
    return () => {
      for (const k of ["play", "pause", "nexttrack", "previoustrack"] as const) ms.setActionHandler(k, null);
    };
  }, [toggle, next, prev]);

  const value = useMemo(() => ({ current, playing, play, toggle, next, prev, stop, pause }), [current, playing, play, toggle, next, prev, stop, pause]);
  return (
    <PlayerCtx.Provider value={value}>
      {children}
      {current && <MiniPlayer />}
    </PlayerCtx.Provider>
  );
}

function MiniPlayer() {
  const { t } = useI18n();
  const { current, playing, toggle, next, prev, stop } = useMusicPlayer();
  if (!current) return null;
  return (
    <div className="fixed inset-x-2 bottom-[calc(var(--tabbar-h,0px)+8px)] z-[55] mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-line bg-surface/95 p-2 pr-3 shadow-2xl backdrop-blur-xl md:bottom-4" role="region" aria-label={t.songs.nowPlaying}>
      <Link href={`/songs/${current.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {current.cover && <img src={current.cover} alt="" className="h-full w-full object-cover" />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{current.title}</span>
          <span className="block truncate text-xs text-muted">{current.artist || current.userName}</span>
        </span>
      </Link>
      <button type="button" onClick={prev} aria-label="Previous" className="rounded-full p-2 text-muted hover:text-text">
        <SkipBack size={18} />
      </button>
      <button type="button" onClick={toggle} aria-label={playing ? t.party.pause : t.party.play} className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black">
        {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
      </button>
      <button type="button" onClick={next} aria-label={t.songs.next} className="rounded-full p-2 text-muted hover:text-text">
        <SkipForward size={18} />
      </button>
      <button type="button" onClick={stop} aria-label={t.common.close} className="rounded-full p-1.5 text-muted hover:text-text">
        <X size={16} />
      </button>
    </div>
  );
}
