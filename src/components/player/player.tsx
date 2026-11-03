"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  ChevronDown, ChevronLeft, ChevronUp, Heart, LayoutGrid, Maximize, MessageCircle, Pause, Play, Share2, SkipForward, Volume2, VolumeX,
} from "lucide-react";
import type { EpisodeItem } from "@/lib/series";
import { useI18n } from "@/i18n/client";
import { fmt, formatNumber } from "@/i18n/shared";
import { useToast } from "@/components/ui/toast";
import { btn } from "@/components/ui/button";
import { EpisodeNumberGrid, EpisodeList } from "@/components/series/episode-grid";
import { saveProgressAction, toggleLikeAction } from "@/app/actions/library";
import { Sheet } from "./sheet";
import { Comments } from "./comments";
import { LockOverlay } from "./lock-overlay";

export type PlayerProps = {
  episode: { id: string; number: number; title: string; locked: boolean; reason: "login" | "locked" | null; price: number; startAt: number };
  series: { slug: string; title: string; orientation: "VERTICAL" | "HORIZONTAL"; poster: string; backdrop: string; episodes: EpisodeItem[] };
  prevId: string | null;
  nextId: string | null;
  liked: boolean;
  likeCount: number;
  commentCount: number;
  user: { coins: number; name: string; hue: number } | null;
};

