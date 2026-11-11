"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Info, Popcorn, Sparkles, Volume2, X } from "lucide-react";
import clsx from "clsx";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { cueAt, parseCues } from "@/lib/captions";
import type { TvInfoDTO, TvLiveDTO, TvSlotDTO } from "@/lib/tv-types";
import { DynamicMascotPlayer } from "@/components/mascot/dynamic-mascot-player";
import { slotOffset } from "@/lib/tv-rules";
import type { Clock } from "./tv-stage";

// ───────────── unmute ─────────────

/** Big pulsing "turn sound on" over the picture: autoplay always starts muted so browsers never block it. */
export function UnmuteButton({ onClick, className }: { onClick: () => void; className?: string }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      title={t.v3.live.unmuteHint}
      className={clsx("pulse-ring flex items-center gap-2.5 rounded-full bg-white px-6 py-3.5 text-base font-bold text-black shadow-2xl md:px-7 md:py-4 md:text-lg", className)}
    >
      <Volume2 size={22} /> {t.v3.live.unmute}
    </button>
  );
}

// ───────────── captions ─────────────

/** Subtitles while muted: the clip's WebVTT/SRT synced to the video, or a short descriptive caption. */
export function LiveCaptions({ slot, timeRef, compact = false }: { slot: TvSlotDTO; timeRef: React.RefObject<number>; compact?: boolean }) {
  const { t } = useI18n();
  const cues = useMemo(() => (slot.captions ? parseCues(slot.captions) : []), [slot.captions]);
  const [text, setText] = useState("");
  useEffect(() => {
    const fallback = slot.clipKind === "MUSIC" ? fmt(t.v3.live.captionsMusic, { title: [slot.subtitle, slot.title].filter(Boolean).join(" — ") }) : "";
    const tick = () => setText(cues.length ? cueAt(cues, timeRef.current ?? 0)?.text ?? "" : fallback);
    tick();
    const id = window.setInterval(tick, 250);
    return () => clearInterval(id);
  }, [cues, timeRef, slot.clipKind, slot.subtitle, slot.title, t.v3.live.captionsMusic]);
  if (!text) return null;
  return (
    <div
      className={clsx(
        "pointer-events-none absolute inset-x-0 z-[6] flex justify-center px-4",
        // compact = stream layout: no lower third; on phones the chat stream owns the bottom, so subtitles go up top
        compact ? "max-lg:top-[96px] lg:bottom-[calc(var(--tv-ui-bottom,0px)+20px)]" : "bottom-[calc(var(--tv-ui-bottom,0px)+118px)] md:bottom-[calc(var(--tv-ui-bottom,0px)+140px)]",
      )}
      aria-live="polite"
    >
      <p className="max-w-3xl whitespace-pre-line rounded-lg bg-black/75 px-3 py-1.5 text-center text-base font-semibold leading-snug text-white md:text-xl">{text}</p>
    </div>
  );
}

// ───────────── info ─────────────

