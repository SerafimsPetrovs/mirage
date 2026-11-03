"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Info, Play } from "lucide-react";
import type { SeriesCard } from "@/lib/catalog";
import { useI18n } from "@/i18n/client";
import { btn } from "@/components/ui/button";
import { AiChip } from "@/components/ui/misc";
import { plural } from "@/i18n/shared";

export function Hero({ items }: { items: SeriesCard[] }) {
  const { t, locale } = useI18n();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || items.length < 2) return;
    const id = setInterval(() => setI((x) => (x + 1) % items.length), 7000);
    return () => clearInterval(id);
  }, [paused, items.length]);

  if (!items.length) return <div className="h-[var(--header-h)]" />;
  const s = items[i];

  return (
    <section
      className="relative h-[78svh] min-h-[540px] w-full overflow-hidden md:h-[88vh] md:max-h-[860px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {items.map((it, idx) => (
        <div key={it.id} className={clsx("absolute inset-0 transition-opacity duration-1000", idx === i ? "opacity-100" : "opacity-0")} aria-hidden={idx !== i}>
          {/* Mobile: tall poster; desktop: wide backdrop */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={it.poster} alt="" className="absolute inset-0 h-full w-full object-cover md:hidden" fetchPriority={idx === 0 ? "high" : "auto"} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={it.backdrop}
            alt=""
            className={clsx("absolute inset-0 hidden h-full w-full object-cover md:block", idx === i && "motion-safe:animate-[float-glow_24s_ease-in-out_infinite]")}
          />
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-bg/10" />
      <div className="absolute inset-0 hidden bg-gradient-to-r from-bg/95 via-bg/40 to-transparent md:block" />

      <div key={s.id} className="animate-fade-up absolute inset-x-0 bottom-0 px-4 pb-10 md:bottom-[12%] md:max-w-[min(720px,55vw)] md:px-10 md:pb-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <AiChip label={t.home.aiBadge} />
          {s.aiModels.slice(0, 2).map((m) => (
            <AiChip key={m} label={m} className="hidden sm:inline-flex" />
          ))}
        </div>
        <h1 className="font-display text-[34px] font-bold leading-[1.05] tracking-tight drop-shadow-lg md:text-[60px]">{s.title}</h1>
        <p className="mt-3 line-clamp-2 max-w-xl text-[15px] text-white/80 md:mt-4 md:text-lg">{s.tagline}</p>
        <p className="mt-3 text-sm text-white/55">
          {s.ageRating} · {s.episodes} {plural(s.episodes, t.common.episodes, locale)} · {s.genres.slice(0, 3).map((g) => t.genres[g as keyof typeof t.genres] ?? g).join(" · ")}
        </p>
        <div className="mt-6 flex gap-3">
          <Link href={`/series/${s.slug}/play`} className={btn("primary", "lg")}>
            <Play size={20} fill="currentColor" /> {t.home.play}
          </Link>
          <Link href={`/series/${s.slug}`} className={btn("glass", "lg")}>
            <Info size={20} /> {t.home.moreInfo}
          </Link>
        </div>
      </div>

      {items.length > 1 && (
        <div className="absolute bottom-4 right-4 flex gap-1.5 md:bottom-[12%] md:right-10">
          {items.map((it, idx) => (
            <button
              key={it.id}
              aria-label={`${idx + 1}`}
              onClick={() => setI(idx)}
              className={clsx("h-1.5 rounded-full transition-all", idx === i ? "w-6 bg-white" : "w-1.5 bg-white/35 hover:bg-white/60")}
            />
          ))}
        </div>
      )}
    </section>
  );
}
