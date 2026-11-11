import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/i18n/server";
import { channelFor } from "@/lib/tv";
import { liveFeed } from "@/lib/tv-live";

/**
 * The channel's live feed, polled every few seconds: chat, ticker, reactions, viewer count, pinned super chat,
 * the "What's next?" poll. `?since=<ms>` returns only newer messages/reactions; `v` is an anonymous viewer id
 * (presence for guests); `beat=1` once a minute credits watching time to logged-in viewers.
 */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  const ch = await channelFor(slug, user);
  if (!ch) return new Response("Not found", { status: 404 });
  const url = new URL(req.url);
  const since = Number(url.searchParams.get("since")) || 0;
  const v = (url.searchParams.get("v") ?? "").replace(/[^\w-]/g, "").slice(0, 40) || "x";
  const data = await liveFeed(ch, user, v, since, {
    beat: url.searchParams.get("beat") === "1",
    titles: (o) => (locale === "ru" ? o.titleRu ?? o.title : o.title),
  });
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
