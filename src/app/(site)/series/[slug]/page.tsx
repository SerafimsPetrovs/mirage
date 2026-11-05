import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crown, Eye, Play, Star, Wand2 } from "lucide-react";
import { getCurrentUser, isVip } from "@/lib/auth";
import { getActivePoll, getSeriesPage, getSimilar } from "@/lib/series";
import { getI18n } from "@/i18n/server";
import { fmt, formatNumber, plural } from "@/i18n/shared";
import { btn } from "@/components/ui/button";
import { AiChip, Avatar, SectionTitle } from "@/components/ui/misc";
import { Row, RowItem } from "@/components/media/row";
import { PosterCard } from "@/components/media/cards";
import { EpisodeList, EpisodeNumberGrid } from "@/components/series/episode-grid";
import { ListButton, RatingStars, ShareButton } from "@/components/series/series-actions";
import { PollCard } from "@/components/series/poll-card";
import { CameoBlock } from "@/components/series/cameo-block";
import { getShowBlock } from "@/lib/show";
import { CharacterStrip } from "@/components/player/spicy";
import { getSeriesCharacters } from "@/lib/extras";
import { spicyBlock } from "@/lib/spicy";
import { getOrCreateRefCode } from "@/lib/referrals";
import { AdultWall } from "@/components/adult/adult-wall";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [{ locale }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  const s = await getSeriesPage(slug, user, locale);
  if (!s) return {};
  // Never leak 18+ artwork into link previews; keep 18+ pages out of search engines.
  if (s.isAdult) return { title: `${s.title} (18+)`, robots: { index: false, follow: false } };
  return { title: s.title, description: s.tagline || s.description.slice(0, 160), openGraph: { images: [s.backdrop] } };
}

