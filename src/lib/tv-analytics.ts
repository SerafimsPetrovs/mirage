import "server-only";
import { prisma } from "./db";

/**
 * Channel analytics for the last `days` days: audience (watched minutes, peak viewers), engagement (chat, likes,
 * orders, moments, watch parties), the series funnel, an hourly audience profile and the most liked clips.
 */
export async function tvAnalytics(days = 7, now = new Date()) {
  const since = new Date(now.getTime() - days * 86400_000);
  const sinceDay = since.toISOString().slice(0, 10);
  const channels = await prisma.tvChannel.findMany({ orderBy: { number: "asc" }, select: { id: true, slug: true, number: true, nameEn: true, nameRu: true, hue: true, active: true } });
  const [stats, messages, likes, funnel, orders, moments, parties, topLikes] = await Promise.all([
    prisma.tvChannelStat.findMany({ where: { day: { gte: sinceDay } } }),
    prisma.tvMessage.groupBy({ by: ["channelId"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.tvClipLike.findMany({ where: { createdAt: { gte: since } }, select: { clip: { select: { channelId: true } } } }),
    prisma.tvFunnelClick.groupBy({ by: ["channelId"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.tvOrder.groupBy({ by: ["channelId"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.tvMoment.groupBy({ by: ["channelSlug"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.party.groupBy({ by: ["channelSlug"], where: { createdAt: { gte: since }, mode: "TV" }, _count: { _all: true } }),
    prisma.tvClipLike.groupBy({ by: ["clipId"], where: { createdAt: { gte: since } }, _count: { _all: true }, orderBy: { _count: { clipId: "desc" } }, take: 10 }),
  ]);
  const count = <K extends string>(rows: ({ _count: { _all: number } } & Record<K, string | null>)[], key: K) =>
    new Map(rows.map((r) => [r[key] as string, r._count._all]));
  const msg = count(messages, "channelId");
  const fun = count(funnel, "channelId");
  const ord = count(orders, "channelId");
  const mom = count(moments, "channelSlug");
  const par = count(parties, "channelSlug");
  const likeBy = new Map<string, number>();
  for (const l of likes) likeBy.set(l.clip.channelId, (likeBy.get(l.clip.channelId) ?? 0) + 1);

  const hourly = Array.from({ length: 24 }, () => 0);
  const perChannel = new Map<string, { minutes: number; peak: number }>();
  for (const s of stats) {
    hourly[s.hour] += s.minutes;
    const c = perChannel.get(s.channelId) ?? { minutes: 0, peak: 0 };
    c.minutes += s.minutes;
    c.peak = Math.max(c.peak, s.peak);
    perChannel.set(s.channelId, c);
  }
  const clips = topLikes.length
    ? await prisma.tvClip.findMany({ where: { id: { in: topLikes.map((x) => x.clipId) } }, select: { id: true, title: true, artist: true, plays: true, kind: true, channel: { select: { nameEn: true, nameRu: true } } } })
    : [];
  return {
    days,
    channels: channels.map((c) => ({
      ...c,
      minutes: perChannel.get(c.id)?.minutes ?? 0,
      peak: perChannel.get(c.id)?.peak ?? 0,
      messages: msg.get(c.id) ?? 0,
      likes: likeBy.get(c.id) ?? 0,
      funnel: fun.get(c.id) ?? 0,
      orders: ord.get(c.id) ?? 0,
      moments: mom.get(c.slug) ?? 0,
      parties: par.get(c.slug) ?? 0,
    })),
    hourly,
    topClips: topLikes.map((x) => ({ likes: x._count._all, clip: clips.find((c) => c.id === x.clipId) })).filter((x) => x.clip),
  };
}
