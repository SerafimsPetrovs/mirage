"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { CalendarClock, Eye, Popcorn, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { slotOffset } from "@/lib/tv-rules";
import type { TvChannelDTO, TvSlotDTO } from "@/lib/tv-types";
import type { Clock } from "./tv-stage";
import { InfoButton, trackFunnel } from "./tv-overlays";
import { useRouter } from "next/navigation";

function hhmm(ms: number) {
  const d = new Date(ms);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

/** Square channel "avatar": number on the channel colour (like a streamer's avatar on Twitch). */
export function ChannelBadge({ channel, size = 56, live = true }: { channel: { number: number; hue: number }; size?: number; live?: boolean }) {
  return (
    <span
      className={clsx("relative flex shrink-0 items-center justify-center rounded-2xl font-[family-name:var(--font-vt)] text-white", live && "ring-2 ring-[#ff3b3b] ring-offset-2 ring-offset-bg")}
      style={{ width: size, height: size, fontSize: size * 0.5, background: "linear-gradient(145deg, hsl(" + channel.hue + " 80% 45%), hsl(" + ((channel.hue + 50) % 360) + " 70% 22%))" }}
    >
      {String(channel.number).padStart(2, "0")}
    </span>
  );
}

function programTitle(slot: TvSlotDTO, channel: TvChannelDTO, t: ReturnType<typeof useI18n>["t"]) {
  if (slot.kind === "EPISODE") return slot.title;
  if (slot.kind === "BREAK") return slot.title || t.tv.adBreak;
  if (slot.kind === "HOST" || slot.kind === "NEWS") return slot.kind === "NEWS" ? t.v3.live.breaking : t.v3.mascot.name;
  if (slot.kind === "QUIZ") return t.tv.live2.quiz.title;
  if (slot.clipKind === "MUSIC" && slot.subtitle) return slot.subtitle + " — " + slot.title;
  return slot.title || channel.name;
}

/**
 * Under the player, like a stream page: channel avatar, what's on, tags, viewers, time left, what's next,
 * and the actions (watch the whole series, order a show).
 */
export function TvInfoBar({
  channel,
  slot,
  next,
  clock,
  viewers,
  onOrder,
  onGuide,
  social,
}: {
  channel: TvChannelDTO;
  slot: TvSlotDTO;
  next: TvSlotDTO[];
  clock: Clock;
  viewers: number;
  onOrder: () => void;
  onGuide: () => void;
  social: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [left, setLeft] = useState(slot.durationSec);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.round(slot.durationSec - slotOffset(slot.startsAt, slot.durationSec, clock()))));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [slot.startsAt, slot.durationSec, clock]);
  const upcoming = next.find((n) => n.kind === "CLIP" || n.kind === "EPISODE");
  const kind = slot.kind === "EPISODE" ? fmt(t.tv.episode, { n: slot.subtitle }) : slot.clipKind ? t.tv.kinds[slot.clipKind as keyof typeof t.tv.kinds] : null;
  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:flex-row md:items-start md:px-6">
      <div className="flex min-w-0 flex-1 gap-3.5">
        <ChannelBadge channel={channel} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h1 className="line-clamp-2 min-w-0 font-display text-lg font-bold leading-tight md:text-2xl">{programTitle(slot, channel, t)}</h1>
            {slot.info && (
              <span className="shrink-0 pt-0.5">
                <InfoButton info={slot.info} />
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-semibold text-[#7dffb2]">{channel.name}</span>
            {kind && <span className="rounded-md bg-white/8 px-1.5 py-0.5 text-xs font-semibold text-text/90">{kind}</span>}
            {slot.info?.tags.slice(0, 3).map((g) => (
              <span key={g} className="rounded-full bg-white/[.06] px-2 py-0.5 text-xs text-muted ring-1 ring-white/10">
                {(t.genres as Record<string, string>)[g] ?? g}
              </span>
            ))}
            <span className="text-xs text-muted" suppressHydrationWarning>
              · {left >= 60 ? fmt(t.tv.leftMin, { m: Math.ceil(left / 60) }) : fmt(t.tv.leftSec, { s: left })}
            </span>
          </div>
          {upcoming && (
            <p className="mt-1.5 truncate text-sm text-muted" suppressHydrationWarning>
              {fmt(t.v3.home.next, { title: upcoming.title + (upcoming.kind === "EPISODE" ? " · " + upcoming.subtitle : ""), time: hhmm(upcoming.startsAt) })}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
        <span className="flex h-9 items-center gap-1.5 rounded-full px-1 text-sm font-semibold text-[#ff6b6b]" title={fmt(t.tv.live2.viewers, { n: viewers })}>
          <Eye size={16} /> {fmt(t.v3.home.watching, { n: Math.max(1, viewers) })}
        </span>
        <button type="button" onClick={onGuide} className="flex h-9 items-center gap-1.5 rounded-full bg-white/[.07] px-3.5 text-sm font-semibold ring-1 ring-white/10 hover:bg-white/[.12]">
          <CalendarClock size={16} /> {t.tv.guide}
        </button>
        {social && (
          <button type="button" onClick={onOrder} title={t.v3.live.breakInHint} className="flex h-9 items-center gap-1.5 rounded-full bg-white/[.07] px-3.5 text-sm font-semibold ring-1 ring-white/10 hover:bg-white/[.12]">
            <Sparkles size={16} className="text-coin" /> {t.v3.home.order}
          </button>
        )}
        {slot.series && (
          <a
            href={"/series/" + slot.series.slug}
            onClick={(e) => {
              e.preventDefault();
              trackFunnel(slot.series!.slug, channel.slug);
              router.push("/series/" + slot.series!.slug);
            }}
            className="flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold text-black hover:bg-white/90"
          >
            <Popcorn size={16} /> {t.v3.live.watchSeries}
          </a>
        )}
      </div>
    </div>
  );
}

export type StripItem = { slug: string; number: number; name: string; hue: number; title: string };

/** "Live on other channels" — Netflix-style row of channel cards; click = switch channel without leaving the page. */
export function ChannelStrip({ items, current, onPick }: { items: StripItem[]; current: string; onPick: (slug: string) => void }) {
  const { t } = useI18n();
  if (items.length < 2) return null;
  return (
    <section className="px-4 pb-2 md:px-6">
      <h2 className="mb-3 font-display text-base font-bold md:text-lg">{t.v3.home.channels}</h2>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
        {items.map((c) => {
          const active = c.slug === current;
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => onPick(c.slug)}
              aria-current={active ? "true" : undefined}
              className={clsx("group w-[210px] shrink-0 snap-start text-left md:w-[240px]", active && "pointer-events-none")}
            >
              <div
                className={clsx("relative aspect-video overflow-hidden rounded-xl ring-1 transition-transform duration-200 group-hover:-translate-y-0.5", active ? "ring-2 ring-[#7dffb2]" : "ring-white/10")}
                style={{ background: "radial-gradient(80% 90% at 30% 20%, hsl(" + c.hue + " 75% 42%), hsl(" + ((c.hue + 40) % 360) + " 60% 12%) 70%, #05050a)" }}
              >
                <div className="tv-scanlines absolute inset-0 opacity-60" />
                <span className="absolute left-2 top-2 rounded bg-[#e91916] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">{t.tv.live}</span>
                <span className="absolute bottom-1.5 right-2.5 font-[family-name:var(--font-vt)] text-4xl leading-none text-white/90 [text-shadow:0_2px_8px_rgba(0,0,0,.6)]">
                  {String(c.number).padStart(2, "0")}
                </span>
                {active && <span className="absolute inset-x-0 bottom-0 bg-[#7dffb2] py-0.5 text-center text-[10px] font-black uppercase tracking-wider text-black">{t.v3.home.watchingNow}</span>}
              </div>
              <div className="mt-2 flex gap-2">
                <ChannelBadge channel={c} size={30} live={false} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{c.title || c.name}</div>
                  <div className="truncate text-xs text-muted">{c.name}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
