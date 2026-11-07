import "server-only";
import { getEpisodeAccess } from "./coins";
import { adultSeriesBlock } from "./spicy";
import type { getCurrentUser } from "./auth";

type User = Awaited<ReturnType<typeof getCurrentUser>>;

/** Same checks for every way an episode's video is delivered (mp4 stream, HLS playlist and segments). */
export async function guardEpisodeStream(user: User, episodeId: string) {
  const res = await getEpisodeAccess(user, episodeId);
  if (!res) return { error: new Response("Not found", { status: 404 }) };
  const { episode, access } = res;
  const isOwner = !!user && (user.role === "ADMIN" || user.id === episode.series.creatorId);
  if (episode.series.status !== "PUBLISHED" && !isOwner) return { error: new Response("Not found", { status: 404 }) };
  if (user?.kidsMode && !episode.series.isFamilySafe) return { error: new Response("Not found", { status: 404 }) };
  if (!isOwner && adultSeriesBlock(user, episode.series)) return { error: new Response("Forbidden", { status: 403 }) };
  if (!access.ok) return { error: new Response("Locked", { status: 403 }) };
  return { episode, isOwner };
}
