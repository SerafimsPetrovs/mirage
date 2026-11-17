import { getCurrentUser } from "@/lib/auth";
import { getTrackFor } from "@/lib/music";

/** Render status for the progress bar (owner/admin only). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  const t = user ? await getTrackFor(user, id) : null;
  if (!t) return new Response("Not found", { status: 404 });
  return Response.json(
    { status: t.status, progress: t.progress, error: t.error, durationSec: t.durationSec, bpm: t.bpm, clipId: t.clipId },
    { headers: { "Cache-Control": "no-store" } },
  );
}
