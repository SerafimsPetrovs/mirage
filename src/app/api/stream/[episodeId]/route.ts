import { getCurrentUser } from "@/lib/auth";
import { getEpisodeAccess } from "@/lib/coins";
import { prisma } from "@/lib/db";
import { resolveMediaPath, serveFile } from "@/lib/files";
import { adultSeriesBlock, spicyBlock } from "@/lib/spicy";

function serveRef(ref: string, req: Request) {
  if (/^https?:\/\//.test(ref)) return Response.redirect(ref, 302);
  const full = resolveMediaPath(ref);
  if (!full) return new Response("Missing media", { status: 404 });
  return serveFile(full, req, { "Cache-Control": "private, max-age=3600" });
}

/** Episode video. `?skin=<id>` streams the alternative outfit cut (needs the skin unlocked). */
export async function GET(req: Request, ctx: { params: Promise<{ episodeId: string }> }) {
  const { episodeId } = await ctx.params;
  const user = await getCurrentUser();
  const res = await getEpisodeAccess(user, episodeId);
  if (!res) return new Response("Not found", { status: 404 });
  const { episode, access } = res;
  const isOwner = !!user && (user.role === "ADMIN" || user.id === episode.series.creatorId);
  if (episode.series.status !== "PUBLISHED" && !isOwner) return new Response("Not found", { status: 404 });
  if (user?.kidsMode && !episode.series.isFamilySafe) return new Response("Not found", { status: 404 });
  if (!isOwner && adultSeriesBlock(user, episode.series)) return new Response("Forbidden", { status: 403 });
  if (!access.ok) return new Response("Locked", { status: 403 });

  const skinId = new URL(req.url).searchParams.get("skin");
  if (skinId) {
    const skin = await prisma.skin.findUnique({ where: { id: skinId } });
    if (!skin || skin.episodeId !== episodeId) return new Response("Not found", { status: 404 });
    if (!isOwner) {
      if (spicyBlock(user, episode.series)) return new Response("Forbidden", { status: 403 });
      const owned = await prisma.skinUnlock.findUnique({ where: { userId_skinId: { userId: user!.id, skinId } } });
      if (!owned) return new Response("Locked", { status: 403 });
    }
    return serveRef(skin.videoUrl, req);
  }
  return serveRef(episode.videoUrl, req);
}
