"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import clsx from "clsx";
import { useI18n } from "@/i18n/client";
import type { TvChannelDTO, TvSlotDTO } from "@/lib/tv-types";
import { useNow, type Clock } from "./tv-stage";

type GuideItem = { channel: TvChannelDTO; slot: TvSlotDTO | null; program: TvSlotDTO | null };

function hhmm(ms: number) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function slotLabel(s: TvSlotDTO, t: ReturnType<typeof useI18n>["t"]) {
  if (s.kind === "BREAK") return t.tv.adBreak;
  if (s.kind === "CHART") return t.tv.chartTitle;
  if (s.kind === "HOST") return `${t.tv.host}: ${s.title}`;
  if (s.kind === "EPISODE") return `${s.title} · ${s.subtitle}`;
  return s.subtitle && s.clipKind === "MUSIC" ? `${s.subtitle} — ${s.title}` : s.title;
}

/** Full-screen programme guide: every channel's current programme + the next slots of this channel. */
export function Guide({
  open,
  onClose,
  current,
  next,
  clock,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  current: TvChannelDTO;
  next: TvSlotDTO[];
  clock: Clock;
  onPick: (slug: string) => void;
}) {
  const { t } = useI18n();
  const [items, setItems] = useState<GuideItem[] | null>(null);
  const now = useNow(clock);

  useEffect(() => {
    if (!open) return;
    let live = true;
    fetch("/api/tv/guide", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { items: GuideItem[] } | null) => live && d && setItems(d.items))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);

  if (!open) return null;
  const programmes = next.filter((s) => s.kind === "CLIP" || s.kind === "EPISODE" || s.kind === "CHART");

  return (
    <div className="absolute inset-0 z-[40] flex flex-col bg-black/92 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={t.tv.guideTitle}>
      <div className="flex items-center justify-between px-4 pb-3 pt-[max(16px,env(safe-area-inset-top))] md:px-8 md:pt-6">
        <h2 className="tv-osd text-3xl uppercase md:text-4xl">{t.tv.guideTitle}</h2>
        <Link href="/tv/guide" className="ml-auto mr-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15">
          {t.tv.live2.fullGuide}
        </Link>
        <button type="button" onClick={onClose} aria-label={t.common.close} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/15">
          <X size={20} />
        </button>
      </div>
      <div className="no-scrollbar grid min-h-0 flex-1 gap-6 overflow-y-auto px-4 pb-8 md:grid-cols-[1.4fr_1fr] md:px-8">
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[.2em] text-white/50">{t.tv.guideNow}</h3>
          {!items && <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[68px] rounded-2xl" />)}</div>}
          {items && !items.length && <p className="text-white/60">{t.tv.guideEmpty}</p>}
          <ul className="space-y-2">
            {items?.map(({ channel: c, slot, program }) => {
              const shown = program ?? slot;
              const progress = slot ? Math.min(1, Math.max(0, (now - slot.startsAt) / 1000 / slot.durationSec)) : 0;
              return (
                <li key={c.slug}>
                  <button
                    type="button"
                    onClick={() => onPick(c.slug)}
                    className={clsx(
                      "flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left ring-1 transition-colors md:px-4",
                      c.slug === current.slug ? "bg-[#7dffb2]/10 ring-[#7dffb2]/40" : "bg-white/[.04] ring-white/10 hover:bg-white/[.08]",
                    )}
                  >
                    <span className="tv-osd w-12 shrink-0 text-center text-3xl">{String(c.number).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-display text-[15px] font-bold">{c.name}</span>
                        {c.isAdult && <span className="rounded bg-accent/80 px-1 text-[10px] font-bold">18+</span>}
                      </span>
                      <span className="block truncate text-sm text-white/70">{shown ? slotLabel(shown, t) : c.tagline}</span>
                      <span className="mt-1.5 block h-0.5 overflow-hidden rounded-full bg-white/10">
                        <span className="block h-full bg-[#7dffb2]" style={{ width: `${progress * 100}%` }} />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[.2em] text-white/50">
            {current.name} · {t.tv.next}
          </h3>
          <ol className="space-y-1">
            {programmes.map((s) => (
              <li key={s.id} className="flex gap-3 rounded-xl px-3 py-2.5 odd:bg-white/[.03]">
                <span className="tv-osd w-14 shrink-0 text-xl">{hhmm(s.startsAt)}</span>
                <span className="min-w-0 truncate text-[15px] text-white/85">{slotLabel(s, t)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
