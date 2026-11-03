import { Inbox } from "lucide-react";
import { prisma } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { formatDate } from "@/i18n/shared";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { ApplicationButtons } from "@/components/admin/admin-actions";

export default async function ApplicationsPage() {
  const { t, locale } = await getI18n();
  const apps = await prisma.creatorApplication.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, email: true, avatarHue: true } } },
  });
  if (!apps.length) return <EmptyState icon={<Inbox size={24} />} title={t.admin.emptyQueue} />;
  return (
    <div className="space-y-3">
      {apps.map((a) => (
        <div key={a.id} className="rounded-3xl bg-surface p-5 ring-1 ring-line">
          <div className="flex items-center gap-3">
            <Avatar name={a.user.name} hue={a.user.avatarHue} size={40} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{a.user.name}</p>
              <p className="text-xs text-muted">
                {a.user.email} · {formatDate(a.createdAt, locale)}
              </p>
            </div>
            <ApplicationButtons appId={a.id} />
          </div>
          <p className="mt-4 whitespace-pre-line text-sm text-white/85">{a.message}</p>
          {a.portfolio && /^https?:\/\//.test(a.portfolio) && (
            <a href={a.portfolio} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-block text-sm text-accent-2 hover:underline">
              {a.portfolio}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
