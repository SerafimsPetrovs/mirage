import type { Metadata } from "next";
import { Coins } from "lucide-react";
import { prisma } from "@/lib/db";
import { OPEN_PAYOUT, PAYOUT_CURRENCY } from "@/lib/payout-rules";
import { getI18n } from "@/i18n/server";
import { fmt, formatDate, formatMoney, formatNumber } from "@/i18n/shared";
import { Avatar } from "@/components/ui/misc";
import { StatusBadge } from "@/components/studio/status-badge";
import { PayoutAdminActions } from "@/components/admin/payout-actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.payouts.adminTitle };
}

export default async function AdminPayoutsPage() {
  const { t, locale } = await getI18n();
  const [open, done] = await Promise.all([
    prisma.payout.findMany({ where: { status: { in: OPEN_PAYOUT } }, orderBy: { createdAt: "asc" }, include: { user: { select: { name: true, email: true, avatarHue: true } } } }),
    prisma.payout.findMany({
      where: { status: { notIn: OPEN_PAYOUT } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { user: { select: { name: true, email: true, avatarHue: true } } },
    }),
  ]);
  const money = (cents: number, cur = PAYOUT_CURRENCY) => formatMoney(cents / 100, cur, locale);
  const status = (s: string) => t.payouts.status[s as keyof typeof t.payouts.status] ?? s;
  const method = (m: string) => t.payouts.methods[m as keyof typeof t.payouts.methods] ?? m;

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-4 font-display text-xl font-semibold">
          {t.payouts.adminOpen} <span className="text-muted">· {open.length}</span>
        </h2>
        {open.length === 0 ? (
          <p className="rounded-3xl bg-surface p-6 text-sm text-muted ring-1 ring-line">{t.payouts.adminEmpty}</p>
        ) : (
          <div className="space-y-3">
            {open.map((p) => (
              <div key={p.id} className="rounded-3xl bg-surface p-4 ring-1 ring-line md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={p.user.name} hue={p.user.avatarHue} size={40} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{p.user.name}</p>
                      <p className="truncate text-xs text-muted">{p.user.email} · {formatDate(p.createdAt, locale)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-2xl font-bold tabular-nums text-coin">{money(p.amountCents, p.currency)}</p>
                    <p className="text-xs text-muted tabular-nums"><Coins size={13} className="inline -mt-0.5 text-coin" aria-hidden /> {formatNumber(p.coins, locale)}</p>
                  </div>
                </div>
                <dl className="mt-4 grid gap-2 rounded-2xl bg-surface-2 p-3 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
                  <dt className="text-muted">{t.payouts.method}</dt>
                  <dd>{method(p.method)}</dd>
                  <dt className="text-muted">{p.method === "IBAN" ? t.payouts.detailsIBAN : t.payouts.detailsPAYPAL}</dt>
                  <dd className="break-all font-mono">{p.details}</dd>
                  <dt className="text-muted">{t.payouts.holder}</dt>
                  <dd>{p.holderName}</dd>
                </dl>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <StatusBadge status={p.status} label={status(p.status)} />
                  <PayoutAdminActions id={p.id} status={p.status} details={p.details} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 font-display text-xl font-semibold">{t.payouts.adminDone}</h2>
        {done.length === 0 ? (
          <p className="text-sm text-muted">{t.payouts.empty}</p>
        ) : (
          <ul className="divide-y divide-line rounded-3xl bg-surface px-4 ring-1 ring-line">
            {done.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.user.name}</p>
                  <p className="truncate text-xs text-muted">
                    {formatDate(p.createdAt, locale)} · {method(p.method)}
                    {p.adminNote && <> · {fmt(t.payouts.note, { note: p.adminNote })}</>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums">{money(p.amountCents, p.currency)}</span>
                  <StatusBadge status={p.status} label={status(p.status)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
