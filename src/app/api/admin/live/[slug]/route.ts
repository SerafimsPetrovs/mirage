import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/i18n/server";
import { prisma } from "@/lib/db";
import { channelBuffers, channelQueue, monitors, BROADCAST_DELAY_SEC } from "@/lib/tv-control";

/** Control room poll: both monitors, the up-next queue, active alerts and the channel's bounty state. Admin only. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN" || user.kidsMode) return new Response("Not found", { status: 404 });
  const { slug } = await ctx.params;
  const ch = await prisma.tvChannel.findUnique({ where: { slug } });
  if (!ch) return new Response("Not found", { status: 404 });
  const now = new Date();
  const locale = await getLocale();
  const [mon, queue, alerts, buffers] = await Promise.all([
    monitors(ch, locale, now),
    channelQueue(ch.id, now, 3),
    prisma.tvAlert.findMany({ where: { until: { gt: now }, OR: [{ channelId: ch.id }, { channelId: null }] }, orderBy: { createdAt: "desc" } }),
    channelBuffers(now),
  ]);
  return Response.json(
    {
      serverNow: Date.now(),
      delaySec: BROADCAST_DELAY_SEC,
      monitors: mon,
      queue,
      alerts: alerts.map((a) => ({ id: a.id, text: a.text, until: a.until.getTime(), all: !a.channelId })),
      buffer: buffers.find((b) => b.channelId === ch.id) ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
