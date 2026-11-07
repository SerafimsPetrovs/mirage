import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readyAssetFor, serveSegment, verifyToken } from "@/lib/watermark";

/** One HLS segment. The signed token fixes segment, viewer code and viewer — the variant is chosen here. */
export async function GET(req: Request, ctx: { params: Promise<{ episodeId: string }> }) {
  const { episodeId } = await ctx.params;
  const user = await getCurrentUser();
  const tok = verifyToken(new URL(req.url).searchParams.get("t") ?? "", user?.id ?? "guest");
  if (!tok) return new Response("Forbidden", { status: 403 });
  const ep = await prisma.episode.findUnique({ where: { id: episodeId }, select: { videoUrl: true } });
  const asset = ep && (await readyAssetFor(ep.videoUrl));
  if (!asset || tok.n < 0 || tok.n >= asset.segments) return new Response("Not found", { status: 404 });
  return serveSegment(asset, tok.n, tok.code, req);
}