function clock(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export function Player(props: PlayerProps) {
  const { episode, series, prevId, nextId, user } = props;
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const vertical = series.orientation === "VERTICAL";
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sheet, setSheet] = useState<"episodes" | "comments" | null>(null);
  const [liked, setLiked] = useState(props.liked);
  const [likes, setLikes] = useState(props.likeCount);
  const [chrome, setChrome] = useState(true);
  const [, start] = useTransition();
  const lastSaved = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const save = useCallback(
    (completed = false) => {
      const v = videoRef.current;
      if (!v || episode.locked) return;
      lastSaved.current = Date.now();
      saveProgressAction(episode.id, v.currentTime, completed).catch(() => {});
    },
    [episode.id, episode.locked],
  );

  // Autoplay (with muted fallback when the browser blocks sound)
  useEffect(() => {
    const v = videoRef.current;
    if (!v || episode.locked) return;
    if (episode.startAt > 0) v.currentTime = episode.startAt;
    v.play().catch(() => {
      v.muted = true;
      setMuted(true);
      v.play().catch(() => {});
    });
    return () => save();
  }, [episode.id, episode.locked, episode.startAt, save]);

  // Autoplay next countdown
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      if (nextId) router.push(`/watch/${nextId}`);
      return;
    }
    const id = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(id);
  }, [countdown, nextId, router]);

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const go = useCallback((id: string | null) => id && router.push(`/watch/${id}`), [router]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea")) return;
      const v = videoRef.current;
      if (e.key === " " || e.key === "k") { e.preventDefault(); toggle(); }
      else if (e.key === "ArrowRight" && v) v.currentTime = Math.min(v.duration, v.currentTime + 5);
      else if (e.key === "ArrowLeft" && v) v.currentTime = Math.max(0, v.currentTime - 5);
      else if (e.key === "ArrowDown" && vertical) { e.preventDefault(); go(nextId); }
      else if (e.key === "ArrowUp" && vertical) { e.preventDefault(); go(prevId); }
      else if (e.key === "m" && v) { v.muted = !v.muted; setMuted(v.muted); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, go, nextId, prevId, vertical]);

  // Swipe up/down between episodes (vertical only)
  const touch = useRef<{ y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => (touch.current = { y: e.touches[0].clientY, t: Date.now() });
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!vertical || !touch.current) return;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    if (Date.now() - touch.current.t < 600 && Math.abs(dy) > 80) go(dy < 0 ? nextId : prevId);
    touch.current = null;
  };

  const poke = () => {
    setChrome(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setChrome(false), 3000);
  };

  const like = () => {
    if (!user) return router.push(`/login?next=/watch/${episode.id}`);
    setLiked((l) => !l);
    setLikes((n) => n + (liked ? -1 : 1));
    start(async () => {
      const r = await toggleLikeAction(episode.id);
      if (r.ok && r.data) {
        setLiked(r.data.liked);
        setLikes(r.data.count);
      }
    });
  };

  const share = async () => {
    const url = `${location.origin}/series/${series.slug}`;
    if (navigator.share) {
      try { await navigator.share({ title: series.title, url }); return; } catch { /* cancelled */ }
    }
    await navigator.clipboard?.writeText(url);
    toast(t.series.copied);
  };

  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    v.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
  };

  const fullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.().catch(() => {});
  };

  const progressBar = (
    <div
      className="group/seek relative h-5 cursor-pointer touch-none"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); seek(e); }}
      onPointerMove={(e) => e.buttons === 1 && seek(e)}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(time)}
    >
      <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/25 transition-all group-hover/seek:h-[5px]">
        <div className="h-full rounded-full bg-accent" style={{ width: `${duration ? (time / duration) * 100 : 0}%` }} />
      </div>
      <div
        className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition group-hover/seek:opacity-100"
        style={{ left: `${duration ? (time / duration) * 100 : 0}%` }}
      />
    </div>
  );

  const video = !episode.locked && (
    <video
      ref={videoRef}
      key={episode.id}
      src={`/api/stream/${episode.id}`}
      className={clsx("absolute inset-0 h-full w-full", vertical ? "object-cover" : "object-contain")}
      playsInline
      preload="auto"
      poster={vertical ? series.poster : series.backdrop}
      onPlay={() => { setPlaying(true); poke(); }}
      onPause={() => { setPlaying(false); setChrome(true); save(); }}
      onWaiting={() => setBuffering(true)}
      onPlaying={() => setBuffering(false)}
      onCanPlay={() => setBuffering(false)}
      onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      onTimeUpdate={(e) => {
        setTime(e.currentTarget.currentTime);
        if (Date.now() - lastSaved.current > 10_000) save();
      }}
      onEnded={() => {
        save(true);
        setPlaying(false);
        if (nextId) setCountdown(5);
      }}
      onClick={toggle}
    />
  );

  const nextOverlay = countdown !== null && nextId && (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="animate-pop text-center">
        <p className="text-sm text-white/70">{t.player.next}</p>
        <p className="mt-1 font-display text-5xl font-bold tabular-nums">{countdown}</p>
        <div className="mt-5 flex gap-2">
          <button onClick={() => setCountdown(null)} className={btn("glass", "md")}>{t.player.cancel}</button>
          <button onClick={() => go(nextId)} className={btn("primary", "md")}><SkipForward size={18} /> {t.player.next}</button>
        </div>
      </div>
    </div>
  );

  const centerPlay = !episode.locked && !playing && countdown === null && !buffering && (
    <button onClick={toggle} aria-label={t.player.playPause} className="glass animate-pop absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full">
      <Play size={28} fill="currentColor" className="ml-1" />
    </button>
  );

  const spinner = !episode.locked && buffering && (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-10 w-10 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full border-2 border-white/20 border-t-white" />
  );

  const lock = episode.locked && episode.reason && (
    <LockOverlay episodeId={episode.id} number={episode.number} reason={episode.reason} price={episode.price} balance={user?.coins ?? 0} />
  );

  const sheets = (
    <>
      <Sheet open={sheet === "episodes"} onClose={() => setSheet(null)} title={`${t.player.episodesList} · ${series.episodes.length}`}>
        {vertical ? <EpisodeNumberGrid episodes={series.episodes} currentId={episode.id} t={t} /> : <EpisodeList episodes={series.episodes} backdrop={series.backdrop} t={t} />}
      </Sheet>
      <Sheet open={sheet === "comments"} onClose={() => setSheet(null)} title={`${t.player.comments} · ${props.commentCount}`}>
        <Comments episodeId={episode.id} loggedIn={!!user} me={user ? { name: user.name, hue: user.hue } : null} active={sheet === "comments"} />
      </Sheet>
    </>
  );

  const railBtn = "flex flex-col items-center gap-1 text-[11px] font-semibold text-white drop-shadow";
  const railIcon = "flex h-12 w-12 items-center justify-center rounded-full bg-black/35 backdrop-blur-md transition active:scale-90 md:bg-white/10 md:hover:bg-white/20";

  if (vertical) {
    return (
      <div className="fixed inset-0 bg-black" onMouseMove={poke}>
        {/* Ambient blurred backdrop on wide screens */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={series.poster} alt="" className="absolute inset-0 hidden h-full w-full scale-125 object-cover opacity-40 blur-3xl md:block" />
        <div className="relative mx-auto flex h-full items-center justify-center gap-6">
          <div
            ref={wrapRef}
            className="relative h-full w-full overflow-hidden bg-black md:my-4 md:h-[calc(100%-32px)] md:w-auto md:aspect-[9/16] md:rounded-3xl md:shadow-2xl md:ring-1 md:ring-white/10"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {episode.locked && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={series.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
            )}
            {video}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/85 to-transparent" />

            {/* Top bar */}
            <div className="absolute inset-x-0 top-0 z-30 flex items-center gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))]">
              <Link href={`/series/${series.slug}`} aria-label={t.common.back} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 backdrop-blur-md">
                <ChevronLeft size={22} />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{series.title}</p>
                <p className="text-xs text-white/70">{fmt(t.feed.episodeOf, { n: episode.number, total: series.episodes.length })}</p>
              </div>
              {!episode.locked && (
                <button
                  onClick={() => { const v = videoRef.current; if (v) { v.muted = !v.muted; setMuted(v.muted); } }}
                  aria-label={muted ? t.player.unmute : t.player.mute}
                  className={clsx("flex h-10 items-center gap-1.5 rounded-full bg-black/30 px-3 backdrop-blur-md", muted && "ring-1 ring-white/40")}
                >
                  {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  {muted && <span className="text-xs font-semibold">{t.player.unmute}</span>}
                </button>
              )}
            </div>

            {centerPlay}
            {spinner}

            {/* Right rail (mobile overlays the video) */}
            <div className="absolute bottom-28 right-3 z-10 flex flex-col items-center gap-4 md:hidden">
              <button onClick={like} className={railBtn} aria-pressed={liked} aria-label={t.player.like}>
                <span className={railIcon}><Heart size={24} className={liked ? "fill-accent text-accent" : ""} /></span>
                {formatNumber(likes, locale)}
              </button>
              <button onClick={() => setSheet("comments")} className={railBtn} aria-label={t.player.comments}>
                <span className={railIcon}><MessageCircle size={24} /></span>
                {formatNumber(props.commentCount, locale)}
              </button>
              <button onClick={() => setSheet("episodes")} className={railBtn} aria-label={t.player.episodesList}>
                <span className={railIcon}><LayoutGrid size={22} /></span>
                {series.episodes.length}
              </button>
              <button onClick={share} className={railBtn} aria-label={t.series.share}>
                <span className={railIcon}><Share2 size={22} /></span>
              </button>
            </div>

            {/* Bottom info + seek */}
            <div className={clsx("absolute inset-x-0 bottom-0 z-10 px-4 pb-[max(16px,env(safe-area-inset-bottom))] transition-opacity", !chrome && playing && "md:opacity-0")}>
              <p className="pr-16 font-display text-[15px] font-semibold md:pr-0">
                {t.common.episode} {episode.number}
                {episode.title && <span className="font-sans font-normal text-white/75"> · {episode.title}</span>}
              </p>
              {!episode.locked && (
                <>
                  {progressBar}
                  <div className="flex justify-between text-[11px] tabular-nums text-white/60">
                    <span>{clock(time)}</span>
                    <span>{clock(duration)}</span>
                  </div>
                </>
              )}
            </div>

            {nextOverlay}
            {lock}
          </div>

          {/* Desktop side rail */}
          <div className="hidden flex-col items-center gap-5 md:flex">
            <button onClick={() => go(prevId)} disabled={!prevId} aria-label={t.player.prev} className={clsx(railIcon, "disabled:opacity-30")}><ChevronUp size={24} /></button>
            <button onClick={() => go(nextId)} disabled={!nextId} aria-label={t.player.next} className={clsx(railIcon, "disabled:opacity-30")}><ChevronDown size={24} /></button>
            <div className="h-4" />
            <button onClick={like} className={railBtn} aria-pressed={liked} aria-label={t.player.like}>
              <span className={railIcon}><Heart size={24} className={liked ? "fill-accent text-accent" : ""} /></span>
              {formatNumber(likes, locale)}
            </button>
            <button onClick={() => setSheet("comments")} className={railBtn} aria-label={t.player.comments}>
              <span className={railIcon}><MessageCircle size={24} /></span>
              {formatNumber(props.commentCount, locale)}
            </button>
            <button onClick={() => setSheet("episodes")} className={railBtn} aria-label={t.player.episodesList}>
              <span className={railIcon}><LayoutGrid size={22} /></span>
              {series.episodes.length}
            </button>
            <button onClick={share} className={railBtn} aria-label={t.series.share}>
              <span className={railIcon}><Share2 size={22} /></span>
            </button>
          </div>
        </div>
        {sheets}
      </div>
    );
  }

  // Horizontal / widescreen layout
  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto max-w-[1400px] md:px-6 md:pt-6">
        <div className="flex items-center gap-3 px-4 py-3 md:px-0">
          <Link href={`/series/${series.slug}`} aria-label={t.common.back} className={btn("ghost", "icon")}>
            <ChevronLeft size={22} />
          </Link>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold md:text-base">{series.title}</p>
            <p className="text-xs text-muted">
              {t.common.episode} {episode.number} · {episode.title}
            </p>
          </div>
        </div>
        <div ref={wrapRef} className="group/player relative aspect-video max-h-[78vh] w-full overflow-hidden bg-black md:rounded-3xl" onMouseMove={poke}>
          {episode.locked && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={series.backdrop} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          {video}
          {centerPlay}
          {spinner}
          {!episode.locked && (
            <div className={clsx("absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 to-transparent px-4 pb-3 pt-10 transition-opacity", !chrome && playing && "opacity-0")}>
              {progressBar}
              <div className="mt-1 flex items-center gap-2">
                <button onClick={toggle} aria-label={t.player.playPause} className={btn("ghost", "icon")}>
                  {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
                </button>
                {nextId && (
                  <button onClick={() => go(nextId)} aria-label={t.player.next} className={btn("ghost", "icon")}>
                    <SkipForward size={20} />
                  </button>
                )}
                <button
                  onClick={() => { const v = videoRef.current; if (v) { v.muted = !v.muted; setMuted(v.muted); } }}
                  aria-label={muted ? t.player.unmute : t.player.mute}
                  className={btn("ghost", "icon")}
                >
                  {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <span className="text-xs tabular-nums text-white/70">{clock(time)} / {clock(duration)}</span>
                <button onClick={fullscreen} aria-label={t.player.fullscreen} className={btn("ghost", "icon", "ml-auto")}>
                  <Maximize size={20} />
                </button>
              </div>
            </div>
          )}
          {nextOverlay}
          {lock}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 py-5 md:px-0">
          <button onClick={like} aria-pressed={liked} className={btn("glass", "md")}>
            <Heart size={18} className={liked ? "fill-accent text-accent" : ""} /> {formatNumber(likes, locale)}
          </button>
          <button onClick={() => setSheet("comments")} className={btn("glass", "md")}>
            <MessageCircle size={18} /> {formatNumber(props.commentCount, locale)}
          </button>
          <button onClick={share} className={btn("glass", "md")} aria-label={t.series.share}>
            <Share2 size={18} />
          </button>
          {nextId && (
            <button onClick={() => go(nextId)} className={btn("primary", "md", "ml-auto")}>
              {t.player.next} <SkipForward size={18} />
            </button>
          )}
        </div>
        <div className="px-4 pb-16 md:px-0">
          <h2 className="mb-3 font-display text-lg font-semibold">{t.series.episodes}</h2>
          <EpisodeList episodes={series.episodes} backdrop={series.backdrop} t={t} />
        </div>
      </div>
      {sheets}
    </div>
  );
}
