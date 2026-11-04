import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getSeriesPage } from "@/lib/series";
import { decideAccess } from "@/lib/access";
import { getI18n } from "@/i18n/server";
import { pick } from "@/i18n/shared";
import { Player } from "@/components/player/player";
import { getSpicyForEpisode } from "@/lib/extras";
import { hasKidsAllowance } from "@/lib/kids";

type Props = { params: Promise<{ episodeId: string }> };

async function load(episodeId: string) {
  const ep = await prisma.episode.findUnique({ where: { id: episodeId }, include: { series: true } });
  return ep;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { episodeId } = await params;
  const [{ t, locale }, ep] = await Promise.all([getI18n(), load(episodeId)]);
  if (!ep) return {};
  return { title: `${pick(ep.series, "title", locale)} · ${t.common.episode} ${ep.number}` };
}

export default async function WatchPage({ params }: Props) {
  const { episodeId } = await params;
  const [{ locale }, user, ep] = await Promise.all([getI18n(), getCurrentUser(), load(episodeId)]);
  if (!ep) notFound();
  const s = await getSeriesPage(ep.series.slug, user, locale);
  if (!s) notFound();
  // 18+ series: the series page shows the age wall.
  if (s.adultBlock) redirect(`/series/${s.slug}`);

  const unlocked = user ? !!(await prisma.unlock.findUnique({ where: { userId_episodeId: { userId: user.id, episodeId } } })) : false;
  const access = decideAccess(user, ep, unlocked);
  const idx = s.episodes.findIndex((e) => e.id === ep.id);
  const kids = !!user?.kidsMode;
  const [progress, liked, likeCount, commentCount, spicy, kidsAutoAllowed] = await Promise.all([
    user ? prisma.watchProgress.findUnique({ where: { userId_episodeId: { userId: user.id, episodeId } } }) : null,
    user ? prisma.like.findUnique({ where: { userId_episodeId: { userId: user.id, episodeId } } }) : null,
    prisma.like.count({ where: { episodeId } }),
    kids ? 0 : prisma.comment.count({ where: { episodeId, hidden: false } }),
    getSpicyForEpisode(user, { id: ep.id, seriesId: ep.seriesId, creatorId: ep.series.creatorId }, ep.series, locale),
    kids && user && !access.ok ? hasKidsAllowance(user.id, ep.seriesId) : false,
  ]);

  return (
    <Player
      key={ep.id}
      episode={{
        id: ep.id,
        number: ep.number,
        title: pick(ep, "title", locale),
        locked: !access.ok,
        reason: access.ok ? null : access.reason,
        price: access.ok ? 0 : access.price,
        startAt: progress && !progress.completed ? progress.positionSec : 0,
      }}
      series={{ slug: s.slug, title: s.title, orientation: s.orientation, poster: s.poster, backdrop: s.backdrop, episodes: s.episodes }}
      prevId={s.episodes[idx - 1]?.id ?? null}
      nextId={s.episodes[idx + 1]?.id ?? null}
      liked={!!liked}
      likeCount={likeCount}
      commentCount={commentCount}
      user={user ? { coins: user.coins, name: user.name, hue: user.avatarHue } : null}
      kids={kids}
      kidsAutoAllowed={kidsAutoAllowed}
      spicy={spicy}
    />
  );
}
