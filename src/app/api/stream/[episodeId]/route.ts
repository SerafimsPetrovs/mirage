import { getCurrentUser } from "@/lib/auth";
import { getEpisodeAccess } from "@/lib/coins";
import { resolveMediaPath, serveFile } from "@/lib/files";

export async function GET(req: Request, ctx: { params: Promise<{ episodeId: string }> }) {
  const { episodeId } = await ctx.params;
  const user = await getCurrentUser();
  const res = await getEpisodeAccess(user, episodeId);
  if (!res) return new Response("Not found", { status: 404 });
  const { episode, access } = res;
  const isOwner = user && (user.role === "ADMIN" || user.id === episode.series.creatorId);
  if (episode.series.status !== "PUBLISHED" && !isOwner) return new Response("Not found", { status: 404 });
  if (!access.ok) return new Response("Locked", { status: 403 });

  if (/^https?:\/\//.test(episode.videoUrl)) return Response.redirect(episode.videoUrl, 302);
  const full = resolveMediaPath(episode.videoUrl);
  if (!full) return new Response("Missing media", { status: 404 });
  return serveFile(full, req, { "Cache-Control": "private, max-age=3600" });
}
