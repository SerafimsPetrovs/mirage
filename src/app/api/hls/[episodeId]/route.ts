import { getCurrentUser } from "@/lib/auth";
import { guardEpisodeStream } from "@/lib/stream-guard";
import { personalPlaylist, readyAssetFor, sessionCode } from "@/lib/watermark";

/** Personal HLS playlist with the viewer's forensic watermark sequence (see lib/watermark.ts). */
export async function GET(_req: Request, ctx: { params: Promise<{ episodeId: string }> }) {
  const { episodeId } = await ctx.params;
  const user = await getCurrentUser();
  const g = await guardEpisodeStream(user, episodeId);
  if (g.error) return g.error;
  const asset = await readyAssetFor(g.episode.videoUrl);
  if (!asset) return new Response("Not ready", { status: 404 });
  const code = await sessionCode(asset.id, user?.id ?? null);
  return new Response(personalPlaylist(asset, episodeId, code, user?.id ?? "guest"), {
    headers: { "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "private, no-store" },
  });
}
