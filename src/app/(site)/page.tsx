import Link from "next/link";
import { ArrowRight, PlaySquare } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getHomeData } from "@/lib/catalog";
import { getI18n } from "@/i18n/server";
import { Hero } from "@/components/media/hero";
import { Row, RowItem } from "@/components/media/row";
import { ContinueCard, PosterCard, Top10Card, WideCard } from "@/components/media/cards";
import { MoodPicker } from "@/components/media/mood-picker";
import { SectionTitle } from "@/components/ui/misc";
import { btn } from "@/components/ui/button";
import { CheckInWidget } from "@/components/wallet/checkin-widget";
import { getCheckInState } from "@/lib/coins";

export default async function HomePage() {
  const [{ t, locale }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  const data = await getHomeData(locale, user?.id ?? null);
  const checkIn = user ? await getCheckInState(user.id) : null;
  const seeAll = (href: string) => (
    <Link href={href} className="flex shrink-0 items-center gap-1 text-sm font-medium text-muted hover:text-text">
      {t.common.seeAll} <ArrowRight size={15} />
    </Link>
  );

  return (
    <div className="pb-6">
      <Hero items={data.featured} />

      <div className="relative z-10 -mt-6 space-y-10 md:-mt-16 md:space-y-14">
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

        <section>
          <SectionTitle title={t.home.top10} />
          <Row gap="gap-1 md:gap-2">
            {data.top.map((s, i) => (
              <RowItem key={s.id}>
                <Top10Card s={s} rank={i + 1} t={t} locale={locale} />
              </RowItem>
            ))}
          </Row>
        </section>

        <section>
          <SectionTitle title={t.home.shorts} sub={t.home.shortsSub} action={seeAll("/browse?format=vertical")} />
          <Row>
            {data.shorts.map((s, i) => (
              <RowItem key={s.id}>
                <PosterCard s={s} t={t} locale={locale} priority={i < 4} className="w-[140px] md:w-[188px]" />
              </RowItem>
            ))}
          </Row>
        </section>

        <section className="px-4 md:px-10">
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
        </section>

        <section>
          <SectionTitle title={t.home.moodTitle} sub={t.home.moodSub} />
          <MoodPicker t={t} />
        </section>

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

        <section>
          <SectionTitle title={t.home.series} action={seeAll("/browse?format=horizontal")} />
          <Row>
            {data.epics.map((s) => (
              <RowItem key={s.id}>
                <WideCard s={s} t={t} locale={locale} className="w-[280px] md:w-[400px]" />
              </RowItem>
            ))}
          </Row>
        </section>

        <section>
          <SectionTitle title={t.home.fresh} action={seeAll("/browse?sort=new")} />
          <Row>
            {data.fresh.map((s) => (
              <RowItem key={s.id}>
                <PosterCard s={s} t={t} locale={locale} className="w-[140px] md:w-[188px]" />
              </RowItem>
            ))}
          </Row>
        </section>
      </div>
    </div>
  );
}
