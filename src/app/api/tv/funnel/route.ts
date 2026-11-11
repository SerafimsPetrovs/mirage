import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * "Watch the whole series" clicked during a broadcast — counted for the creator's analytics.
 * One click per viewer per series per 10 minutes (so a creator can't inflate it by clicking).
 */
export async function POST(req: Request) {
  let body: { series?: unknown; channel?: unknown };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return new Response(null, { status: 400 });
  }
  const slug = typeof body.series === "string" ? body.series.slice(0, 120) : "";
  const channelSlug = typeof body.channel === "string" ? body.channel.slice(0, 60) : "";
  if (!slug) return new Response(null, { status: 400 });
  const [user, h] = await Promise.all([getCurrentUser(), headers()]);
  const who = user?.id ?? clientIp(h);
  if (!rateLimit(`funnel:${who}:${slug}`, 1, 10 * 60_000).allowed) return new Response(null, { status: 204 });
  const [series, channel] = await Promise.all([
    prisma.series.findUnique({ where: { slug }, select: { id: true, creatorId: true } }),
    channelSlug ? prisma.tvChannel.findUnique({ where: { slug: channelSlug }, select: { id: true } }) : null,
  ]);
  if (!series || series.creatorId === user?.id) return new Response(null, { status: 204 });
  await prisma.tvFunnelClick.create({ data: { seriesId: series.id, channelId: channel?.id ?? null, userId: user?.id ?? null } });
  return new Response(null, { status: 204 });
}
