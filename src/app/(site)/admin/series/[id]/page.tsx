import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import { prisma } from "@/lib/db";
import { posterUrl } from "@/lib/poster";
import { mediaUrl } from "@/lib/files";
import { getI18n } from "@/i18n/server";
import { formatNumber, pick } from "@/i18n/shared";
import { btn } from "@/components/ui/button";
import { StatusBadge } from "@/components/studio/status-badge";
import { SeriesFlags } from "@/components/admin/admin-actions";
import { ChartRankSelect, DeleteSeries, EpisodeAdminRow, SeriesAdminForm } from "@/components/admin/admin-tools";

export default async function AdminSeriesDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, locale } = await getI18n();
  const s = await prisma.series.findUnique({
    where: { id },
    include: { creator: { select: { id: true, name: true, email: true } }, episodes: { orderBy: { number: "asc" } } },
  });
  if (!s) notFound();

  return (
    <div className="space-y-5">
      <Link href="/admin/series" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} /> {t.adm.back}
      </Link>
      <div className="flex flex-col gap-4 rounded-3xl bg-surface p-5 ring-1 ring-line md:flex-row md:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={posterUrl({ slug: s.slug, hue: s.hue, posterUrl: mediaUrl(s.posterUrl) })} alt="" className="aspect-[9/16] w-20 shrink-0 rounded-xl object-cover" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-bold">{pick(s, "title", locale)}</p>
          <p className="text-sm text-muted">
            <Link href={`/admin/users/${s.creator.id}`} className="hover:text-text">{s.creator.name} · {s.creator.email}</Link> · {s.episodes.length} · {formatNumber(s.views, locale)} {t.common.views}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={s.status} label={t.studio.status[s.status]} />
            <ChartRankSelect seriesId={s.id} rank={s.chartRank} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/series/${s.slug}`} className={btn("glass", "sm")}>
            <ExternalLink size={15} /> {t.adm.openSite}
          </Link>
          <Link href={`/studio/series/${s.id}`} className={btn("glass", "sm")}>
            <Pencil size={15} /> {t.adm.editInStudio}
          </Link>
        </div>
      </div>
      <SeriesFlags seriesId={s.id} featured={s.featured} status={s.status} familySafe={s.isFamilySafe} adult={s.isAdult} interactive={s.interactive} />
      <p className="text-xs text-muted">{t.adm.chartHint}</p>

      <SeriesAdminForm seriesId={s.id} views={s.views} price={s.defaultCoinPrice} free={s.freeEpisodes} />

      <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
        <h3 className="mb-2 font-display text-lg font-semibold">
          {t.adm.episodes} <span className="text-muted">· {s.episodes.length}</span>
        </h3>
        <ul className="divide-y divide-line">
          {s.episodes.map((e) => (
            <EpisodeAdminRow key={e.id} id={e.id} number={e.number} title={pick(e, "title", locale) || "—"} price={e.coinPrice} defaultPrice={s.defaultCoinPrice} />
          ))}
        </ul>
      </section>

      <DeleteSeries seriesId={s.id} slug={s.slug} />
    </div>
  );
}
