import clsx from "clsx";
import { Heart } from "lucide-react";
import { tvAnalytics } from "@/lib/tv-analytics";
import { FOOD_SERVICES } from "@/lib/party-rules";
import { getI18n } from "@/i18n/server";
import { fmt, formatNumber, pick } from "@/i18n/shared";

export const dynamic = "force-dynamic";

/** Per-channel audience and engagement for the last 7 days + an hourly audience profile and top clips. */
export default async function AdminTvAnalytics() {
  const { t, locale } = await getI18n();
  const s = t.tvStats;
  const a = await tvAnalytics(7);
  const card = "rounded-3xl bg-surface p-5 ring-1 ring-line";
  const maxHour = Math.max(1, ...a.hourly);
  const hasData = a.channels.some((c) => c.minutes || c.messages || c.likes || c.peak);
  const cols = ["minutes", "peak", "messages", "likes", "funnel", "orders", "moments", "parties"] as const;
  const n = (v: number) => formatNumber(v, locale);

  return (
    <div className="space-y-6">
      <section className={card}>
        <h2 className="font-display text-lg font-semibold">{fmt(s.title, { n: a.days })}</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">{s.sub}</p>
        {!hasData && <p className="mt-4 rounded-2xl bg-white/[.03] p-4 text-sm text-muted">{s.empty}</p>}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-3 font-semibold">{s.channel}</th>
                {cols.map((c) => (
                  <th key={c} className="px-2 py-2 text-right font-semibold">{s[c]}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {a.channels.map((c) => (
                <tr key={c.id} className={clsx(!c.active && "text-muted")}>
                  <td className="py-2.5 pr-3">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: `hsl(${c.hue} 80% 60%)` }} aria-hidden />
                    <span className="font-mono text-xs text-muted">{c.number}</span> {pick(c, "name", locale)}
                    {!c.active && <span className="ml-1.5 text-xs">({s.off})</span>}
                  </td>
                  {cols.map((k) => (
                    <td key={k} className="px-2 py-2.5 text-right tabular-nums">{c[k] ? n(c[k]) : <span className="text-muted">—</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={card}>
        <h2 className="font-display text-lg font-semibold">{s.hourly}</h2>
        {/* one series → no legend; every bar has a hover/focus tooltip and an aria label */}
        <div className="mt-5 flex h-40 items-end gap-[2px]" role="img" aria-label={s.hourly}>
          {a.hourly.map((m, h) => (
            <div key={h} className="group relative flex h-full flex-1 items-end" tabIndex={0} aria-label={fmt(s.hourTip, { h, n: m })}>
              <div className="w-full rounded-t-[4px] bg-accent/80 transition group-hover:bg-accent group-focus:bg-accent" style={{ height: `${m ? Math.max(3, (m / maxHour) * 100) : 0}%` }} />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-black/90 px-2 py-1 text-xs text-white group-hover:block group-focus:block">
                {fmt(s.hourTip, { h, n: m })}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-[2px] text-[10px] text-muted">
          {a.hourly.map((_, h) => (
            <span key={h} className="flex-1 text-center">{h % 3 === 0 ? h : ""}</span>
          ))}
        </div>
      </section>

      <section className={card}>
        <h2 className="font-display text-lg font-semibold">{s.foodTitle}</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">{s.foodSub}</p>
        {a.food.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{s.empty}</p>
        ) : (
          <table className="mt-3 w-full max-w-md text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-1.5 font-semibold" />
                <th className="py-1.5 text-right font-semibold">{s.foodWeek}</th>
                <th className="py-1.5 text-right font-semibold">{s.foodMonth}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {a.food.map((f) => (
                <tr key={f.target}>
                  <td className="py-2">{FOOD_SERVICES[f.target as keyof typeof FOOD_SERVICES]?.name ?? f.target}</td>
                  <td className="py-2 text-right tabular-nums">{f.week}</td>
                  <td className="py-2 text-right tabular-nums">{f.month}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-sm text-muted">{fmt(s.foodRooms, { n: a.foodRooms })}</p>
      </section>

      <section className={card}>
        <h2 className="font-display text-lg font-semibold">{s.top}</h2>
        {a.topClips.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{s.empty}</p>
        ) : (
          <ol className="mt-3 divide-y divide-line">
            {a.topClips.map(({ clip, likes }, i) => (
              <li key={clip!.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-6 text-right font-mono text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{clip!.artist ? `${clip!.artist} — ` : ""}{clip!.title}</span>
                  <span className="text-muted"> · {pick(clip!.channel, "name", locale)}</span>
                </span>
                <span className="text-xs text-muted">{fmt(s.plays, { n: clip!.plays })}</span>
                <span className="flex items-center gap-1 tabular-nums"><Heart size={14} className="text-accent" /> {likes}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
