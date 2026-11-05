import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { mediaUrl } from "@/lib/files";
import { posterUrl, backdropUrl } from "@/lib/poster";
import { splitList } from "@/lib/catalog";
import { getI18n } from "@/i18n/server";
import { fmt, pick } from "@/i18n/shared";
import { btn } from "@/components/ui/button";
import { SeriesForm } from "@/components/studio/series-form";
import { DeleteSeries, EpisodeManager, PollForm, SubmitForReview } from "@/components/studio/episode-manager";
import { StatusBadge } from "@/components/studio/status-badge";
import { ExtrasManager } from "@/components/studio/extras-manager";

export default async function EditSeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole(["CREATOR", "ADMIN"]);
  const { t, locale } = await getI18n();
  const s = await prisma.series.findUnique({
    where: { id },
    include: {
      episodes: { orderBy: { number: "asc" }, include: { skins: { orderBy: { createdAt: "asc" } }, bonusScene: true } },
      characters: { orderBy: { createdAt: "asc" }, include: { photos: { orderBy: { order: "asc" } } } },
      polls: { orderBy: { createdAt: "desc" }, include: { _count: { select: { votes: true } } } },
    },
  });
  if (!s || (s.creatorId !== user.id && user.role !== "ADMIN")) notFound();
  const ref = { slug: s.slug, hue: s.hue, posterUrl: mediaUrl(s.posterUrl), backdropUrl: mediaUrl(s.backdropUrl) };

  return (
    <div className="space-y-10">
      <div>
        <Link href="/studio" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-text">
          <ChevronLeft size={16} /> {t.studio.title}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold">{pick(s, "title", locale)}</h1>
            <StatusBadge status={s.status} label={t.studio.status[s.status]} />
          </div>
          <div className="flex flex-wrap gap-2">
            <SubmitForReview seriesId={s.id} status={s.status} hasEpisodes={s.episodes.length > 0} />
            <Link href={`/series/${s.slug}`} className={btn("glass", "md")}>
              <ExternalLink size={18} /> {t.studio.view}
            </Link>
          </div>
        </div>
        {s.status === "REJECTED" && s.rejectReason && (
          <p className="mt-3 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{fmt(t.studio.rejectReason, { r: s.rejectReason })}</p>
        )}
      </div>

      <section className="rounded-3xl bg-surface p-5 ring-1 ring-line md:p-7">
        <h2 className="mb-5 font-display text-xl font-semibold">
          {t.studio.episodes} <span className="text-muted">· {s.episodes.length}</span>
        </h2>
        <EpisodeManager
          seriesId={s.id}
          defaultPrice={s.defaultCoinPrice}
          episodes={s.episodes.map((e) => ({ id: e.id, number: e.number, title: pick(e, "title", locale), durationSec: e.durationSec, coinPrice: e.coinPrice, views: e.views }))}
        />
      </section>

      <section className="rounded-3xl bg-surface p-5 ring-1 ring-line md:p-7">
        <SeriesForm
          initial={{
            id: s.id,
            titleRu: s.titleRu,
            titleEn: s.titleEn,
            taglineRu: s.taglineRu,
            taglineEn: s.taglineEn,
            descriptionRu: s.descriptionRu,
            descriptionEn: s.descriptionEn,
            orientation: s.orientation,
            genres: splitList(s.genres),
            moods: splitList(s.moods),
            aiModels: splitList(s.aiModels).join(", "),
            promptNotesRu: s.promptNotesRu,
            promptNotesEn: s.promptNotesEn,
            ageRating: s.ageRating,
            isAdult: s.isAdult,
            adultLocked: s.adultLocked,
            freeEpisodes: s.freeEpisodes,
            defaultCoinPrice: s.defaultCoinPrice,
            hue: s.hue,
            posterUrl: s.posterUrl ?? "",
            backdropUrl: s.backdropUrl ?? "",
            posterPreview: posterUrl(ref),
            backdropPreview: backdropUrl(ref),
          }}
        />
      </section>

      <section className="rounded-3xl bg-surface p-5 ring-1 ring-line md:p-7">
        <h2 className="mb-5 font-display text-xl font-semibold">{t.studio.polls}</h2>
        <PollForm
          seriesId={s.id}
          polls={s.polls.map((p) => ({ id: p.id, question: pick(p, "question", locale), votes: p._count.votes, closesAt: p.closesAt.toISOString() }))}
        />
      </section>

      <section className="rounded-3xl p-5 ring-1 ring-line md:p-7" style={{ background: "radial-gradient(90% 120% at 100% 0%, rgba(255,46,99,.12), transparent 60%), var(--surface)" }}>
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
          {t.studio.extras} <span className="rounded-md border border-white/20 px-1.5 text-xs font-bold text-white/70">18+</span>
        </h2>
        <p className="mb-5 mt-1 text-sm text-muted">{t.studio.extrasSub}</p>
        <ExtrasManager
          seriesId={s.id}
          familySafe={s.isFamilySafe}
          episodes={s.episodes.map((e) => ({
            id: e.id,
            number: e.number,
            title: pick(e, "title", locale),
            skins: e.skins.map((k) => ({ id: k.id, nameRu: k.nameRu, emoji: k.emoji, rarity: k.rarity, price: k.price })),
            scene: e.bonusScene
              ? { titleRu: e.bonusScene.titleRu, titleEn: e.bonusScene.titleEn, price: e.bonusScene.price, durationSec: e.bonusScene.durationSec, triggerAtSec: e.bonusScene.triggerAtSec, videoUrl: e.bonusScene.videoUrl }
              : null,
          }))}
          characters={s.characters.map((c) => ({
            id: c.id,
            nameRu: c.nameRu,
            nameEn: c.nameEn,
            taglineRu: c.taglineRu,
            taglineEn: c.taglineEn,
            greetingRu: c.greetingRu,
            greetingEn: c.greetingEn,
            persona: c.persona,
            age: c.age,
            avatarUrl: c.avatarUrl ?? "",
            avatarPreview: mediaUrl(c.avatarUrl),
            hue: c.hue,
            photos: c.photos.map((p) => ({ id: p.id, preview: `/api/photo/${p.id}`, captionRu: p.captionRu, price: p.price })),
          }))}
        />
      </section>

      <DeleteSeries seriesId={s.id} />
    </div>
  );
}
