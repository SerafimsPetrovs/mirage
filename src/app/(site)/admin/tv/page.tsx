import Link from "next/link";
import { Coins, Eye, Gamepad2, HelpCircle, ListChecks, MessageCircle, Timer, Users } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { fmt, formatNumber, pick, plural } from "@/i18n/shared";
import { tvDashboard } from "@/lib/tv-admin";

export const dynamic = "force-dynamic";

/** MIRAGE TV at a glance: who is watching now, what TV earned, how viewers play along. */
export default async function AdminTvOverview() {
  const { t, locale } = await getI18n();
  const m = t.tv.adm2;
  const d = await tvDashboard();
  const card = "rounded-3xl bg-surface p-5 ring-1 ring-line";
  const totalCoins = d.revenue.reduce((a, r) => a + r.coins, 0);
  const maxViewers = Math.max(1, ...d.channels.map((c) => c.viewers));
  const act = [
    { k: "messages", icon: MessageCircle },
    { k: "votes", icon: ListChecks },
    { k: "answers", icon: HelpCircle },
    { k: "games", icon: Gamepad2 },
    { k: "watchers", icon: Users },
    { k: "watchMinutes", icon: Timer },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <section className={card}>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted">
            <Eye size={16} className="text-[#ff6b6b]" /> {m.viewersNow}
          </h2>
          <p className="tv-osd mt-2 text-6xl">{d.viewersTotal}</p>
          <ul className="mt-4 space-y-2">
            {d.channels
              .filter((c) => c.active)
              .map((c) => (
                <li key={c.id} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/tv/${c.slug}`} className="truncate hover:underline">
                      <span className="tv-osd mr-2">{String(c.number).padStart(2, "0")}</span>
                      {pick(c, "name", locale)}
                    </Link>
                    <span className="font-semibold">{c.viewers}</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/8">
                    <div className="h-full rounded-full bg-[#7dffb2]" style={{ width: `${(c.viewers / maxViewers) * 100}%` }} />
                  </div>
                </li>
              ))}
          </ul>
        </section>

        <section className={card}>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted">
            <Coins size={16} className="text-coin" /> {m.revenue7}
          </h2>
          <p className="mt-2 font-display text-4xl font-bold text-coin">{formatNumber(totalCoins, locale)}</p>
          <ul className="mt-4 space-y-3">
            {d.revenue.map((r) => (
              <li key={r.reason} className="text-sm">
                <div className="flex justify-between gap-2">
                  <span>
                    {m.revenueKinds[r.reason]} <span className="text-muted">× {r.count}</span>
                  </span>
                  <span className="font-semibold">{formatNumber(r.coins, locale)}</span>
                </div>
                <div className="text-xs text-muted">{fmt(m.paidPart, { n: formatNumber(r.paid, locale) })}</div>
              </li>
            ))}
          </ul>
          {d.refunded > 0 && <p className="mt-3 text-xs text-muted">{fmt(m.refunded, { n: d.refunded })}</p>}
        </section>

        <section className={card}>
          <h2 className="text-sm font-semibold text-muted">{m.activity}</h2>
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {act.map(({ k, icon: Icon }) => (
              <li key={k} className="rounded-2xl bg-surface-2 p-3">
                <Icon size={16} className="text-[#7dffb2]" />
                <div className="mt-1 font-display text-2xl font-bold">{formatNumber(d.activity[k], locale)}</div>
                <div className="text-[11px] leading-tight text-muted">{m.act[k]}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <section className={card}>
          <h2 className="text-sm font-semibold text-muted">{m.ordersBy}</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {(["GENERATING", "REVIEW", "APPROVED", "AIRED", "REJECTED", "FAILED"] as const).map((s) => (
              <li key={s} className="flex justify-between">
                <span>{t.tv.order.status[s]}</span>
                <span className="font-semibold">{d.orders[s] ?? 0}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className={card}>
          <h2 className="text-sm font-semibold text-muted">{m.topPlays}</h2>
          <ol className="mt-3 space-y-1.5 text-sm">
            {d.topPlays.map((c, i) => (
              <li key={c.id} className="flex justify-between gap-2">
                <span className="truncate">
                  <span className="tv-osd mr-1.5">{i + 1}</span>
                  {c.artist ? `${c.artist} — ${c.title}` : c.title}
                </span>
                <span className="shrink-0 text-muted">{`${c.plays} ${plural(c.plays, m.plays, locale)}`}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className={card}>
          <h2 className="text-sm font-semibold text-muted">{m.topLikes}</h2>
          <ol className="mt-3 space-y-1.5 text-sm">
            {d.topLikes.map((c, i) => (
              <li key={c.id} className="flex justify-between gap-2">
                <span className="truncate">
                  <span className="tv-osd mr-1.5">{i + 1}</span>
                  {c.artist ? `${c.artist} — ${c.title}` : c.title}
                </span>
                <span className="shrink-0 text-muted">{`${c.likes} ${plural(c.likes, m.likes, locale)}`}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
