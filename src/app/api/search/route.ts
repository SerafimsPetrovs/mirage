import { listSeries, searchSeries } from "@/lib/catalog";
import { getI18n } from "@/i18n/server";

/** Lightweight search for the Ctrl+K palette. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const { t, locale } = await getI18n();
  // `top=1` with an empty query (watch-party episode picker): the most watched series instead of nothing
  const top = new URL(req.url).searchParams.get("top") === "1" && !q.trim();
  const items = top
    ? await listSeries(locale, { where: { status: "PUBLISHED", isAdult: false }, orderBy: { views: "desc" }, take: 8 })
    : await searchSeries(q, locale, t.genres, 8);
  return Response.json(
    items.map((s) => ({ slug: s.slug, title: s.title, tagline: s.tagline, poster: s.poster, orientation: s.orientation, episodes: s.episodes, aiModels: s.aiModels.slice(0, 2) })),
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}
