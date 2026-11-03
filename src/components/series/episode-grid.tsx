import Link from "next/link";
import clsx from "clsx";
import { Lock, Play } from "lucide-react";
import type { EpisodeItem } from "@/lib/series";
import type { Dict } from "@/i18n/ru";
import { CoinAmount } from "@/components/ui/misc";

function dur(sec: number, t: Dict) {
  return sec >= 600 ? `${Math.round(sec / 60)} ${t.common.min}` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/** Numbered tile grid for short dramas (fast to scan through 40+ episodes). */
export function EpisodeNumberGrid({ episodes, currentId, t }: { episodes: EpisodeItem[]; currentId?: string; t: Dict }) {
  return (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
      {episodes.map((e) => (
        <Link
          key={e.id}
          href={`/watch/${e.id}`}
          aria-label={`${t.common.episode} ${e.number}${e.locked ? ` · ${t.series.locked}` : ""}`}
          className={clsx(
            "relative flex aspect-square items-center justify-center overflow-hidden rounded-xl text-[15px] font-semibold tabular-nums ring-1 transition",
            e.id === currentId ? "bg-accent text-white ring-accent" : "bg-surface-2 ring-line hover:bg-surface-3 hover:ring-white/20",
            e.locked && e.id !== currentId && "text-muted",
          )}
        >
          {e.number}
          {e.locked && <Lock size={11} className="absolute right-1.5 top-1.5 text-coin" />}
          {e.progress > 0 && (
            <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
              <span className="block h-full bg-accent" style={{ width: `${e.progress * 100}%` }} />
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

/** Rich list for widescreen series. */
export function EpisodeList({ episodes, backdrop, t }: { episodes: EpisodeItem[]; backdrop: string; t: Dict }) {
  return (
    <div className="space-y-3">
      {episodes.map((e) => (
        <Link key={e.id} href={`/watch/${e.id}`} className="group flex gap-4 rounded-2xl p-2 transition hover:bg-surface-2 md:p-3">
          <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-xl bg-surface-2 md:w-56">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={e.thumbnail ?? backdrop} alt="" loading="lazy" className="h-full w-full object-cover" style={{ objectPosition: `${(e.number * 13) % 100}% 50%` }} />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
              {e.locked ? <Lock size={22} /> : <Play size={22} fill="currentColor" />}
            </div>
            {e.progress > 0 && (
              <span className="absolute inset-x-0 bottom-0 h-1 bg-white/15">
                <span className="block h-full bg-accent" style={{ width: `${e.progress * 100}%` }} />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1 py-1">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold">
                <span className="text-muted">{e.number}.</span> {e.title}
              </p>
              <span className="shrink-0 text-sm text-muted">{dur(e.durationSec, t)}</span>
            </div>
            <div className="mt-2 text-sm">
              {e.locked ? (
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <Lock size={14} /> <CoinAmount value={e.price} size={14} />
                </span>
              ) : e.free ? (
                <span className="text-ok">{t.common.free}</span>
              ) : null}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
