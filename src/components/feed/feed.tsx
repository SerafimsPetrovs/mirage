"use client";
import { useHls } from "@/components/player/use-hls";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ChevronUp, Info, Play, Volume2, VolumeX } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { fmt, plural } from "@/i18n/shared";
import { btn } from "@/components/ui/button";
import { AiChip } from "@/components/ui/misc";
import { ListButton } from "@/components/series/series-actions";

export type FeedItem = {
  seriesId: string;
  slug: string;
  title: string;
  tagline: string;
  poster: string;
  genres: string[];
  aiModels: string[];
  episodes: number;
  episodeId: string;
  episodeNumber: number;
  /** First episode is protected → play the personal watermarked HLS stream. */
  hls: boolean;
  inList: boolean;
};

export function Feed({ items }: { items: FeedItem[] }) {
  const { t, locale } = useI18n();
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [hint, setHint] = useState(true);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            const idx = Number((e.target as HTMLElement).dataset.idx);
            setActive(idx);
            if (idx > 0) setHint(false);
          }
        }
      },
      { threshold: [0.6] },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [items.length]);

  if (!items.length) return <div className="flex h-dvh items-center justify-center text-muted">{t.feed.empty}</div>;

  return (
    <div className="no-scrollbar h-dvh snap-y snap-mandatory overflow-y-scroll bg-black">
      {items.map((it, idx) => (
        <section
          key={it.seriesId}
          data-idx={idx}
          ref={(el) => {
            refs.current[idx] = el;
          }}
          className="relative flex h-dvh snap-start snap-always items-center justify-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={it.poster} alt="" className="absolute inset-0 hidden h-full w-full scale-125 object-cover opacity-35 blur-3xl md:block" />
          <div className="relative h-full w-full overflow-hidden md:h-[calc(100%-32px)] md:w-auto md:aspect-[9/16] md:rounded-3xl md:ring-1 md:ring-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
            {Math.abs(idx - active) <= 1 && <FeedVideo src={`/api/stream/${it.episodeId}`} hlsUrl={it.hls ? `/api/hls/${it.episodeId}` : null} active={idx === active} muted={muted} />}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/40" />

            <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(14px,env(safe-area-inset-top))]">
              <Link href="/" className="font-display text-lg font-bold tracking-wider text-mirage">MIRAGE</Link>
              <button
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? t.player.unmute : t.player.mute}
                className={clsx("flex h-10 items-center gap-1.5 rounded-full bg-black/35 px-3 backdrop-blur-md", muted && "ring-1 ring-white/40")}
              >
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                {muted && <span className="text-xs font-semibold">{t.player.unmute}</span>}
              </button>
            </div>

            <div className="absolute inset-x-0 bottom-0 px-4 pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+16px)] md:pb-6">
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {it.aiModels.slice(0, 2).map((m) => (
                  <AiChip key={m} label={m} />
                ))}
              </div>
              <h2 className="font-display text-2xl font-bold leading-tight">{it.title}</h2>
              <p className="mt-1.5 line-clamp-2 max-w-md text-sm text-white/80">{it.tagline}</p>
              <p className="mt-2 text-xs text-white/55">
                {it.genres.slice(0, 2).map((g) => t.genres[g as keyof typeof t.genres] ?? g).join(" · ")} · {it.episodes} {plural(it.episodes, t.common.episodes, locale)}
              </p>
              <div className="mt-4 flex items-center gap-2.5">
                <Link href={`/watch/${it.episodeId}`} className={btn("primary", "md", "flex-1 md:flex-none")}>
                  <Play size={18} fill="currentColor" /> {fmt(t.feed.episodeOf, { n: it.episodeNumber, total: it.episodes })}
                </Link>
                <Link href={`/series/${it.slug}`} aria-label={t.home.moreInfo} className={btn("glass", "icon", "h-11 w-11")}>
                  <Info size={20} />
                </Link>
                <ListButton seriesId={it.seriesId} initial={it.inList} compact />
              </div>
            </div>

            {idx === 0 && hint && (
              <div className="pointer-events-none absolute inset-x-0 bottom-[38%] flex flex-col items-center text-sm font-medium text-white/80 motion-safe:animate-bounce">
                <ChevronUp size={26} />
                {t.feed.hint}
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function FeedVideo({ src, hlsUrl, active, muted }: { src: string; hlsUrl: string | null; active: boolean; muted: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useHls(ref, hlsUrl);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) v.play().catch(() => {});
    else {
      v.pause();
      v.currentTime = 0;
    }
  }, [active]);
  return (
    <video
      ref={ref}
      src={hlsUrl ? undefined : src}
      muted={muted}
      loop
      playsInline
      preload={active ? "auto" : "metadata"}
      className="absolute inset-0 h-full w-full object-cover"
      onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())}
    />
  );
}
