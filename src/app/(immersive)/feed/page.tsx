import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { posterUrl } from "@/lib/poster";
import { mediaUrl } from "@/lib/files";
import { splitList } from "@/lib/catalog";
import { getI18n } from "@/i18n/server";
import { pick } from "@/i18n/shared";
import { Feed, type FeedItem } from "@/components/feed/feed";
import { MobileTabBar } from "@/components/layout/mobile-tabbar";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nav.feed };
}

export default async function FeedPage() {
  const [{ locale }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  const series = await prisma.series.findMany({
    where: { status: "PUBLISHED", orientation: "VERTICAL" },
    orderBy: { views: "desc" },
    take: 30,
    include: {
      episodes: { where: { number: 1 }, select: { id: true, number: true } },
      _count: { select: { episodes: true } },
      ...(user ? { listItems: { where: { userId: user.id }, select: { userId: true } } } : {}),
    },
  });

  // Gentle shuffle so the feed feels alive while staying popularity-weighted
  const day = new Date().getUTCDate();
  const ordered = series
    .map((s, i) => ({ s, k: i + ((s.id.charCodeAt(s.id.length - 1) + day) % 5) }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.s);

  const items: FeedItem[] = ordered
    .filter((s) => s.episodes[0])
    .map((s) => ({
      seriesId: s.id,
      slug: s.slug,
      title: pick(s, "title", locale),
      tagline: pick(s, "tagline", locale),
      poster: posterUrl({ slug: s.slug, hue: s.hue, posterUrl: mediaUrl(s.posterUrl) }),
      genres: splitList(s.genres),
      aiModels: splitList(s.aiModels),
      episodes: s._count.episodes,
      episodeId: s.episodes[0].id,
      episodeNumber: 1,
      inList: "listItems" in s && Array.isArray(s.listItems) && s.listItems.length > 0,
    }));

  return (
    <>
      <Feed items={items} />
      <MobileTabBar overlay />
    </>
  );
}
