import { resolveMediaPath, serveFile } from "@/lib/files";

/** Public images uploaded by creators (posters, backdrops, thumbnails). Videos go through /api/stream. */
export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  if (path[0] !== "images") return new Response("Not found", { status: 404 });
  const full = resolveMediaPath("storage:" + path.join("/"));
  if (!full) return new Response("Not found", { status: 404 });
  return serveFile(full, req, { "Cache-Control": "public, max-age=31536000, immutable" });
}
