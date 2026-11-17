import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decideAccess } from "@/lib/access";
import { adultSeriesBlock } from "@/lib/spicy";

/** Episodes of a series for the room's episode picker, with whether the caller can watch each one. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.kidsMode) return new Response("Unauthorized", { status: 401 });
  const slug = (new URL(req.url).searchParams.get("slug") ?? "").slice(0, 120);
  const s = await prisma.series.findUnique({
    where: { slug },
    select: { id: true, status: true, isAdult: true, freeEpisodes: true, defaultCoinPrice: true, creatorId: true, titleEn: true, titleRu: true, episodes: { orderBy: { number: "asc" }, select: { id: true, number: true, titleEn: true, titleRu: true, coinPrice: true, publishAt: true } } },
  });
  if (!s || s.status !== "PUBLISHED" || adultSeriesBlock(user, s)) return new Response("Not found", { status: 404 });
  const unlocked = new Set((await prisma.unlock.findMany({ where: { userId: user.id, episode: { seriesId: s.id } }, select: { episodeId: true } })).map((u) => u.episodeId));
  const now = new Date();
  const owner = user.role === "ADMIN" || user.id === s.creatorId;
  const episodes = s.episodes
    .filter((e) => owner || !e.publishAt || e.publishAt <= now)
    .map((e) => {
      const a = decideAccess(user, { ...e, series: s }, unlocked.has(e.id));
      return { id: e.id, number: e.number, title: e.titleEn || e.titleRu || "", ok: a.ok, price: a.ok ? 0 : a.price };
    });
  return Response.json({ title: s.titleEn || s.titleRu, episodes }, { headers: { "Cache-Control": "no-store" } });
}
