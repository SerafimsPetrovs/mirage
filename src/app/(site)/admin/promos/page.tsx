import type { Metadata } from "next";
import clsx from "clsx";
import { prisma } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { fmt, formatDate, formatNumber } from "@/i18n/shared";
import { PromoCreateForm, PromoRowActions } from "@/components/admin/promo-admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.promo.adminTitle };
}

export default async function AdminPromosPage() {
  const { t, locale } = await getI18n();
  const promos = await prisma.promoCode.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const now = new Date();

  return (
    <div className="space-y-8">
      <PromoCreateForm />
      {promos.length === 0 ? (
        <p className="rounded-3xl bg-surface p-6 text-sm text-muted ring-1 ring-line">{t.promo.empty}</p>
      ) : (
        <ul className="divide-y divide-line rounded-3xl bg-surface px-4 ring-1 ring-line md:px-5">
          {promos.map((p) => {
            const expired = !!p.expiresAt && p.expiresAt < now;
            const exhausted = p.maxUses !== null && p.usesCount >= p.maxUses;
            const live = p.active && !expired && !exhausted;
            return (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-base font-semibold tracking-wider">{p.code}</span>
                    <span className={clsx("rounded-full px-2 py-0.5 text-xs font-semibold", live ? "bg-ok/15 text-ok" : "bg-white/8 text-muted")}>
                      {expired ? t.promo.expired : p.active ? t.promo.on : t.promo.off}
                    </span>
                    <span className="rounded-full bg-coin/15 px-2 py-0.5 text-xs font-semibold text-coin">
                      {fmt(t.promo.reward[p.kind as "COINS" | "VIP_DAYS"], { n: p.value })}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {t.promo.uses}: {formatNumber(p.usesCount, locale)} / {p.maxUses === null ? t.promo.unlimited : formatNumber(p.maxUses, locale)}
                    {" · "}
                    {p.expiresAt ? `${t.promo.expires} ${formatDate(p.expiresAt, locale)}` : t.promo.never}
                    {p.newUsersOnly && ` · ${t.promo.newUsersOnly.split(" (")[0]}`}
                    {p.note && ` · ${p.note}`}
                  </p>
                </div>
                <PromoRowActions id={p.id} code={p.code} active={p.active} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
