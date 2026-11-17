import { getCurrentUser } from "@/lib/auth";
import { resolveMediaPath, serveFile } from "@/lib/files";
import { getTrackFor } from "@/lib/music";

/** Preview of the rendered music video for its uploader and admins (before/after moderation). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  const t = user ? await getTrackFor(user, id) : null;
  const full = t?.videoRef ? resolveMediaPath(t.videoRef) : null;
  if (!full) return new Response("Not found", { status: 404 });
  return serveFile(full, req, { "Cache-Control": "private, no-store" });
}
