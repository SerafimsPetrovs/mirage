"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, Gamepad2, Heart, Megaphone, Sparkles } from "lucide-react";
import { QuizCard } from "./tv-interactive";
import clsx from "clsx";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { useHls } from "@/components/player/use-hls";
import { loopedPosition, slotOffset, TV_ORDER_PRICE } from "@/lib/tv-rules";
import { prefersLite } from "@/lib/video-lite-rules";
import type { TvChannelDTO, TvSlotDTO } from "@/lib/tv-types";
import { Noise } from "./noise";
import { InfoButton } from "./tv-overlays";
import { DynamicMascotPlayer } from "@/components/mascot/dynamic-mascot-player";
import { MascotCameo } from "@/components/mascot/mascot-cameo";

/** Server-synchronised "now" (ms). */
export type Clock = () => number;

// ───────────── synced video ─────────────

const noSubscribe = () => () => {};
function liteWanted() {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return prefersLite({ coarse: matchMedia("(pointer: coarse)").matches, narrow: matchMedia("(max-width: 900px)").matches, saveData: c?.saveData, effectiveType: c?.effectiveType });
}

/**
 * The mp4 to play: phones and slow connections get the light 720p copy of a TV clip. Decided only in the browser
 * (no src in the server HTML), so a phone never starts downloading the heavy original first.
 */
function useClipSrc(src: string | null) {
  const lite = useSyncExternalStore(noSubscribe, liteWanted, () => null);
  if (!src || lite === null) return undefined;
  return lite && src.startsWith("/api/tv/clip/") ? `${src}?q=lite` : src;
}

/**
 * Plays the slot's video at the position everyone else is at. Videos shorter than their slot loop.
 * Drift is corrected every few seconds; there is no way to pause or seek (it's live TV).
 */
export function SyncedVideo({
  slot,
  clock,
  muted,
  volume,
  onBlocked,
  frozen = false,
  timeRef,
}: {
  slot: TvSlotDTO;
  clock: Clock;
  muted: boolean;
  volume: number;
  onBlocked: () => void;
  /** Login wall: paused and no more segments are downloaded. */
  frozen?: boolean;
  /** Current position of the video (for subtitles). */
  timeRef?: React.RefObject<number>;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const v = slot.video!;
  const src = useClipSrc(v.hls ? null : v.src);
  useHls(ref, v.hls, frozen);
  const frozenRef = useRef(frozen);
  useEffect(() => {
    frozenRef.current = frozen;
  }, [frozen]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !timeRef) return;
    const on = () => (timeRef.current = el.currentTime);
    el.addEventListener("timeupdate", on);
    return () => el.removeEventListener("timeupdate", on);
  }, [timeRef]);

  // Frozen: stop playback and (for plain mp4) drop the source so nothing more is streamed.
  useEffect(() => {
    const el = ref.current;
    if (!el || !frozen) return;
    el.pause();
    el.muted = true;
    if (!v.hls) {
      el.removeAttribute("src");
      el.load();
    }
    return () => {
      if (!v.hls && src) {
        el.src = src;
        el.load();
      }
    };
  }, [frozen, v.hls, src]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // On a slow network a seek takes seconds to become playable. Seeking to "now" would land behind again and
    // re-seek forever (the video never starts), so we measure how long seeks take and aim that far ahead,
    // and never correct drift while a seek is still loading.
    let lag = 0;
    let seekAt = 0;
    const expected = (ahead = 0) => loopedPosition(slotOffset(slot.startsAt, slot.durationSec, clock()) + ahead, el.duration);
    const seek = () => {
      seekAt = performance.now();
      el.currentTime = expected(lag);
    };
    const play = () =>
      el.play().catch(() => {
        // Autoplay with sound was blocked: go muted and tell the screen to show "turn sound on".
        el.muted = true;
        onBlocked();
        el.play().catch(() => {});
      });
    const onReady = () => {
      if (!seekAt) return;
      lag = Math.min(15, (performance.now() - seekAt) / 1000 + 0.5);
      seekAt = 0;
    };
    const sync = () => {
      if (frozenRef.current || !(el.duration > 0)) return;
      if (el.seeking || el.readyState < 3) {
        // still buffering: let it load (retry the seek only if it has been stuck for 20 s)
        if (seekAt && performance.now() - seekAt > 20000) seek();
      } else if (Math.abs(el.currentTime - expected()) > Math.max(2.5, lag + 1.5)) seek();
      if (el.paused) play();
    };
    const onMeta = () => {
      seek();
      if (!frozenRef.current) play();
    };
    if (el.readyState >= 1) onMeta();
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("playing", onReady);
    const id = window.setInterval(sync, 4000);
    return () => {
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("playing", onReady);
      clearInterval(id);
    };
  }, [slot.startsAt, slot.durationSec, clock, onBlocked]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = muted || frozen;
    el.volume = volume;
    if (!muted && !frozen && el.paused) el.play().catch(() => {});
  }, [muted, volume, frozen]);

  return (
    <video
      ref={ref}
      key={slot.id}
      src={src}
      muted={muted}
      playsInline
      loop
      preload="auto"
      disablePictureInPicture
      controls={false}
      onContextMenu={(e) => e.preventDefault()}
      className={clsx("absolute inset-0 z-[1] h-full w-full object-contain", v.orientation === "VERTICAL" && "md:py-0")}
    />
  );
}

