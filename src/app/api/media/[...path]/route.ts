import { resolveMediaPath, serveFile } from "@/lib/files";

/** Plain file names only: an encoded "/" or ".." inside a segment must never climb out of storage/images. */
const SAFE_SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/;

/** Public images uploaded by creators (posters, backdrops, thumbnails). Videos go through /api/stream. */
export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const rest = path.slice(1);
  if (path[0] !== "images" || rest.length === 0 || !rest.every((s) => SAFE_SEGMENT.test(s) && !s.includes(".."))) {
    return new Response("Not found", { status: 404 });
  }
  const full = resolveMediaPath("storage:images/" + rest.join("/"));
  if (!full) return new Response("Not found", { status: 404 });
  return serveFile(full, req, { "Cache-Control": "public, max-age=31536000, immutable" });
}
