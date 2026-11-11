import { prisma } from "@/lib/db";
import { resolveMediaPath, serveFile } from "@/lib/files";

/** A mascot loop from the clip bank (public brand asset). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const clip = await prisma.mascotClip.findUnique({ where: { id } });
  if (!clip || !clip.active) return new Response("Not found", { status: 404 });
  if (/^https?:\/\//.test(clip.url)) return Response.redirect(clip.url, 302);
  const full = resolveMediaPath(clip.url);
  if (!full) return new Response("Missing media", { status: 404 });
  return serveFile(full, req, { "Cache-Control": "public, max-age=86400" });
}
