import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveMediaPath, serveFile } from "@/lib/files";
import { channelVisible } from "@/lib/tv-rules";
import { tvViewer } from "@/lib/tv";
import { ensureLite, litePath } from "@/lib/video-lite";

/**
 * Video of a TV clip. Approved clips play for anyone who may watch the channel;
 * pending/rejected ones only for their author and admins (moderation preview).
 * `?q=lite` (phones, slow connections): the 720p copy if it's ready; otherwise the original, and the copy is queued.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [user, clip] = await Promise.all([getCurrentUser(), prisma.tvClip.findUnique({ where: { id }, include: { channel: true } })]);
  if (!clip) return new Response("Not found", { status: 404 });
  const privileged = !!user && (user.role === "ADMIN" || user.id === clip.creatorId);
  if (!privileged && (clip.status !== "APPROVED" || !channelVisible(clip.channel, tvViewer(user)))) return new Response("Not found", { status: 404 });
  if (/^https?:\/\//.test(clip.videoUrl)) return Response.redirect(clip.videoUrl, 302);
  const full = resolveMediaPath(clip.videoUrl);
  if (!full) return new Response("Missing media", { status: 404 });
  if (new URL(req.url).searchParams.get("q") === "lite") {
    const lite = litePath(clip.videoUrl);
    if (lite) return serveFile(lite, req, { "Cache-Control": "private, max-age=3600" });
    ensureLite(clip.videoUrl);
  }
  return serveFile(full, req, { "Cache-Control": "private, max-age=3600" });
}
