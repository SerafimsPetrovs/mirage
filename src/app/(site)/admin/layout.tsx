import Link from "next/link";
import { Clapperboard, Plus } from "lucide-react";
import { btn } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { forbidInKidsMode, requireRole } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { AdminNav } from "@/components/admin/admin-nav";
import { APPS_ENABLED } from "@/lib/features";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await forbidInKidsMode();
  await requireRole(["ADMIN"], "/admin");
  const { t } = await getI18n();
  const [pending, apps, payouts, reports, tvQueue] = await Promise.all([
    prisma.series.count({ where: { status: "PENDING" } }),
    prisma.creatorApplication.count({ where: { status: "PENDING" } }),
    prisma.payout.count({ where: { status: { in: ["PENDING", "APPROVED"] } } }),
    prisma.report.groupBy({ by: ["targetType", "targetId"], where: { status: "OPEN" } }).then((g) => g.length),
    Promise.all([prisma.tvOrder.count({ where: { status: "REVIEW" } }), prisma.tvClip.count({ where: { status: "PENDING" } })]).then(([o, c]) => o + c),
  ]);
  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-[calc(var(--header-h)+24px)] md:px-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">{t.admin.title}</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/studio" className={btn("glass", "sm")}>
            <Clapperboard size={15} /> {t.nav.studio}
          </Link>
          <Link href="/studio/series/new" className={btn("primary", "sm")}>
            <Plus size={15} /> {t.studio.newSeries}
          </Link>
        </div>
      </div>
      <AdminNav
        items={[
          { href: "/admin", label: t.admin.overview },
          { href: "/admin/live-control", label: "🔴 " + t.v3.control.nav },
          { href: "/admin/moderation", label: t.admin.moderation, badge: pending },
          { href: "/admin/reports", label: t.report.admin.nav, badge: reports },
          { href: "/admin/series", label: t.admin.series },
          { href: "/admin/users", label: t.admin.users },
          { href: "/admin/applications", label: t.admin.applications, badge: apps },
          { href: "/admin/payouts", label: t.payouts.nav, badge: payouts },
          { href: "/admin/tv", label: t.tv.admin.nav, badge: tvQueue },
          ...(APPS_ENABLED ? [{ href: "/admin/apps", label: t.v3.apps.nav }] : []),
          { href: "/admin/show", label: t.show.adminNav },
          { href: "/admin/promos", label: t.promo.adminNav },
          { href: "/admin/watermark", label: t.wm.nav },
          { href: "/admin/comments", label: t.admin.comments },
          { href: "/admin/orders", label: t.adm.orders },
          { href: "/admin/log", label: t.adm.log },
        ]}
      />
      <div className="mt-8">{children}</div>
    </div>
  );
}
