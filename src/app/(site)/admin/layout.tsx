import { prisma } from "@/lib/db";
import { forbidInKidsMode, requireRole } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await forbidInKidsMode();
  await requireRole(["ADMIN"], "/admin");
  const { t } = await getI18n();
  const [pending, apps, payouts] = await Promise.all([
    prisma.series.count({ where: { status: "PENDING" } }),
    prisma.creatorApplication.count({ where: { status: "PENDING" } }),
    prisma.payout.count({ where: { status: { in: ["PENDING", "APPROVED"] } } }),
  ]);
  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-[calc(var(--header-h)+24px)] md:px-10">
      <h1 className="mb-4 font-display text-3xl font-bold">{t.admin.title}</h1>
      <AdminNav
        items={[
          { href: "/admin", label: t.admin.overview },
          { href: "/admin/moderation", label: t.admin.moderation, badge: pending },
          { href: "/admin/series", label: t.admin.series },
          { href: "/admin/users", label: t.admin.users },
          { href: "/admin/applications", label: t.admin.applications, badge: apps },
          { href: "/admin/payouts", label: t.payouts.nav, badge: payouts },
          { href: "/admin/show", label: t.show.adminNav },
          { href: "/admin/promos", label: t.promo.adminNav },
          { href: "/admin/comments", label: t.admin.comments },
        ]}
      />
      <div className="mt-8">{children}</div>
    </div>
  );
}
