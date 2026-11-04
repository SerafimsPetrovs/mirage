import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { Check, Crown, Info } from "lucide-react";
import { forbidInKidsMode, getCurrentUser, isVip } from "@/lib/auth";
import { CURRENCY, VIP_PLANS } from "@/lib/payments/catalog";
import { getI18n } from "@/i18n/server";
import { fmt, formatDate, formatMoney } from "@/i18n/shared";
import { btn } from "@/components/ui/button";
import { BuyButton } from "@/components/wallet/buy-button";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: "VIP", description: t.vip.sub };
}

export default async function VipPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  await forbidInKidsMode();
  const [{ t, locale }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  const vip = isVip(user);
  const names: Record<string, string> = { vip_week: t.vip.week, vip_month: t.vip.month, vip_year: t.vip.year };

  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[640px]"
        style={{ background: "radial-gradient(50% 60% at 50% 0%, rgba(124,92,255,.45), transparent 70%), radial-gradient(40% 50% at 85% 20%, rgba(255,46,99,.25), transparent 70%)" }}
      />
      <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-[calc(var(--header-h)+40px)] text-center md:px-10">
        <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-mirage shadow-[0_20px_60px_-15px_rgba(124,92,255,.8)]">
          <Crown size={30} />
        </span>
        <h1 className="font-display text-4xl font-bold md:text-6xl">
          <span className="text-mirage">{t.vip.title}</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-white/75">{t.vip.sub}</p>

        {vip && user?.subscription && (
          <p className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full bg-vip/15 px-4 py-2 text-sm font-semibold text-vip">
            <Crown size={16} /> {fmt(t.vip.activeUntil, { date: formatDate(user.subscription.currentPeriodEnd, locale) })}
          </p>
        )}

        <ul className="mx-auto mt-10 grid max-w-2xl gap-3 text-left sm:grid-cols-2">
          {t.vip.perks.map((p) => (
            <li key={p} className="flex items-center gap-3 rounded-2xl bg-surface/70 px-4 py-3 ring-1 ring-line">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-vip/15 text-vip">
                <Check size={16} />
              </span>
              {p}
            </li>
          ))}
        </ul>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {VIP_PLANS.map((p) => {
            const price = formatMoney(p.eur, CURRENCY, locale);
            const perDay = formatMoney(p.eur / p.days, CURRENCY, locale);
            const hl = p.badge === "popular";
            return (
              <div
                key={p.sku}
                className={clsx(
                  "relative flex flex-col rounded-[28px] p-6 text-left ring-1",
                  hl ? "bg-surface-2 ring-vip/50 shadow-[0_30px_80px_-30px_rgba(124,92,255,.8)] md:-translate-y-3" : "bg-surface ring-line",
                )}
              >
                {p.badge && (
                  <span className={clsx("absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-bold", hl ? "bg-mirage" : "bg-coin text-black")}>
                    {p.badge === "popular" ? t.wallet.popular : t.wallet.best}
                  </span>
                )}
                <p className="text-sm font-semibold text-muted">{names[p.sku]}</p>
                <p className="mt-2 font-display text-4xl font-bold">{price}</p>
                <p className="mt-1 text-sm text-muted">{fmt(t.vip.perDay, { price: perDay })}</p>
                <div className="mt-6 flex-1" />
                {user ? (
                  <BuyButton sku={p.sku} label={vip ? t.vip.extend : fmt(t.vip.choose, { price })} variant={hl ? "vip" : "glass"} successText={t.vip.success} next={next} className="w-full" />
                ) : (
                  <Link href="/register?next=/vip" className={btn(hl ? "vip" : "glass", "md", "w-full")}>
                    {fmt(t.vip.choose, { price })}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
        {(process.env.NODE_ENV !== "production" || process.env.ALLOW_MOCK_PAYMENTS === "1") && (
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted">
            <Info size={14} /> {t.wallet.mockNote}
          </p>
        )}
      </div>
    </div>
  );
}
