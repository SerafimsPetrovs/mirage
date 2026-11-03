import { Search } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser, isVip } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { Avatar, CoinAmount, VipBadge } from "@/components/ui/misc";
import { UserControls } from "@/components/admin/admin-actions";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const [{ t }, me] = await Promise.all([getI18n(), getCurrentUser()]);
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ email: { contains: q.toLowerCase() } }, { name: { contains: q } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { subscription: true },
  });
  return (
    <div className="space-y-4">
      <form className="relative max-w-md">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input name="q" defaultValue={q} placeholder="email / name" aria-label={t.common.search} className="h-11 w-full rounded-full bg-surface pl-11 pr-4 text-sm outline-none ring-1 ring-line focus:ring-accent/60" />
      </form>
      <div className="divide-y divide-line overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
        {users.map((u) => (
          <div key={u.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={u.name} hue={u.avatarHue} size={36} />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate font-semibold">
                  {u.name} {isVip(u) && <VipBadge />} {u.banned && <span className="rounded bg-red-500/20 px-1.5 text-[10px] font-bold text-red-300">BAN</span>}
                </p>
                <p className="truncate text-xs text-muted">{u.email}</p>
              </div>
              <CoinAmount value={u.coins} size={14} className="ml-auto text-sm" />
            </div>
            <UserControls userId={u.id} role={u.role} banned={u.banned} self={u.id === me?.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
