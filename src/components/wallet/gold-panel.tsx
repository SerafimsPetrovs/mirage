import clsx from "clsx";
import { CalendarCheck, Check, Gamepad2, Gem, HelpCircle, ListChecks, PlayCircle, Sparkles, Star, Tv, Vote } from "lucide-react";
import type { getGoldState } from "@/lib/gold";
import type { Dict } from "@/i18n/ru";
import { fmt } from "@/i18n/shared";

const ICON = { CHECKIN: CalendarCheck, WATCH: PlayCircle, VOTE: Vote, RATE: Star, TV_WATCH: Tv, TV_QUIZ: HelpCircle, TV_VOTE: ListChecks, TV_GAME: Gamepad2 } as const;

/** Wallet section: gold balance, today's ways to earn it (with progress) and what it's for. */
export function GoldPanel({ state, t, df }: { state: Awaited<ReturnType<typeof getGoldState>>; t: Dict; df: Intl.DateTimeFormat }) {
  return (
    <section id="gold" className="mt-10 scroll-mt-24">
      <div
        className="overflow-hidden rounded-[28px] p-6 ring-1 ring-line md:p-8"
        style={{ background: "radial-gradient(90% 140% at 100% 0%, rgba(252,211,77,.22), transparent 55%), var(--surface)" }}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted">{t.gold.title}</p>
            <p className="mt-1 flex items-center gap-3 font-display text-4xl font-bold tabular-nums text-amber-300">
              <Gem size={32} /> {state.gold}
            </p>
          </div>
          <p className="max-w-md text-sm text-muted">{t.gold.sub}</p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-semibold">{t.gold.tasks}</p>
            <ul className="space-y-2">
              {state.tasks.map((task) => {
                const Icon = ICON[task.reason];
                const full = task.done >= task.perDay;
                return (
                  <li key={task.reason} className="flex items-center gap-3 rounded-2xl bg-black/20 px-3.5 py-3 ring-1 ring-white/8">
                    <span className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", full ? "bg-ok/15 text-ok" : "bg-amber-300/12 text-amber-300")}>
                      {full ? <Check size={18} /> : <Icon size={18} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{t.gold.task[task.reason]}</span>
                      <span className="block text-xs text-muted">{fmt(t.gold.perTask, { n: task.amount })}</span>
                    </span>
                    <span className={clsx("text-sm tabular-nums", full ? "text-ok" : "text-muted")}>{fmt(t.gold.progress, { d: task.done, m: task.perDay })}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 flex gap-2 text-xs leading-relaxed text-muted">
              <Sparkles size={14} className="mt-0.5 shrink-0 text-amber-300" /> {t.gold.alsoWin}
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold">{t.gold.spendTitle}</p>
              <ul className="space-y-1.5 text-sm text-muted">
                {t.gold.spend.map((x) => (
                  <li key={x} className="flex gap-2"><Gem size={14} className="mt-1 shrink-0 text-amber-300" />{x}</li>
                ))}
              </ul>
            </div>
            {state.recent.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold">{t.gold.history}</p>
                <ul className="divide-y divide-white/6 rounded-2xl bg-black/20 ring-1 ring-white/8">
                  {state.recent.slice(0, 5).map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-3.5 py-2 text-sm">
                      <span className="min-w-0 truncate">
                        {t.gold.reasons[r.reason as keyof typeof t.gold.reasons] ?? r.reason}
                        <span className="ml-2 text-xs text-muted">{df.format(new Date(r.createdAt))}</span>
                      </span>
                      <span className={clsx("shrink-0 font-semibold tabular-nums", r.amount > 0 ? "text-ok" : "text-muted")}>
                        {r.amount > 0 ? `+${r.amount}` : r.amount}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
