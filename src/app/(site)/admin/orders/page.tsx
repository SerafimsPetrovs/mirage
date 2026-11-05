import Link from "next/link";
import { prisma } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { formatMoney } from "@/i18n/shared";
import { FulfillOrderButton } from "@/components/admin/admin-tools";

export default async function AdminOrdersPage() {
  const { t, locale } = await getI18n();
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  const df = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  if (!orders.length) return <p className="rounded-3xl bg-surface p-6 text-sm text-muted ring-1 ring-line">{t.adm.empty}</p>;
  return (
    <ul className="divide-y divide-line rounded-3xl bg-surface px-4 ring-1 ring-line md:px-5">
      {orders.map((o) => (
        <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {o.sku} · <span className="tabular-nums">{formatMoney(o.amountCents / 100, o.currency, locale)}</span>
            </p>
            <p className="truncate text-xs text-muted">
              <Link href={`/admin/users/${o.user.id}`} className="hover:text-text">{o.user.name} · {o.user.email}</Link> · {df.format(o.createdAt)} · {o.provider}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${o.status === "PAID" ? "bg-ok/15 text-ok" : o.status === "FAILED" ? "bg-red-500/15 text-red-300" : "bg-coin/15 text-coin"}`}>
              {t.adm.orderStatus[o.status]}
            </span>
            {o.status === "PENDING" && <FulfillOrderButton orderId={o.id} />}
          </div>
        </li>
      ))}
    </ul>
  );
}
