import { getCurrentUser } from "@/lib/auth";
import { getEpisodeAccess } from "@/lib/coins";
import { prisma } from "@/lib/db";
import { resolveMediaPath, serveFile } from "@/lib/files";
import { spicyBlock } from "@/lib/spicy";

/** 18+ bonus scene: adults outside kids mode who bought it (or the creator). */
export async function GET(req: Request, ctx: { params: Promise<{ sceneId: string }> }) {
  const { sceneId } = await ctx.params;
  const user = await getCurrentUser();
  const scene = await prisma.bonusScene.findUnique({ where: { id: sceneId } });
  if (!scene || !user) return new Response("Not found", { status: 404 });
  const res = await getEpisodeAccess(user, scene.episodeId);
  if (!res) return new Response("Not found", { status: 404 });
  const isOwner = user.role === "ADMIN" || user.id === res.episode.series.creatorId;
  if (!isOwner) {
    if (res.episode.series.status !== "PUBLISHED" || spicyBlock(user, res.episode.series)) return new Response("Forbidden", { status: 403 });
    const owned = await prisma.sceneUnlock.findUnique({ where: { userId_sceneId: { userId: user.id, sceneId } } });
    if (!owned || !res.access.ok) return new Response("Locked", { status: 403 });
  }
  if (/^https?:\/\//.test(scene.videoUrl)) return Response.redirect(scene.videoUrl, 302);
  const full = resolveMediaPath(scene.videoUrl);
  if (!full) return new Response("Missing media", { status: 404 });
  return serveFile(full, req, { "Cache-Control": "private, max-age=3600" });
}