// ───────────── host bumper ─────────────

function useTypewriter(text: string, startedMsAgo: number) {
  const [n, setN] = useState(() => Math.min(text.length, Math.floor(startedMsAgo / 32)));
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = window.setTimeout(() => setN(text.length), 0);
      return () => clearTimeout(id);
    }
    const id = window.setInterval(() => setN((x) => (x >= text.length ? x : x + 1)), 32);
    return () => clearInterval(id);
  }, [text]);
  return text.slice(0, n);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function HostCard({ slot, channel, clock, chart, shoutouts = [], speak = false }: { slot: TvSlotDTO; channel: TvChannelDTO; clock: Clock; chart?: boolean; shoutouts?: string[]; speak?: boolean }) {
  const { t, locale } = useI18n();
  const [startedAgo] = useState(() => Math.max(0, clock() - slot.startsAt));
  const shown = useTypewriter(slot.text, startedAgo);
  const h = channel.hue;
  if (!chart)
    return (
      <div className="absolute inset-0 z-[2] flex items-center justify-center overflow-hidden px-6 pb-24 pt-16">
        <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(60% 70% at 50% 40%, hsl(${h} 70% 22%), #000 75%)` }} />
        <Noise opacity={0.07} />
        <div className="relative flex w-full max-w-3xl flex-col items-center text-center">
          <div className="tv-osd mb-1 text-lg uppercase md:text-2xl">
            {t.tv.host} · {t.v3.mascot.name}
          </div>
          <DynamicMascotPlayer key={slot.id} text={slot.text} startedAt={slot.startsAt} clock={clock} speak={speak} locale={locale} variant="stage" />
          {shoutouts.length > 0 && (
            <div className="mt-4 max-w-xl rounded-2xl bg-white/[.06] px-4 py-2.5 text-sm ring-1 ring-white/10">
              <span className="tv-osd mr-2 uppercase">{t.tv.live2.shoutouts}:</span>
              <span className="text-white/85">{shoutouts.slice(0, 4).join(" · ")}</span>
            </div>
          )}
        </div>
      </div>
    );
  return (
    <div className="absolute inset-0 z-[2] flex items-center justify-center overflow-hidden px-6">
      <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(60% 70% at 50% 40%, hsl(${h} 70% 22%), #000 75%)` }} />
      <Noise opacity={0.07} />
      <div className="relative flex w-full max-w-3xl flex-col items-center text-center">
        {chart ? (
          <div className="mb-6 font-display text-[64px] font-black leading-none tracking-tight md:text-[120px]">
            <span className="text-mirage">TOP 10</span>
          </div>
        ) : (
          <div className="relative mb-6">
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full font-display text-3xl font-bold text-white shadow-[0_0_60px_-6px_var(--glow)] ring-4 ring-white/10 md:h-32 md:w-32 md:text-4xl"
              style={{ background: `conic-gradient(from 200deg, hsl(${h} 90% 55%), hsl(${(h + 60) % 360} 90% 50%), hsl(${h} 90% 55%))`, ["--glow" as string]: `hsl(${h} 90% 55%)` }}
            >
              {initials(channel.hostName)}
            </div>
            <div className="tv-talk absolute -bottom-2 left-1/2 flex h-5 -translate-x-1/2 items-end gap-1 rounded-full bg-black/70 px-2.5 py-1">
              <span className="h-full w-1 rounded bg-[#7dffb2]" />
              <span className="h-full w-1 rounded bg-[#7dffb2]" />
              <span className="h-full w-1 rounded bg-[#7dffb2]" />
            </div>
          </div>
        )}
        <div className="tv-osd mb-3 text-xl uppercase md:text-2xl">
          {chart ? t.tv.chartTitle : `${t.tv.host} · ${channel.hostName}`}
        </div>
        <p className={clsx("min-h-[3.5em] text-balance text-xl font-semibold leading-snug md:text-3xl", shown.length < slot.text.length && "tv-caret")} suppressHydrationWarning>{shown}</p>
        {shoutouts.length > 0 && (
          <div className="mt-5 max-w-xl rounded-2xl bg-white/[.06] px-4 py-2.5 text-sm ring-1 ring-white/10">
            <span className="tv-osd mr-2 uppercase">{t.tv.live2.shoutouts}:</span>
            <span className="text-white/85">{shoutouts.slice(0, 4).join(" · ")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Breaking news: the mascot reads the control room's text full screen, with a news chyron. */
export function NewsCard({ slot, clock, speak }: { slot: TvSlotDTO; clock: Clock; speak: boolean }) {
  const { t, locale } = useI18n();
  return (
    <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center overflow-hidden px-6 pb-28 pt-16">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(60%_70%_at_50%_35%,#3a0a1c,#000_75%)]" />
      <Noise opacity={0.09} />
      <div className="relative w-full max-w-3xl">
        <DynamicMascotPlayer key={slot.id} timeline={slot.mascot?.timeline} text={slot.mascot ? undefined : slot.text} audioUrl={slot.mascot?.audioUrl} startedAt={slot.startsAt} clock={clock} speak={speak} locale={locale} variant="stage" />
      </div>
      <div className="absolute inset-x-0 bottom-[calc(var(--tv-ui-bottom,0px)+70px)] flex items-stretch text-white">
        <span className="flex items-center gap-2 bg-[#ff2e63] px-4 py-2 font-display text-sm font-black uppercase tracking-wider md:text-lg">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> {t.v3.live.breaking}
        </span>
        <span className="flex min-w-0 flex-1 items-center bg-black/80 px-4 text-sm font-semibold md:text-base">
          <span className="truncate">{t.v3.mascot.name} · MIRAGE TV</span>
        </span>
      </div>
    </div>
  );
}

// ───────────── test card / promo ─────────────

const BARS = ["#c0c0c0", "#c0c000", "#00c0c0", "#00c000", "#c000c0", "#c00000", "#0000c0"];

export function TestCard({ channel }: { channel: TvChannelDTO }) {
  const { t } = useI18n();
  return (
    <div className="absolute inset-0 z-[2] flex flex-col">
      <div className="flex flex-[7]">
        {BARS.map((c) => (
          <div key={c} className="flex-1" style={{ background: c }} />
        ))}
      </div>
      <div className="flex flex-[1]">
        {[...BARS].reverse().map((c, i) => (
          <div key={c} className="flex-1" style={{ background: i % 2 ? "#111" : c }} />
        ))}
      </div>
      <div className="flex flex-[2] bg-[#111]" />
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
        {/* Mr. Static panics over the dead signal */}
        <MascotCameo kind="oops" className="-mb-6 w-[150px] md:w-[230px]" />
        <div className="relative max-w-md rounded-2xl bg-black/85 px-6 py-5 text-center ring-1 ring-white/15">
          <div className="tv-osd text-3xl md:text-4xl">
            CH {String(channel.number).padStart(2, "0")} · {t.tv.noSignal.toUpperCase()}
          </div>
          <p className="mt-2 text-sm text-white/75">{t.tv.noSignalText}</p>
        </div>
      </div>
    </div>
  );
}

export function PromoCard({ slot, kids, onOrder }: { slot: TvSlotDTO; kids: boolean; onOrder: () => void }) {
  const { t } = useI18n();
  // Alternate the house promo between the Library and "order your own ad".
  const order = !kids && [...slot.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 2 === 1;
  return (
    <div className="absolute inset-0 z-[2] flex items-center justify-center overflow-hidden px-6">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: order ? "radial-gradient(70% 80% at 30% 30%, rgba(255,200,61,.28), transparent 60%), radial-gradient(70% 80% at 80% 80%, rgba(255,46,99,.3), transparent 60%), #07070b" : "radial-gradient(70% 80% at 70% 20%, rgba(124,92,255,.4), transparent 60%), radial-gradient(70% 80% at 20% 90%, rgba(255,46,99,.32), transparent 60%), #07070b" }}
      />
      <div className="relative max-w-xl text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
          <Megaphone size={14} /> {t.tv.adBreak}
        </span>
        <h2 className="font-display text-3xl font-bold md:text-5xl">{order ? t.tv.promoOrder : t.tv.promoTitle}</h2>
        <p className="mx-auto mt-3 max-w-md text-white/80 md:text-lg">{order ? fmt(t.tv.promoOrderText, { price: TV_ORDER_PRICE }) : t.tv.promoText}</p>
        {order ? (
          <button type="button" onClick={onOrder} className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-coin px-6 font-semibold text-black">
            <Sparkles size={18} /> {t.tv.order.cta}
          </button>
        ) : (
          <Link href="/library" className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-6 font-semibold text-black">
            {t.tv.promoCta} <ArrowRight size={18} />
          </Link>
        )}
      </div>
    </div>
  );
}

// ───────────── lower thirds ─────────────

function remaining(slot: TvSlotDTO, now: number) {
  return Math.max(0, Math.round(slot.durationSec - slotOffset(slot.startsAt, slot.durationSec, now)));
}

/** Ticks once a second (for progress bars and remaining time). */
export function useNow(clock: Clock) {
  const [now, setNow] = useState(() => clock());
  useEffect(() => {
    const id = window.setInterval(() => setNow(clock()), 1000);
    return () => clearInterval(id);
  }, [clock]);
  return now;
}

export function LowerThird({
  slot,
  channel,
  clock,
  onLike,
}: {
  slot: TvSlotDTO;
  channel: TvChannelDTO;
  clock: Clock;
  onLike?: () => void;
}) {
  const { t } = useI18n();
  const now = useNow(clock);
  const left = remaining(slot, now);
  const progress = Math.min(1, slotOffset(slot.startsAt, slot.durationSec, now) / slot.durationSec);
  const elapsed = slot.durationSec - left;

  if (slot.clipKind === "MUSIC") {
    // 2000s music-TV caption: shows at the start and the end of the video.
    const show = elapsed < 7 || left < 6;
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-[var(--tv-ui-bottom,0px)] z-[7] transition-[bottom] duration-500 p-4 md:p-8">
        <div className={clsx("flex items-end justify-between gap-4 transition-all duration-500", show ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")}>
          <div className="max-w-[80%] font-sans [text-shadow:0_2px_8px_rgba(0,0,0,.9)]">
            <div className="text-xl font-black uppercase tracking-tight md:text-3xl">{slot.subtitle || channel.name}</div>
            <div className="text-lg font-medium md:text-2xl">“{slot.title}”</div>
            <div className="mt-1 text-xs font-bold uppercase tracking-[.25em] text-white/70">{channel.name}</div>
          </div>
        </div>
        {onLike && (
          <button
            type="button"
            onClick={onLike}
            title={t.tv.likesHint}
            aria-label={slot.liked ? t.tv.liked : t.tv.like}
            className={clsx(
              "pointer-events-auto absolute bottom-4 right-4 flex h-12 items-center gap-2 rounded-full px-4 font-semibold backdrop-blur md:bottom-8 md:right-8",
              slot.liked ? "bg-accent text-white" : "bg-black/60 text-white ring-1 ring-white/20",
            )}
          >
            <Heart size={18} fill={slot.liked ? "currentColor" : "none"} /> {slot.likes}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[var(--tv-ui-bottom,0px)] z-[7] transition-[bottom] duration-500 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pb-3 pt-16 md:px-8 md:pb-4">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/75">
            {slot.kind === "BREAK" ? (
              <span className="rounded bg-coin px-1.5 py-0.5 text-black">{t.tv.adBreak}</span>
            ) : slot.kind === "EPISODE" ? (
              <span className="rounded bg-accent px-1.5 py-0.5 text-white">{fmt(t.tv.episode, { n: slot.subtitle })}</span>
            ) : (
              slot.clipKind && <span className="rounded bg-white/15 px-1.5 py-0.5">{t.tv.kinds[slot.clipKind as keyof typeof t.tv.kinds] ?? slot.clipKind}</span>
            )}
            <span className="tv-osd text-sm normal-case" suppressHydrationWarning>{left >= 60 ? fmt(t.tv.leftMin, { m: Math.ceil(left / 60) }) : fmt(t.tv.leftSec, { s: left })}</span>
          </div>
          <div className="flex items-end gap-2.5">
            <h2 className="line-clamp-2 min-w-0 font-display text-lg font-bold leading-tight md:text-3xl">{slot.title}</h2>
            {slot.info && <InfoButton info={slot.info} />}
          </div>
          {slot.kind !== "EPISODE" && slot.subtitle && <p className="text-sm text-white/75">{slot.subtitle}</p>}
        </div>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-[#7dffb2] transition-[width] duration-1000 ease-linear" style={{ width: `${progress * 100}%` }} />
      </div>
      {slot.sponsor && (
        <div className="absolute right-4 top-2 rounded-xl bg-coin px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-black shadow-lg md:right-8 md:text-sm">
          {fmt(t.v3.live.sponsor, { name: slot.sponsor })}
        </div>
      )}
    </div>
  );
}

function ChartBadge({ place }: { place: number }) {
  const { t } = useI18n();
  return (
    <div className="pointer-events-none absolute right-4 top-20 z-[7] rounded-2xl bg-black/70 px-4 py-2 text-right ring-1 ring-white/15 backdrop-blur md:right-8 md:top-24">
      <div className="text-[11px] font-semibold uppercase tracking-[.2em] text-white/70">{t.tv.chartTitle}</div>
      <div className="font-display text-4xl font-black text-mirage md:text-6xl">{fmt(t.tv.chartPlace, { n: place })}</div>
    </div>
  );
}

// ───────────── the whole stage ─────────────

export function Stage({
  slot,
  channel,
  clock,
  muted,
  volume,
  kids,
  onBlocked,
  onOrder,
  onLike,
  loggedIn,
  onQuizAnswered,
  shoutouts,
  onGame,
  frozen = false,
  timeRef,
  speak = false,
  minimal = false,
}: {
  slot: TvSlotDTO;
  channel: TvChannelDTO;
  clock: Clock;
  muted: boolean;
  volume: number;
  kids: boolean;
  onBlocked: () => void;
  onOrder: () => void;
  onLike: () => void;
  loggedIn: boolean;
  onQuizAnswered: (slotId: string, options: string[]) => void;
  shoutouts: string[];
  onGame: () => void;
  frozen?: boolean;
  timeRef?: React.RefObject<number>;
  /** The host may speak (sound on, viewer's "host voice" on). */
  speak?: boolean;
  /** Stream-page layout: the title lives under the player, so no lower third (music captions stay). */
  minimal?: boolean;
}) {
  const { t } = useI18n();
  const vertical = slot.video?.orientation === "VERTICAL";
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {slot.video && (
        <>
          {/* Vertical clips on a wide screen: channel-coloured glow instead of black bars */}
          {vertical && <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(40% 70% at 50% 50%, hsl(${channel.hue} 70% 25% / .9), #000 80%)` }} />}
          <SyncedVideo key={slot.id} slot={slot} clock={clock} muted={muted} volume={volume} onBlocked={onBlocked} frozen={frozen} timeRef={timeRef} />
          {(!minimal || slot.clipKind === "MUSIC") && <LowerThird slot={slot} channel={channel} clock={clock} onLike={slot.clipKind === "MUSIC" && !kids ? onLike : undefined} />}
          {slot.chartPlace && <ChartBadge place={slot.chartPlace} />}
        </>
      )}
      {!slot.video && (slot.kind === "HOST" || slot.kind === "CHART") && (slot.text ? <HostCard key={slot.id} slot={slot} channel={channel} clock={clock} chart={slot.kind === "CHART"} shoutouts={shoutouts} speak={speak && !frozen} /> : <TestCard channel={channel} />)}
      {slot.kind === "NEWS" && <NewsCard key={slot.id} slot={slot} clock={clock} speak={speak && !frozen} />}
      {slot.kind === "QUIZ" && <QuizCard key={slot.id} slot={slot} channel={channel} clock={clock} loggedIn={loggedIn} onAnswered={onQuizAnswered} />}
      {slot.kind === "BREAK" && !kids && (
        <button
          type="button"
          onClick={onGame}
          className="absolute left-1/2 top-[38%] z-[8] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#7dffb2] px-5 py-3 font-semibold text-black shadow-[0_0_40px_rgba(125,255,178,.5)] md:top-[30%]"
        >
          <Gamepad2 size={18} /> {t.tv.live2.game.cta}
        </button>
      )}
      {!slot.video && slot.kind === "BREAK" && <PromoCard slot={slot} kids={kids} onOrder={onOrder} />}
      {!slot.video && (slot.kind === "CLIP" || slot.kind === "EPISODE") && <TestCard channel={channel} />}
    </div>
  );
}
