import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Banknote, CheckCircle2, Coins, Wallet } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { VerifyEmailBanner } from "@/components/auth/verify-banner";
import { getPayoutOverview } from "@/lib/payouts";
import { maskDetails, PAYOUT_CURRENCY, PAYOUT_MIN_COINS, payoutCents } from "@/lib/payout-rules";
import { getI18n } from "@/i18n/server";
import { fmt, formatDate, formatMoney, formatNumber } from "@/i18n/shared";
import { PayoutForm, CancelPayoutButton } from "@/components/studio/payout-form";
import { StatusBadge as PayoutStatusBadge } from "@/components/studio/status-badge";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.payouts.title };
}

export default async function PayoutsPage() {
  const user = await requireRole(["CREATOR", "ADMIN"], "/studio/payouts");
  const { t, locale } = await getI18n();
  const o = await getPayoutOverview(user.id);
  const money = (cents: number) => formatMoney(cents / 100, PAYOUT_CURRENCY, locale);

  const stats = [
    { label: t.payouts.available, value: formatNumber(o.available, locale), sub: fmt(t.payouts.approx, { money: money(payoutCents(o.available)) }), icon: Wallet, coin: true },
    { label: t.payouts.earned, value: formatNumber(o.earnedCoins, locale), sub: null, icon: Coins },
    { label: t.payouts.paidOut, value: money(o.paidCents), sub: null, icon: CheckCircle2 },
  ];

  return (
    <div>
      <Link href="/studio" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} /> {t.studio.title}
      </Link>
      <h1 className="font-display text-3xl font-bold">{t.payouts.title}</h1>
      <p className="mt-1 max-w-2xl text-muted">{t.payouts.sub}</p>
      {!user.emailVerifiedAt && <VerifyEmailBanner email={user.email} className="mt-4" />}

      <div className="mt-8 grid gap-3 sm:grid-cols-3 md:gap-4">
        {stats.map(({ label, value, sub, icon: Icon, coin }) => (
          <div key={label} className="rounded-3xl bg-surface p-5 ring-1 ring-line">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Icon size={16} className={coin ? "text-coin" : ""} /> {label}
            </div>
            <p className={`mt-2 font-display text-3xl font-bold tabular-nums ${coin ? "text-coin" : ""}`}>{value}</p>
            {sub && <p className="mt-1 text-sm text-muted tabular-nums">{sub}</p>}
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="rounded-3xl bg-surface p-5 ring-1 ring-line md:p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Banknote size={20} className="text-coin" /> {t.payouts.newRequest}
          </h2>
          <p className="mt-1 text-xs text-muted">
            {fmt(t.payouts.rate, { money: money(payoutCents(1000)), min: formatNumber(PAYOUT_MIN_COINS, locale) })}
          </p>
          <div className="mt-5">
            {o.open ? (
              <div className="rounded-2xl bg-white/5 p-4 text-sm ring-1 ring-line">
                <p>{t.payouts.openExists}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <PayoutStatusBadge status={o.open.status} label={t.payouts.status[o.open.status as keyof typeof t.payouts.status]} />
                  <span className="font-semibold tabular-nums">{money(o.open.amountCents)}</span>
                  {o.open.status === "PENDING" && <CancelPayoutButton id={o.open.id} />}
                </div>
              </div>
            ) : o.available < PAYOUT_MIN_COINS ? (
              <p className="rounded-2xl bg-white/5 p-4 text-sm text-muted ring-1 ring-line">
                {fmt(t.payouts.notEnough, { min: formatNumber(PAYOUT_MIN_COINS, locale), have: formatNumber(o.available, locale) })}
              </p>
            ) : (
              <PayoutForm available={o.available} />
            )}
          </div>
        </section>

        <section className="rounded-3xl bg-surface p-5 ring-1 ring-line md:p-6">
          <h2 className="font-display text-lg font-semibold">{t.payouts.history}</h2>
          {o.payouts.length === 0 ? (
            <p className="mt-6 text-sm text-muted">{t.payouts.empty}</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {o.payouts.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold tabular-nums">
                      {money(p.amountCents)} <span className="text-sm font-normal text-muted">· <Coins size={13} className="inline -mt-0.5 text-coin" aria-hidden /> {formatNumber(p.coins, locale)}</span>
                    </p>
                    <p className="truncate text-xs text-muted">
                      {formatDate(p.createdAt, locale)} · {t.payouts.methods[p.method as keyof typeof t.payouts.methods]} · {maskDetails(p.method, p.details)}
                    </p>
                    {p.adminNote && <p className="mt-1 text-xs text-white/70">{fmt(t.payouts.note, { note: p.adminNote })}</p>}
                  </div>
                  <PayoutStatusBadge status={p.status} label={t.payouts.status[p.status as keyof typeof t.payouts.status]} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
