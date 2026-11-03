import { searchSeries } from "@/lib/catalog";
import { getI18n } from "@/i18n/server";

/** Lightweight search for the Ctrl+K palette. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const { t, locale } = await getI18n();
  const items = await searchSeries(q, locale, t.genres, 8);
  return Response.json(
    items.map((s) => ({ slug: s.slug, title: s.title, tagline: s.tagline, poster: s.poster, orientation: s.orientation, episodes: s.episodes, aiModels: s.aiModels.slice(0, 2) })),
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}
