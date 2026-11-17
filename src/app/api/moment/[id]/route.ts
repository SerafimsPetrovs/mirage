import { prisma } from "@/lib/db";
import { resolveMediaPath, serveFile } from "@/lib/files";

/** Public moment clip (it was cut from the free live broadcast). `?status=1` = JSON status for the "cutting…" page. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const m = await prisma.tvMoment.findUnique({ where: { id: id.slice(0, 40) } });
  if (!m) return new Response("Not found", { status: 404 });
  if (new URL(req.url).searchParams.get("status") === "1") return Response.json({ status: m.status }, { headers: { "Cache-Control": "no-store" } });
  const full = m.videoRef ? resolveMediaPath(m.videoRef) : null;
  if (!full) return new Response("Not ready", { status: 404 });
  return serveFile(full, req, { "Cache-Control": "public, max-age=86400" });
}
