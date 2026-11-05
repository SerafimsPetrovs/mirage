import type { Metadata } from "next";
import clsx from "clsx";
import { ArrowDownLeft, ArrowUpRight, Coins, Info, Receipt } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getCheckInState } from "@/lib/coins";
import { COIN_PACKS, CURRENCY } from "@/lib/payments/catalog";
import { getI18n } from "@/i18n/server";
import { fmt, formatMoney, pick } from "@/i18n/shared";
import { CoinAmount, EmptyState } from "@/components/ui/misc";
import { BuyButton } from "@/components/wallet/buy-button";
import { CheckInWidget } from "@/components/wallet/checkin-widget";
import { PromoForm } from "@/components/wallet/promo-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.wallet.title };
}

export default async function WalletPage({ searchParams }: { searchParams: Promise<{ next?: string; promo?: string }> }) {
  const { next, promo } = await searchParams;
  const user = await requireUser("/me/wallet");
  const { t, locale } = await getI18n();
  const [txs, checkIn] = await Promise.all([
    prisma.coinTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { episode: { select: { number: true, series: { select: { titleRu: true, titleEn: true } } } } },
    }),
    getCheckInState(user.id),
  ]);
  const mockMode = process.env.NODE_ENV !== "production" || process.env.ALLOW_MOCK_PAYMENTS === "1";
  const df = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-[calc(var(--header-h)+24px)] md:px-10">
      <h1 className="font-display text-3xl font-bold">{t.wallet.title}</h1>

      <div
        className="grain mt-6 overflow-hidden rounded-[28px] p-6 ring-1 ring-line md:p-8"
        style={{ background: "radial-gradient(90% 140% at 100% 0%, rgba(255,200,61,.28), transparent 55%), radial-gradient(70% 120% at 0% 100%, rgba(255,46,99,.22), transparent 60%), var(--surface)" }}
      >
        <p className="relative text-sm text-muted">{t.wallet.balance}</p>
        <p className="relative mt-1 flex items-center gap-3 font-display text-5xl font-bold tabular-nums">
          <Coins size={40} className="text-coin" /> {user.coins}
        </p>
        <div className="relative mt-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-black/25 px-3 py-1.5 ring-1 ring-white/10">
            {t.wallet.paidCoins}: <b className="tabular-nums text-coin">{user.paidCoins}</b>
          </span>
          <span className="rounded-full bg-black/25 px-3 py-1.5 ring-1 ring-white/10">
            {t.wallet.bonusCoins}: <b className="tabular-nums text-ok">{user.bonusCoins}</b>
          </span>
          <span className="self-center text-xs text-muted">{t.wallet.splitNote}</span>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <CheckInWidget state={checkIn} compact />
        <PromoForm initial={promo?.slice(0, 32) ?? ""} />
      </div>

      <h2 className="mb-4 mt-10 font-display text-xl font-semibold">{t.wallet.buy}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {COIN_PACKS.map((p) => {
          const price = formatMoney(p.eur, CURRENCY, locale);
          return (
            <div
              key={p.sku}
              className={clsx("relative flex flex-col rounded-3xl bg-surface p-4 ring-1 md:p-5", p.badge ? "ring-coin/40" : "ring-line")}
            >
              {p.badge && (
                <span className="absolute -top-2.5 left-4 rounded-full bg-coin px-2.5 py-0.5 text-[11px] font-bold text-black">
                  {p.badge === "popular" ? t.wallet.popular : t.wallet.best}
                </span>
              )}
              <CoinAmount value={p.coins} size={22} className="font-display text-2xl" />
              <p className="mt-1 h-5 text-sm font-semibold text-ok">{p.bonus > 0 && fmt(t.wallet.bonus, { n: p.bonus })}</p>
              <div className="mt-4 flex-1" />
              <BuyButton sku={p.sku} label={price} successText={t.wallet.paid} next={next} className="w-full" variant={p.badge ? "coin" : "glass"} />
            </div>
          );
        })}
      </div>
      {mockMode && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
          <Info size={14} /> {t.wallet.mockNote}
        </p>
      )}

      <h2 className="mb-4 mt-12 font-display text-xl font-semibold">{t.wallet.history}</h2>
      {txs.length === 0 ? (
        <EmptyState icon={<Receipt size={24} />} title={t.wallet.empty} />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
          {txs.map((tx) => (
            <div key={tx.id} className="flex items-center gap-4 px-4 py-3.5 md:px-5">
              <span className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", tx.amount > 0 ? "bg-ok/12 text-ok" : "bg-white/6 text-muted")}>
                {tx.amount > 0 ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">
                  {{ ...t.wallet.reasons, ...t.wallet.extraReasons }[tx.reason]}
                  {tx.note && tx.reason === "POLL_BOOST" && <span className="text-muted"> {tx.note}</span>}
                  {tx.episode && <span className="text-muted"> · {pick(tx.episode.series, "title", locale)}, {tx.episode.number}</span>}
                </p>
                <p className="text-xs text-muted">{df.format(tx.createdAt)}</p>
              </div>
              <span className={clsx("font-semibold tabular-nums", tx.amount > 0 ? "text-ok" : "text-text")}>
                {tx.amount > 0 ? "+" : ""}
                {tx.amount}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
