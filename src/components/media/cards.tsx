import Link from "next/link";
import clsx from "clsx";
import { Play } from "lucide-react";
import type { ContinueItem, SeriesCard } from "@/lib/catalog";
import type { Dict } from "@/i18n/ru";
import { formatNumber, plural, type Locale } from "@/i18n/shared";

/** Marks 18+ (NSFW) series — they only appear for viewers who turned 18+ content on. */
function AdultChip({ className }: { className?: string }) {
  return <span className={clsx("rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-accent ring-1 ring-accent/60", className)}>18+</span>;
}

type CardProps = { s: SeriesCard; t: Dict; locale: Locale; className?: string; priority?: boolean };

/** 9:16 poster card for short dramas. */
export function PosterCard({ s, t, locale, className, priority }: CardProps) {
  return (
    <Link href={`/series/${s.slug}`} className={clsx("group block shrink-0", className)}>
      <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-line transition duration-300 ease-out md:group-hover:-translate-y-1 md:group-hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,.9)] md:group-hover:ring-white/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={s.poster}
          alt=""
          data-vt={`poster-${s.slug}`}
          loading={priority ? "eager" : "lazy"}
          className="absolute inset-0 h-full w-full object-cover transition duration-500 md:group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
        <div className="absolute left-2 top-2 flex gap-1">
          {s.isNew && <span className="rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">New</span>}
          {s.isAdult && <AdultChip />}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="line-clamp-2 font-display text-[13px] font-semibold leading-snug md:text-[15px]">{s.title}</h3>
          <p className="mt-1 text-[11px] text-white/60">
            {s.episodes} {plural(s.episodes, t.common.episodes, locale)} · {formatNumber(s.views, locale)}
          </p>
        </div>
        <div className="absolute inset-0 hidden items-center justify-center opacity-0 transition md:flex md:group-hover:opacity-100">
          <span className="glass flex h-12 w-12 items-center justify-center rounded-full">
            <Play size={20} fill="currentColor" />
          </span>
        </div>
      </div>
    </Link>
  );
}

/** 16:9 card for widescreen series. */
export function WideCard({ s, t, locale, className }: CardProps) {
  return (
    <Link href={`/series/${s.slug}`} className={clsx("group block shrink-0", className)}>
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-line transition duration-300 md:group-hover:-translate-y-1 md:group-hover:ring-white/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={s.backdrop} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 md:group-hover:scale-[1.04]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        {s.isAdult && <AdultChip className="absolute left-2 top-2" />}
        <div className="absolute inset-x-0 bottom-0 p-3 md:p-4">
          <h3 className="line-clamp-1 font-display text-sm font-semibold md:text-base">{s.title}</h3>
          <p className="mt-0.5 line-clamp-1 text-xs text-white/60">
            {s.episodes} {plural(s.episodes, t.common.episodes, locale)} · {s.genres.slice(0, 2).map((g) => t.genres[g as keyof Dict["genres"]] ?? g).join(" · ")}
          </p>
        </div>
      </div>
    </Link>
  );
}

export function SeriesCardAuto(props: CardProps) {
  return props.s.orientation === "VERTICAL" ? <PosterCard {...props} /> : <WideCard {...props} />;
}

export function Top10Card({ s, rank, t, locale }: CardProps & { rank: number }) {
  return (
    <Link href={`/series/${s.slug}`} className="group relative flex shrink-0 items-end">
      <span
        className="pointer-events-none -mr-5 select-none font-display text-[110px] font-bold leading-[0.8] text-transparent md:-mr-7 md:text-[150px]"
        style={{ WebkitTextStroke: "2px rgba(255,255,255,.28)" }}
        aria-hidden
      >
        {rank}
      </span>
      <div className="relative w-[118px] md:w-[150px]">
        <div className="relative aspect-[9/16] overflow-hidden rounded-2xl ring-1 ring-line transition duration-300 md:group-hover:-translate-y-1 md:group-hover:ring-white/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.poster} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
          <h3 className="absolute inset-x-0 bottom-0 line-clamp-2 p-2.5 font-display text-[12px] font-semibold leading-snug">{s.title}</h3>
        </div>
        <span className="sr-only">
          #{rank} · {formatNumber(s.views, locale)} {t.common.views}
        </span>
      </div>
    </Link>
  );
}

export function ContinueCard({ item, t }: { item: ContinueItem; t: Dict }) {
  return (
    <Link href={`/watch/${item.episodeId}`} className="group block w-[260px] shrink-0 md:w-[300px]">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.backdrop} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 md:group-hover:scale-[1.04]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
        <span className="glass absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition md:group-hover:scale-110">
          <Play size={20} fill="currentColor" />
        </span>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="line-clamp-1 font-display text-sm font-semibold">{item.title}</p>
          <p className="text-xs text-white/60">
            {t.common.episode} {item.episodeNumber}
          </p>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/15">
          <div className="h-full bg-accent" style={{ width: `${Math.max(4, item.progress * 100)}%` }} />
        </div>
      </div>
    </Link>
  );
}
