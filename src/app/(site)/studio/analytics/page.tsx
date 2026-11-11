import type { Metadata } from "next";
import Link from "next/link";
import { MousePointerClick, Radio, Tv, Upload } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { fmt, formatNumber } from "@/i18n/shared";
import { creatorAnalytics } from "@/lib/studio-hub";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.v3.studio.analytics.title };
}

/** TV views, live → series funnel clicks, income by source (skins, loot, private scenes…). */
export default async function AnalyticsPage() {
  const [{ t, locale }, user] = await Promise.all([getI18n(), requireUser("/studio/analytics")]);
  const a = t.v3.studio.analytics;
  const d = await creatorAnalytics(user, locale, 30);
  const tiles = [
    { label: a.tvPlays, value: d.tvPlays, icon: <Tv size={18} className="text-[#7dffb2]" /> },
    { label: a.airings, value: d.airings, icon: <Radio size={18} className="text-accent" /> },
    { label: a.clicks, value: d.funnelClicks, icon: <MousePointerClick size={18} className="text-coin" /> },
    { label: a.clips, value: d.clipCount, icon: <Upload size={18} className="text-sky-300" /> },
  ];
  const max = Math.max(1, ...d.bySource.map((s) => s.coins + s.credits));
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold">{a.title}</h1>
        <p className="mt-2 text-muted">{fmt(a.sub, { d: d.days })}</p>
      </header>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((x) => (
          <div key={x.label} className="rounded-3xl bg-surface p-5 ring-1 ring-line">
            <div className="flex items-center gap-2 text-sm text-muted">
              {x.icon} <span className="line-clamp-2">{x.label}</span>
            </div>
            <div className="mt-2 font-display text-3xl font-bold tabular-nums">{formatNumber(x.value, locale)}</div>
          </div>
        ))}
      </div>

      <section className="rounded-3xl bg-surface p-5 ring-1 ring-line md:p-6">
        <h2 className="font-display text-lg font-bold">{a.sources}</h2>
        {!d.bySource.length ? (
          <p className="mt-3 text-sm text-muted">{a.noMoney}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {d.bySource.map((s) => (
              <li key={s.source}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="font-medium">{a.sourceNames[s.source] ?? s.source}</span>
                  <span className="text-muted tabular-nums">
                    <span className="font-semibold text-coin">{s.coins}</span> {a.coins} · {s.credits} {a.credits}
                  </span>
                </div>
                <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-white/8">
                  <div className="h-full bg-coin" style={{ width: (s.coins / max) * 100 + "%" }} />
                  <div className="h-full bg-vip/70" style={{ width: (s.credits / max) * 100 + "%" }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {d.series.length > 0 && (
        <section className="overflow-x-auto rounded-3xl bg-surface ring-1 ring-line">
          <h2 className="px-5 pt-5 font-display text-lg font-bold md:px-6">{a.perSeries}</h2>
          <table className="mt-3 w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-2 font-semibold md:px-6">{a.series}</th>
                <th className="px-3 py-2 text-right font-semibold">{a.views}</th>
                <th className="px-3 py-2 text-right font-semibold">{a.clicks}</th>
                <th className="px-5 py-2 text-right font-semibold md:px-6">
                  {a.coins} / {a.credits}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d.series.map((s) => (
                <tr key={s.id}>
                  <td className="px-5 py-2.5 md:px-6">
                    <Link href={"/series/" + s.slug} className="font-medium hover:underline">
                      {s.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(s.views, locale)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{s.clicks}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums md:px-6">
                    <span className="text-coin">{s.coins}</span> / {s.credits}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
