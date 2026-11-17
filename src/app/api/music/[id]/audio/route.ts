import { getCurrentUser } from "@/lib/auth";
import { resolveMediaPath, serveFile } from "@/lib/files";
import { getTrackFor } from "@/lib/music";

/** The song file, only for its uploader and admins (tap-sync player). Aired versions go through /api/stream. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });
  const t = await getTrackFor(user, id);
  const full = t ? resolveMediaPath(t.audioRef) : null;
  if (!full) return new Response("Not found", { status: 404 });
  return serveFile(full, req, { "Cache-Control": "private, no-store" });
}
