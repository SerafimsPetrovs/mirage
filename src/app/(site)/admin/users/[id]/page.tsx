import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser, isVip } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { fmt, formatDate, formatMoney, pick } from "@/i18n/shared";
import { Avatar, VipBadge } from "@/components/ui/misc";
import { UserControls } from "@/components/admin/admin-actions";
import { CoinsForm, CreditsForm, UserTools, VipForm } from "@/components/admin/admin-tools";

const box = "rounded-3xl bg-surface p-5 ring-1 ring-line";

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ t, locale }, me] = await Promise.all([getI18n(), getCurrentUser()]);
  const u = await prisma.user.findUnique({ where: { id }, include: { subscription: true } });
  if (!u) notFound();
  const [txs, orders, series, sessions] = await Promise.all([
    prisma.coinTransaction.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.order.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.series.findMany({ where: { creatorId: id }, select: { id: true, titleRu: true, titleEn: true, status: true } }),
    prisma.session.count({ where: { userId: id, expiresAt: { gt: new Date() } } }),
  ]);
  const vip = isVip(u);
  const reasons = { ...t.wallet.reasons, ...t.wallet.extraReasons } as Record<string, string>;
  const df = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const stats = [
    { label: t.adm.paid, value: u.paidCoins, cls: "text-coin" },
    { label: t.adm.bonus, value: u.bonusCoins, cls: "text-ok" },
    { label: t.adm.credits, value: u.genCredits, cls: "" },
    { label: t.adm.payout, value: u.payoutCoins, cls: "" },
  ];

  return (
    <div className="space-y-5">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} /> {t.adm.back}
      </Link>

      <div className={`${box} flex flex-col gap-4 md:flex-row md:items-center`}>
        <Avatar name={u.name} hue={u.avatarHue} size={56} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-display text-xl font-bold">
            {u.name} {vip && <VipBadge />}
            {u.banned && <span className="rounded bg-red-500/20 px-1.5 text-xs font-bold text-red-300">BAN</span>}
          </p>
          <p className="text-sm text-muted">{u.email}</p>
          <p className="mt-1 text-xs text-muted">
            {t.adm.registered}: {formatDate(u.createdAt, locale)} · {t.adm.sessions}: {sessions} · {t.adm.kidsPin}: {u.kidsPinHash ? t.adm.yes : t.adm.no} · {t.adm.adult}: {u.showAdult ? t.adm.yes : t.adm.no}
            {vip && u.subscription && <> · VIP {fmt(t.adm.vipUntil, { date: formatDate(u.subscription.currentPeriodEnd, locale) })}</>}
          </p>
        </div>
        <UserControls userId={u.id} role={u.role} banned={u.banned} self={u.id === me?.id} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={box}>
            <p className="text-xs text-muted">{s.label}</p>
            <p className={`mt-1 font-display text-2xl font-bold tabular-nums ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <CoinsForm userId={u.id} />
        <div className="space-y-5">
          <VipForm userId={u.id} active={vip} />
          <CreditsForm userId={u.id} credits={u.genCredits} />
        </div>
      </div>
      <UserTools userId={u.id} />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={box}>
          <h3 className="mb-3 font-display text-lg font-semibold">{t.adm.history}</h3>
          {txs.length === 0 ? (
            <p className="text-sm text-muted">{t.adm.empty}</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {txs.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate">{reasons[x.reason] ?? x.reason}{x.note ? ` · ${x.note}` : ""}</span>
                    <span className="text-xs text-muted">{df.format(x.createdAt)} · {t.adm.paid} {x.paid} / {t.adm.bonus} {x.bonus}</span>
                  </span>
                  <span className={`shrink-0 font-semibold tabular-nums ${x.amount > 0 ? "text-ok" : "text-red-300"}`}>{x.amount > 0 ? `+${x.amount}` : x.amount}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="space-y-5">
          <section className={box}>
            <h3 className="mb-3 font-display text-lg font-semibold">{t.adm.orders}</h3>
            {orders.length === 0 ? (
              <p className="text-sm text-muted">{t.adm.empty}</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {orders.map((o) => (
                  <li key={o.id} className="flex justify-between gap-3 py-2">
                    <span>{o.sku} · {df.format(o.createdAt)}</span>
                    <span className="tabular-nums">{formatMoney(o.amountCents / 100, o.currency, locale)} · {t.adm.orderStatus[o.status]}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {series.length > 0 && (
            <section className={box}>
              <h3 className="mb-3 font-display text-lg font-semibold">{t.adm.seriesOf}</h3>
              <ul className="space-y-1.5 text-sm">
                {series.map((s) => (
                  <li key={s.id}>
                    <Link href={`/admin/series/${s.id}`} className="hover:text-accent">{pick(s, "title", locale)}</Link>
                    <span className="text-muted"> · {t.studio.status[s.status]}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