/** ℹ️ "What's going on?" — opens a compact card over the picture; the broadcast keeps playing. */
export function InfoButton({ info }: { info: TvInfoDTO }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  // open towards the side with room: a button near the right edge (home page on a phone) opens leftwards
  const [right, setRight] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="pointer-events-auto relative inline-flex">
      <button
        type="button"
        onClick={() => {
          const r = ref.current?.getBoundingClientRect();
          setRight(!!r && r.left + r.width / 2 > window.innerWidth / 2);
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-label={t.v3.live.info}
        title={t.v3.live.info}
        className="flex h-8 items-center gap-1.5 rounded-full bg-white/15 px-2.5 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/25 md:h-9 md:px-3 md:text-sm"
      >
        <Info size={16} /> <span className="max-sm:hidden">{t.v3.live.info}</span>
      </button>
      {open && (
        <div className={clsx(
            "popover animate-pop absolute bottom-full z-[40] mb-2 w-[min(calc(100vw-24px),360px)] rounded-2xl p-4 text-left normal-case tracking-normal",
            right ? "right-0 origin-bottom-right" : "left-0 origin-bottom-left",
          )}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{t.v3.live.infoTitle}</div>
              <h3 className="mt-0.5 font-display text-lg font-bold leading-tight text-text">{info.title}</h3>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={t.common.close} className="-mr-1 -mt-1 rounded-full p-1.5 text-muted hover:bg-white/10 hover:text-text">
              <X size={16} />
            </button>
          </div>
          <p className="mt-2 line-clamp-6 text-sm leading-relaxed text-text/85">{info.lore || t.v3.live.noLore}</p>
          <dl className="mt-3 space-y-2 text-sm">
            {info.author && (
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-muted">{t.v3.live.author}</dt>
                <dd>
                  <Link href={`/u/${info.author.id}`} className="font-semibold text-accent hover:underline">
                    @{info.author.name}
                  </Link>
                </dd>
              </div>
            )}
            {info.aiTools.length > 0 && (
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-muted">{t.v3.live.madeWith}</dt>
                <dd className="flex flex-wrap gap-1">
                  {info.aiTools.map((m) => (
                    <span key={m} className="rounded-md bg-white/8 px-1.5 py-0.5 font-mono text-[11px] text-text/90 ring-1 ring-white/10">
                      {m}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {info.tags.length > 0 && (
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-muted">{t.v3.live.tags}</dt>
                <dd className="text-text/90">{info.tags.map((g) => (t.genres as Record<string, string>)[g] ?? g).join(" · ")}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-muted">{t.v3.live.rating}</dt>
              <dd>
                <span className="rounded border border-white/25 px-1.5 text-xs font-bold text-text">{info.ageRating}</span>
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

// ───────────── live → paid series funnel ─────────────

export function trackFunnel(seriesSlug: string, channel: string) {
  try {
    const body = JSON.stringify({ series: seriesSlug, channel });
    if (!navigator.sendBeacon?.("/api/tv/funnel", new Blob([body], { type: "application/json" })))
      void fetch("/api/tv/funnel", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
  } catch {}
}

/**
 * "🍿 Watch the whole series": a corner chip for the whole segment, and a big card in the last 15 seconds —
 * the viewer liked the teaser, they shouldn't wait for the next airing.
 */
export function FunnelCta({ slot, clock, channel, corner = true }: { slot: TvSlotDTO; clock: Clock; channel: string; corner?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [left, setLeft] = useState(() => slot.durationSec);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const tick = () => setLeft(slot.durationSec - slotOffset(slot.startsAt, slot.durationSec, clock()));
    tick();
    const id = window.setInterval(tick, 500);
    return () => clearInterval(id);
  }, [slot.startsAt, slot.durationSec, clock]);
  if (!slot.series) return null;
  const href = `/series/${slot.series.slug}`;
  const go = (e: React.MouseEvent) => {
    e.preventDefault();
    trackFunnel(slot.series!.slug, channel);
    router.push(href);
  };
  const finale = left <= 15 && !dismissed && slot.durationSec > 20;
  return (
    <>
      {corner && <a
        href={href}
        onClick={go}
        className={clsx(
          "absolute right-3 top-[max(74px,calc(env(safe-area-inset-top)+66px))] z-[19] flex max-w-[60vw] items-center gap-2 rounded-full bg-black/60 py-1.5 pl-1.5 pr-3.5 text-sm font-semibold ring-1 ring-white/20 backdrop-blur transition-opacity hover:bg-black/80 md:right-8 md:top-24",
          finale && "opacity-0",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={slot.series.poster} alt="" className="h-8 w-6 rounded object-cover" />
        <Popcorn size={16} className="shrink-0 text-coin" />
        <span className="truncate">{t.v3.live.watchSeries}</span>
        <ArrowRight size={15} className="shrink-0" />
      </a>}
      {finale && (
        <div className="animate-fade-up absolute inset-x-3 bottom-[calc(var(--tv-ui-bottom,0px)+124px)] z-[24] mx-auto flex max-w-xl items-center gap-4 rounded-3xl bg-black/80 p-3 pr-4 ring-1 ring-white/15 backdrop-blur-xl md:bottom-[calc(var(--tv-ui-bottom,0px)+150px)] md:p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slot.series.poster} alt="" className="h-24 w-16 shrink-0 rounded-xl object-cover md:h-28 md:w-20" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-base font-bold md:text-lg">{slot.series.title}</div>
            <p className="mt-0.5 text-xs text-white/70 md:text-sm">{t.v3.live.watchSeriesHint}</p>
            <a href={href} onClick={go} className="mt-2.5 flex h-11 items-center justify-center gap-2 rounded-2xl bg-coin px-4 text-sm font-bold text-black shadow-[0_8px_30px_-8px_rgba(255,200,61,.9)] md:text-[15px]">
              <Popcorn size={18} /> <span className="truncate">{t.v3.live.watchSeriesLong}</span>
            </a>
          </div>
          <button type="button" onClick={() => setDismissed(true)} aria-label={t.common.close} className="self-start rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}

// ───────────── control-room alerts & teleprompter PiP ─────────────

export function AlertsBar({ alerts, top }: { alerts: TvLiveDTO["alerts"]; top?: number }) {
  const { t } = useI18n();
  if (!alerts.length) return null;
  const text = alerts.map((a) => a.text).join("   ✦   ");
  const dur = Math.max(14, text.length * 0.2);
  return (
    <div style={top !== undefined ? { top } : undefined} className="absolute inset-x-0 top-[max(64px,calc(env(safe-area-inset-top)+56px))] z-[21] flex h-9 items-stretch overflow-hidden bg-[#c8102e]/90 text-sm font-bold text-white shadow-lg md:top-[86px] md:h-10 md:text-[15px]" role="status">
      <span className="z-10 flex shrink-0 items-center gap-1.5 bg-white px-3 uppercase tracking-wider text-[#c8102e]">
        <AlertTriangle size={15} /> {t.v3.live.alert}
      </span>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div className="tv-marquee absolute inset-y-0 left-0 flex w-max items-center whitespace-nowrap" style={{ ["--dur" as string]: `${dur}s` }}>
          <span className="px-6">{text}</span>
          <span className="px-6" aria-hidden>
            {text}
          </span>
        </div>
      </div>
    </div>
  );
}

/** The live teleprompter in a corner window: the mascot reads the admin's text over the current video. */
export function PipMascot({ pip, clock, speak }: { pip: NonNullable<TvLiveDTO["pip"]>; clock: Clock; speak: boolean }) {
  const { t, locale } = useI18n();
  return (
    <div className="animate-fade-up absolute bottom-[calc(var(--tv-ui-bottom,0px)+120px)] right-3 z-[22] w-36 overflow-hidden rounded-2xl bg-[radial-gradient(80%_80%_at_50%_30%,#2a1840,#07070b)] ring-2 ring-[#ff2e63]/70 shadow-2xl md:bottom-auto md:right-8 md:top-40 md:w-56">
      <div className="flex items-center gap-1.5 bg-[#ff2e63] px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white md:text-xs">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> {t.v3.live.breaking}
      </div>
      <div className="aspect-[4/5] p-1">
        <DynamicMascotPlayer key={pip.id} variant="pip" timeline={pip.timeline} audioUrl={pip.audioUrl} startedAt={pip.startsAt} clock={clock} speak={speak} locale={locale} />
      </div>
    </div>
  );
}

/** "⚡ Break into the broadcast" — order a show for coins. */
export function BreakInButton({ onClick, compact, className }: { onClick: () => void; compact?: boolean; className?: string }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      title={t.v3.live.breakInHint}
      className={clsx(
        "flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(100deg,#ffc83d,#ff8a3d)] font-bold text-black shadow-[0_8px_28px_-10px_rgba(255,170,61,.9)] transition-transform active:scale-[.98]",
        compact ? "h-10 rounded-full px-3.5 text-sm" : "h-12 w-full text-[15px]",
        className,
      )}
    >
      <Sparkles size={compact ? 16 : 18} /> {compact ? <span className="max-sm:hidden">{t.v3.home.order}</span> : t.v3.home.order}
      {compact && <span className="sm:hidden">{t.v3.live.breakInShort}</span>}
    </button>
  );
}
