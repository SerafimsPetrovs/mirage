import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveMediaPath, serveFile } from "@/lib/files";

/** Song audio (Range support for seeking to the hook). Published songs are public; hidden ones only for the author/admins. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = await prisma.song.findUnique({ where: { id: id.slice(0, 40) }, select: { audioRef: true, status: true, userId: true } });
  if (!s) return new Response("Not found", { status: 404 });
  if (s.status !== "PUBLISHED") {
    const user = await getCurrentUser();
    if (!user || (user.id !== s.userId && user.role !== "ADMIN")) return new Response("Not found", { status: 404 });
  }
  const full = resolveMediaPath(s.audioRef);
  if (!full) return new Response("Not found", { status: 404 });
  return serveFile(full, req, { "Cache-Control": "public, max-age=86400" });
}
