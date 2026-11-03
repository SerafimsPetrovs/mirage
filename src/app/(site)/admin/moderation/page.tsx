import Link from "next/link";
import { PartyPopper, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { posterUrl } from "@/lib/poster";
import { mediaUrl } from "@/lib/files";
import { splitList } from "@/lib/catalog";
import { getI18n } from "@/i18n/server";
import { pick, plural } from "@/i18n/shared";
import { btn } from "@/components/ui/button";
import { AiChip, EmptyState } from "@/components/ui/misc";
import { ModerationButtons } from "@/components/admin/admin-actions";

export default async function ModerationPage() {
  const { t, locale } = await getI18n();
  const queue = await prisma.series.findMany({
    where: { status: "PENDING" },
    orderBy: { updatedAt: "asc" },
    include: { creator: { select: { name: true, email: true } }, episodes: { orderBy: { number: "asc" }, take: 1 }, _count: { select: { episodes: true } } },
  });
  if (!queue.length) return <EmptyState icon={<PartyPopper size={24} />} title={t.admin.emptyQueue} />;
  return (
    <div className="space-y-4">
      {queue.map((s) => (
        <div key={s.id} className="flex flex-col gap-5 rounded-3xl bg-surface p-4 ring-1 ring-line md:flex-row md:p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={posterUrl({ slug: s.slug, hue: s.hue, posterUrl: mediaUrl(s.posterUrl) })} alt="" className="aspect-[9/16] w-28 shrink-0 rounded-2xl object-cover" />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h2 className="font-display text-lg font-semibold">{pick(s, "title", locale)}</h2>
              <p className="text-sm text-muted">
                {s.creator.name} · {s.creator.email} · {s._count.episodes} {plural(s._count.episodes, t.common.episodes, locale)} · {s.ageRating}
              </p>
            </div>
            <p className="line-clamp-3 text-sm text-white/80">{pick(s, "description", locale)}</p>
            <div className="flex flex-wrap gap-1.5">
              {splitList(s.aiModels).map((m) => <AiChip key={m} label={m} />)}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <ModerationButtons seriesId={s.id} />
              {s.episodes[0] && (
                <Link href={`/watch/${s.episodes[0].id}`} className={btn("glass", "md")}>
                  <ExternalLink size={16} /> {t.common.episode} 1
                </Link>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
