import Link from "next/link";
import { ArrowRight, Lock, PlaySquare, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getHomeData } from "@/lib/catalog";
import { getI18n } from "@/i18n/server";
import { Hero } from "@/components/media/hero";
import { Row, RowItem } from "@/components/media/row";
import { ContinueCard, PosterCard, Top10Card, WideCard } from "@/components/media/cards";
import { MoodPicker } from "@/components/media/mood-picker";
import { EmptyState, SectionTitle } from "@/components/ui/misc";
import { KidsEnterButton } from "@/components/kids/kids-controls";
import { btn } from "@/components/ui/button";
import { CheckInWidget } from "@/components/wallet/checkin-widget";
import { getCheckInState } from "@/lib/coins";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ kids?: string }> }) {
  const [{ t, locale }, user, sp] = await Promise.all([getI18n(), getCurrentUser(), searchParams]);
  const kids = !!user?.kidsMode;
  const data = await getHomeData(locale, user?.id ?? null);
  const checkIn = user && !kids ? await getCheckInState(user.id) : null;
  const nothing = !data.top.length;
  const seeAll = (href: string) => (
    <Link href={href} className="flex shrink-0 items-center gap-1 text-sm font-medium text-muted hover:text-text">
      {t.common.seeAll} <ArrowRight size={15} />
    </Link>
  );

  return (
    <div className="pb-6">
      {kids && (
        <section className="px-4 pt-[calc(var(--header-h)+20px)] md:px-10 md:pt-[calc(var(--header-h)+32px)]">
          {sp.kids === "locked" && (
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium">
              <Lock size={15} /> {t.kids.lockedPage}
            </p>
          )}
          <div
            className="relative overflow-hidden rounded-[32px] p-6 ring-1 ring-white/15 md:p-10"
            style={{ background: "radial-gradient(90% 140% at 100% 0%, rgba(255,211,110,.35), transparent 55%), radial-gradient(80% 120% at 0% 100%, rgba(62,197,255,.35), transparent 60%), var(--surface)" }}
          >
            <h1 className="font-display text-3xl font-bold leading-tight md:text-5xl">{t.kids.welcome}</h1>
            <p className="mt-2 max-w-lg text-lg text-white/85">{t.kids.welcomeSub}</p>
          </div>
        </section>
      )}
      {!kids && data.featured.length > 0 && <Hero items={data.featured} />}

      <div className={kids ? "relative z-10 mt-10 space-y-10 md:space-y-14" : "relative z-10 -mt-6 space-y-10 md:-mt-16 md:space-y-14"}>
        {kids && nothing && (
          <div className="px-4 md:px-10">
            <EmptyState icon={<Sparkles size={24} />} title={t.kids.empty} text={t.kids.emptyText} />
          </div>
        )}

        {!kids && (
          <section className="px-4 md:px-10">
            <div
              className="relative flex flex-col gap-5 overflow-hidden rounded-3xl p-6 ring-1 ring-white/10 md:flex-row md:items-center md:justify-between md:p-8"
              style={{ background: "radial-gradient(70% 140% at 0% 0%, rgba(62,197,255,.38), transparent 60%), radial-gradient(70% 140% at 100% 100%, rgba(255,126,182,.36), transparent 60%), linear-gradient(120deg, #241f5c, #2b2266)" }}
            >
              <span aria-hidden className="pointer-events-none absolute -right-6 -top-8 select-none text-[120px] leading-none opacity-25 md:right-8 md:top-1/2 md:-translate-y-1/2 md:text-[150px]">🚀</span>
              <div className="relative">
                <h2 className="font-display text-2xl font-bold md:text-3xl">{t.kids.promoTitle}</h2>
                <p className="mt-2 max-w-xl text-white/80">{t.kids.promoText}</p>
              </div>
              <KidsEnterButton variant="hero" loggedIn={!!user} hasPin={!!user?.kidsPinHash} autoOpen={sp.kids === "on"} className="relative self-start md:mr-40 md:self-auto" />
            </div>
          </section>
        )}
        {checkIn && !checkIn.doneToday && (
          <div className="px-4 md:px-10">
            <CheckInWidget state={checkIn} compact />
          </div>
        )}

        {data.continueWatching.length > 0 && (
          <section>
            <SectionTitle title={t.home.continueWatching} />
            <Row>
              {data.continueWatching.map((c) => (
                <RowItem key={c.id}>
                  <ContinueCard item={c} t={t} />
                </RowItem>
              ))}
            </Row>
          </section>
        )}

        {data.top.length > 0 && <section>
          <SectionTitle title={t.home.top10} />
          <Row gap="gap-1 md:gap-2">
            {data.top.map((s, i) => (
              <RowItem key={s.id}>
                <Top10Card s={s} rank={i + 1} t={t} locale={locale} />
              </RowItem>
            ))}
          </Row>
        </section>}

        {data.shorts.length > 0 && <section>
          <SectionTitle title={t.home.shorts} sub={t.home.shortsSub} action={seeAll("/browse?format=vertical")} />
          <Row>
            {data.shorts.map((s, i) => (
              <RowItem key={s.id}>
                <PosterCard s={s} t={t} locale={locale} priority={i < 4} className="w-[140px] md:w-[188px]" />
              </RowItem>
            ))}
          </Row>
        </section>}

        {!nothing && <section className="px-4 md:px-10">
          <Link
            href="/feed"
            className="grain group relative flex flex-col gap-5 overflow-hidden rounded-3xl p-6 ring-1 ring-line md:flex-row md:items-center md:justify-between md:p-10"
            style={{ background: "radial-gradient(80% 140% at 0% 100%, rgba(124,92,255,.45), transparent 60%), radial-gradient(70% 120% at 100% 0%, rgba(255,46,99,.4), transparent 60%), var(--surface)" }}
          >
            <div className="relative">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                <PlaySquare size={24} />
              </div>
              <h2 className="font-display text-2xl font-bold md:text-3xl">{t.home.feedPromoTitle}</h2>
              <p className="mt-2 max-w-md text-white/75">{t.home.feedPromoText}</p>
            </div>
            <span className={btn("secondary", "lg", "relative self-start md:self-auto")}>
              {t.home.feedPromoCta} <ArrowRight size={18} />
            </span>
          </Link>
        </section>}

        {!kids && (
          <section>
            <SectionTitle title={t.home.moodTitle} sub={t.home.moodSub} />
            <MoodPicker t={t} />
          </section>
        )}

        {data.myList.length > 0 && (
          <section>
            <SectionTitle title={t.home.myList} action={seeAll("/me#list")} />
            <Row>
              {data.myList.map((s) => (
                <RowItem key={s.id}>
                  {s.orientation === "VERTICAL" ? (
                    <PosterCard s={s} t={t} locale={locale} className="w-[140px] md:w-[188px]" />
                  ) : (
                    <WideCard s={s} t={t} locale={locale} className="w-[260px] md:w-[340px]" />
                  )}
                </RowItem>
              ))}
            </Row>
          </section>
        )}

        {data.epics.length > 0 && <section>
          <SectionTitle title={t.home.series} action={seeAll("/browse?format=horizontal")} />
          <Row>
            {data.epics.map((s) => (
              <RowItem key={s.id}>
                <WideCard s={s} t={t} locale={locale} className="w-[280px] md:w-[400px]" />
              </RowItem>
            ))}
          </Row>
        </section>}

        {data.fresh.length > 0 && <section>
          <SectionTitle title={t.home.fresh} action={seeAll("/browse?sort=new")} />
          <Row>
            {data.fresh.map((s) => (
              <RowItem key={s.id}>
                <PosterCard s={s} t={t} locale={locale} className="w-[140px] md:w-[188px]" />
              </RowItem>
            ))}
          </Row>
        </section>}
      </div>
    </div>
  );
}
