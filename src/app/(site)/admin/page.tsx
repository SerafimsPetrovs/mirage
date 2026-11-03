import type { Metadata } from "next";
import { Clock, Crown, Film, Receipt, Unlock, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { formatMoney, formatNumber, pick } from "@/i18n/shared";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.title };
}

export default async function AdminOverview() {
  const { t, locale } = await getI18n();
  const [users, series, pending, unlocks, vip, revenue, topSeries, recentOrders] = await Promise.all([
    prisma.user.count(),
    prisma.series.count({ where: { status: "PUBLISHED" } }),
    prisma.series.count({ where: { status: "PENDING" } }),
    prisma.unlock.count(),
    prisma.subscription.count({ where: { status: "ACTIVE", currentPeriodEnd: { gt: new Date() } } }),
    prisma.order.groupBy({ by: ["currency"], where: { status: "PAID" }, _sum: { amountCents: true } }),
    prisma.series.findMany({ where: { status: "PUBLISHED" }, orderBy: { views: "desc" }, take: 5 }),
    prisma.order.findMany({ where: { status: "PAID" }, orderBy: { paidAt: "desc" }, take: 8, include: { user: { select: { email: true } } } }),
  ]);
  const revenueText = revenue.length ? revenue.map((r) => formatMoney((r._sum.amountCents ?? 0) / 100, r.currency, locale)).join(" + ") : "—";

  const cards = [
    { label: t.admin.metrics.users, value: formatNumber(users, locale), icon: Users },
    { label: t.admin.metrics.series, value: formatNumber(series, locale), icon: Film },
    { label: t.admin.metrics.pending, value: pending, icon: Clock },
    { label: t.admin.metrics.unlocks, value: formatNumber(unlocks, locale), icon: Unlock },
    { label: t.admin.metrics.vip, value: vip, icon: Crown },
    { label: t.admin.metrics.revenue, value: revenueText, icon: Receipt },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-3xl bg-surface p-4 ring-1 ring-line md:p-5">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Icon size={16} /> {label}
            </div>
            <p className="mt-2 truncate font-display text-2xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl bg-surface p-5 ring-1 ring-line">
          <h2 className="mb-4 font-display font-semibold">{t.home.top10}</h2>
          <ol className="space-y-3">
            {topSeries.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 text-sm">
                <span className="w-5 font-display font-bold text-muted">{i + 1}</span>
                <span className="flex-1 truncate">{pick(s, "title", locale)}</span>
                <span className="tabular-nums text-muted">{formatNumber(s.views, locale)}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-3xl bg-surface p-5 ring-1 ring-line">
          <h2 className="mb-4 font-display font-semibold">{t.admin.metrics.revenue}</h2>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted">—</p>
          ) : (
            <ul className="space-y-3">
              {recentOrders.map((o) => (
                <li key={o.id} className="flex items-center gap-3 text-sm">
                  <span className="flex-1 truncate text-muted">{o.user.email}</span>
                  <span className="rounded-md bg-white/6 px-1.5 py-0.5 text-xs">{o.sku}</span>
                  <span className="tabular-nums">{formatMoney(o.amountCents / 100, o.currency, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
