"use client";
import clsx from "clsx";
import { useI18n } from "@/i18n/client";
import { DynamicMascotPlayer } from "@/components/mascot/dynamic-mascot-player";

/** The mascot announces creator alerts (hot bounties) — angry-hyped when it's urgent, calm otherwise. */
export function MascotAlert({ hot, title, text }: { hot: boolean; title: string; text: string }) {
  const { t, locale } = useI18n();
  return (
    <div className={clsx("flex items-center gap-4 overflow-hidden rounded-3xl p-4 ring-1 md:gap-6 md:p-5", hot ? "bg-[radial-gradient(90%_140%_at_0%_50%,rgba(255,59,59,.28),transparent_60%),var(--surface)] ring-[#ff3b3b]/40" : "bg-surface ring-line")}>
      <div className="h-28 w-24 shrink-0 md:h-32 md:w-28">
        <DynamicMascotPlayer variant="badge" emotion={hot ? "ANGRY_RAGE" : "IDLE"} locale={locale} captions={false} className="h-full w-full" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[.16em] text-muted">
          {t.v3.mascot.name} · {t.v3.mascot.role}
        </div>
        <p className={clsx("mt-1 font-display text-lg font-bold leading-snug md:text-xl", hot && "text-[#ff8a8a]")}>{title}</p>
        {text && <p className="mt-1 text-sm text-muted">{text}</p>}
      </div>
    </div>
  );
}
