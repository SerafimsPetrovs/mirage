import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/i18n/server";
import { channelFor, onAir } from "@/lib/tv";

/** What is on air on a channel right now (+ the next few slots). Everyone gets the same slot and offset. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  const ch = await channelFor(slug, user);
  if (!ch) return new Response("Not found", { status: 404 });
  return Response.json(await onAir(ch, locale, user?.id ?? null), { headers: { "Cache-Control": "no-store" } });
}
