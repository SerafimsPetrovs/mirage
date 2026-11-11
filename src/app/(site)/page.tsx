import { lookOf } from "@/lib/buddy";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { getHomeData } from "@/lib/catalog";
import { channelDTO, listChannels, nowOnAll, onAir } from "@/lib/tv";
import { TvScreen } from "@/components/tv/tv-screen";
import { stripTitle } from "@/lib/tv-types";
import { Row, RowItem } from "@/components/media/row";
import { PosterCard } from "@/components/media/cards";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: `MIRAGE — ${t.v3.nav.live}` } };
}

/**
 * Home = the live broadcast, right away. The page is a stream page (player, what's on, other channels, chat);
 * the series catalog is only a modest row at the very bottom.
 */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ ch?: string }> }) {
  const [{ t, locale }, user, jar, sp] = await Promise.all([getI18n(), getCurrentUser(), cookies(), searchParams]);
  const kids = !!user?.kidsMode;
  const channels = await listChannels(user);
  // ?ch= comes from old /tv/<slug> links (the separate theatre page is gone), otherwise the last watched channel
  const last = jar.get("mirage_tv_ch")?.value;
  const ch = channels.find((c) => c.slug === sp.ch) ?? channels.find((c) => c.slug === last) ?? channels[0];
  const [now, all, data] = await Promise.all([
    ch ? onAir(ch, locale, user?.id ?? null).catch(() => null) : null,
    nowOnAll(channels, locale).catch(() => []),
    getHomeData(locale, user?.id ?? null),
  ]);
  const picks = [...data.top, ...data.shorts].filter((s, i, a) => a.findIndex((x) => x.id === s.id) === i).slice(0, 14);

  const teaser = picks.length > 0 && (
    <section className="mt-4 border-t border-white/[.06] pb-6 pt-6">
      <div className="mb-3 flex items-end justify-between gap-4 px-4 md:px-6">
        <div>
          <h2 className="font-display text-base font-bold md:text-lg">{t.v3.live.catalogTitle}</h2>
          <p className="text-sm text-muted">{t.v3.live.catalogSub}</p>
        </div>
        <Link href="/library" className="flex shrink-0 items-center gap-1 text-sm font-semibold text-muted hover:text-text">
          {t.v3.live.catalogCta} <ArrowRight size={15} />
        </Link>
      </div>
      <Row>
        {picks.map((s) => (
          <RowItem key={s.id}>
            <PosterCard s={s} t={t} locale={locale} className="w-[118px] md:w-[150px]" />
          </RowItem>
        ))}
      </Row>
    </section>
  );

  return (
    <div className="pt-[var(--header-h)]">
      {now ? (
        <TvScreen
          embedded
          channels={channels.map((c) => channelDTO(c, locale))}
          initial={now}
          viewer={{ loggedIn: !!user, coins: user?.coins ?? 0, kids, name: user?.name ?? "", gold: user?.gold ?? 0, admin: user?.role === "ADMIN", buddy: lookOf(user) }}
          strip={all.map((x) => ({ slug: x.channel.slug, number: x.channel.number, name: x.channel.name, hue: x.channel.hue, title: x.program ? stripTitle(x.program) : x.channel.tagline }))}
          below={teaser}
        />
      ) : (
        <div className="flex h-[60dvh] items-center justify-center text-muted">{t.tv.noSignalText}</div>
      )}
    </div>
  );
}
