import Link from "next/link";
import { prisma } from "@/lib/db";
import { posterUrl } from "@/lib/poster";
import { mediaUrl } from "@/lib/files";
import { getI18n } from "@/i18n/server";
import { formatNumber, pick } from "@/i18n/shared";
import { StatusBadge } from "@/components/studio/status-badge";
import { SeriesFlags } from "@/components/admin/admin-actions";

export default async function AdminSeriesPage() {
  const { t, locale } = await getI18n();
  const series = await prisma.series.findMany({
    orderBy: [{ featured: "desc" }, { views: "desc" }],
    include: { creator: { select: { name: true } }, _count: { select: { episodes: true } } },
  });
  return (
    <div className="divide-y divide-line overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
      {series.map((s) => (
        <div key={s.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={posterUrl({ slug: s.slug, hue: s.hue, posterUrl: mediaUrl(s.posterUrl) })} alt="" className="aspect-[9/16] w-11 shrink-0 rounded-lg object-cover" />
            <div className="min-w-0">
              <Link href={`/series/${s.slug}`} className="block truncate font-semibold hover:text-accent-2">{pick(s, "title", locale)}</Link>
              <p className="truncate text-xs text-muted">
                {s.creator.name} · {s._count.episodes} · {formatNumber(s.views, locale)} {t.common.views}
              </p>
            </div>
            <StatusBadge status={s.status} label={t.studio.status[s.status]} />
          </div>
          <SeriesFlags seriesId={s.id} featured={s.featured} status={s.status} />
        </div>
      ))}
    </div>
  );
}