export default async function SeriesPage({ params }: Props) {
  const { slug } = await params;
  const [{ t, locale }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  const s = await getSeriesPage(slug, user, locale);
  if (!s) notFound();
  if (s.adultBlock) return <AdultWall title={s.title} poster={s.backdrop} reason={s.adultBlock} next={`/series/${s.slug}`} />;
  const block = spicyBlock(user, s);
  const showSpicy = block === null || (s.owner && !s.kids && !s.isFamilySafe);
  const [similar, poll, characters, show] = await Promise.all([
    getSimilar(s.id, s.genres, locale),
    getActivePoll(s.id, user?.id ?? null, locale),
    showSpicy ? getSeriesCharacters(s.id, locale) : [],
    s.interactive && !s.kids ? getShowBlock(s.id, user?.id ?? null) : null,
  ]);
  const vip = isVip(user);
  const refCode = user && !user.kidsMode ? await getOrCreateRefCode(user.id) : null;
  const vertical = s.orientation === "VERTICAL";

  return (
    <div className="pb-6">
      {/* Hero */}
      <section className="relative min-h-[560px] overflow-hidden md:min-h-[640px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={s.backdrop} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-[2px] md:blur-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/20" />
        <div className="absolute inset-0 hidden bg-gradient-to-r from-bg via-bg/60 to-transparent md:block" />

        <div className="relative flex flex-col gap-6 px-4 pb-8 pt-[calc(var(--header-h)+24px)] md:flex-row md:items-end md:gap-10 md:px-10 md:pb-12 md:pt-[calc(var(--header-h)+64px)]">
          <div className={vertical ? "mx-auto w-[180px] shrink-0 md:mx-0 md:w-[260px]" : "hidden"}>
            {/* Morph target for the clicked poster card (see PosterMorph) */}
            <div
              data-vt-target={`poster-${s.slug}`}
              className="relative aspect-[9/16] overflow-hidden rounded-3xl shadow-[0_30px_80px_-20px_rgba(0,0,0,.9)] ring-1 ring-white/15"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.poster} alt={s.title} className="h-full w-full object-cover" />
            </div>
          </div>

          <div className="max-w-3xl text-center md:text-left">
            {s.status !== "PUBLISHED" && (
              <span className="mb-3 inline-block rounded-full bg-coin/15 px-3 py-1 text-xs font-semibold text-coin">{t.studio.status[s.status]}</span>
            )}
            <div className="mb-3 flex flex-wrap justify-center gap-2 md:justify-start">
              {s.aiModels.map((m) => (
                <AiChip key={m} label={m} />
              ))}
            </div>
            <h1 className="font-display text-[32px] font-bold leading-[1.08] tracking-tight md:text-[56px]">{s.title}</h1>
            {s.tagline && <p className="mt-3 text-lg text-white/80 md:text-xl">{s.tagline}</p>}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-white/65 md:justify-start">
              {s.rating.count > 0 && (
                <span className="inline-flex items-center gap-1 font-semibold text-coin">
                  <Star size={15} className="fill-coin" /> {s.rating.avg.toFixed(1)}
                </span>
              )}
              <span className="rounded-md border border-white/25 px-1.5 py-0.5 text-xs">{s.ageRating}</span>
              <span>
                {s.episodes.length} {plural(s.episodes.length, t.common.episodes, locale)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Eye size={15} /> {formatNumber(s.views, locale)}
              </span>
              <span>{s.genres.map((g) => t.genres[g as keyof typeof t.genres] ?? g).join(" · ")}</span>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 md:justify-start">
              {s.resume && (
                <Link href={`/watch/${s.resume.id}`} className={btn("primary", "lg")}>
                  <Play size={20} fill="currentColor" />
                  {s.hasProgress ? fmt(t.series.continue, { n: s.resume.number }) : t.series.play}
                </Link>
              )}
              <ListButton seriesId={s.id} initial={s.inList} />
              <ShareButton title={s.title} refCode={refCode} />
            </div>
            <p className="mt-4 text-sm text-muted">
              {vip ? (
                <span className="inline-flex items-center gap-1.5 text-vip">
                  <Crown size={15} /> {t.series.vipAll}
                </span>
              ) : (
                fmt(t.series.freeEpisodes, { n: s.freeEpisodes })
              )}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-10 px-4 md:grid-cols-[minmax(0,1fr)_380px] md:gap-12 md:px-10">
        <div className="min-w-0 space-y-10">
          <section>
            <h2 className="mb-3 font-display text-lg font-semibold md:text-xl">{t.series.about}</h2>
            <p className="max-w-3xl whitespace-pre-line text-[15px] leading-relaxed text-white/80 md:text-base">{s.description}</p>
          </section>

          <section id="episodes">
            <h2 className="mb-4 font-display text-lg font-semibold md:text-xl">
              {t.series.episodes} <span className="text-muted">· {s.episodes.length}</span>
            </h2>
            {vertical ? <EpisodeNumberGrid episodes={s.episodes} currentId={s.hasProgress ? s.resume?.id : undefined} t={t} /> : <EpisodeList episodes={s.episodes} backdrop={s.backdrop} t={t} />}
          </section>
        </div>

        <aside className="space-y-5">
          {characters.length > 0 && (
            <div className="rounded-3xl p-5 ring-1 ring-line md:p-6" style={{ background: "radial-gradient(100% 140% at 0% 0%, rgba(255,46,99,.18), transparent 55%), var(--surface)" }}>
              <CharacterStrip characters={characters} />
            </div>
          )}
          {poll && <PollCard poll={poll} loggedIn={!!user} canBoost={!!user && !s.kids && !s.owner} balance={user?.coins ?? 0} />}
          {show && <CameoBlock seriesId={s.id} loggedIn={!!user} defaultName={user?.name ?? ""} data={show} />}

          <div className="rounded-3xl bg-surface p-5 ring-1 ring-line md:p-6">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-accent-2">
              <Wand2 size={18} /> {t.series.howItsMade}
            </div>
            <p className="mb-4 text-sm text-muted">{t.series.howItsMadeSub}</p>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{t.series.aiTools}</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {s.aiModels.map((m) => (
                <AiChip key={m} label={m} />
              ))}
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{t.series.promptNotes}</p>
            <p className="text-sm leading-relaxed text-white/80">{s.promptNotes || t.series.noNotes}</p>
          </div>

          <div className="space-y-5 rounded-3xl bg-surface p-5 ring-1 ring-line md:p-6">
            <div className="flex items-center gap-3">
              <Avatar name={s.creator.name} hue={s.creator.avatarHue} size={44} />
              <div className="min-w-0">
                <p className="text-xs text-muted">{t.series.creator}</p>
                <p className="truncate font-semibold">{s.creator.name}</p>
              </div>
            </div>
            {s.creator.bio && <p className="text-sm text-white/70">{s.creator.bio}</p>}
            <div className="h-px bg-line" />
            <RatingStars seriesId={s.id} initial={s.myRating} loggedIn={!!user} />
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-14">
          <SectionTitle title={t.series.similar} />
          <Row>
            {similar.map((x) => (
              <RowItem key={x.id}>
                <PosterCard s={x} t={t} locale={locale} className="w-[140px] md:w-[180px]" />
              </RowItem>
            ))}
          </Row>
        </section>
      )}
    </div>
  );
}
