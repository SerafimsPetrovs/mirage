import Link from "next/link";
import { prisma } from "@/lib/db";
import { getI18n } from "@/i18n/server";

const TARGET_HREF: Record<string, (id: string) => string> = {
  user: (id) => `/admin/users/${id}`,
  series: (id) => `/admin/series/${id}`,
};

export default async function AdminLogPage() {
  const { t, locale } = await getI18n();
  const rows = await prisma.adminLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const admins = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.adminId))] } }, select: { id: true, name: true } });
  const name = new Map(admins.map((a) => [a.id, a.name]));
  const df = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div>
      <p className="mb-4 text-sm text-muted">{t.adm.logSub}</p>
      {rows.length === 0 ? (
        <p className="rounded-3xl bg-surface p-6 text-sm text-muted ring-1 ring-line">{t.adm.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-3xl bg-surface ring-1 ring-line">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">{t.adm.when}</th>
                <th className="px-4 py-3 font-semibold">{t.adm.who}</th>
                <th className="px-4 py-3 font-semibold">{t.adm.what}</th>
                <th className="px-4 py-3 font-semibold">{t.adm.target}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const href = TARGET_HREF[r.targetType]?.(r.targetId);
                return (
                  <tr key={r.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted">{df.format(r.createdAt)}</td>
                    <td className="px-4 py-2.5">{name.get(r.adminId) ?? r.adminId.slice(0, 8)}</td>
                    <td className="px-4 py-2.5">
                      <code className="font-mono text-xs text-accent-2">{r.action}</code>
                      {r.details && <p className="mt-0.5 max-w-md break-all font-mono text-[11px] text-muted">{r.details}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {href ? <Link href={href} className="hover:text-accent">{r.targetType}</Link> : r.targetType}{" "}
                      <span className="font-mono text-muted">{r.targetId.slice(0, 10)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
