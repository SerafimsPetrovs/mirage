import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/i18n/server";
import { channelFor, onAir } from "@/lib/tv";
import { TV_REWIND_MAX_SEC } from "@/lib/tv-rules";

/** What is on air on a channel right now (+ the next few slots). Everyone gets the same slot and offset. */
/** `?back=<sec>` (≤ TV_REWIND_MAX_SEC): what was on that long ago — the "rewind the broadcast" replay. */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  const ch = await channelFor(slug, user);
  if (!ch) return new Response("Not found", { status: 404 });
  const back = Math.min(TV_REWIND_MAX_SEC, Math.max(0, Math.floor(Number(new URL(req.url).searchParams.get("back")) || 0)));
  const at = new Date(Date.now() - back * 1000);
  // a replay neither binds ad breaks nor counts plays
  return Response.json(await onAir(ch, locale, user?.id ?? null, at, { preview: back > 0 }), { headers: { "Cache-Control": "no-store" } });
}
