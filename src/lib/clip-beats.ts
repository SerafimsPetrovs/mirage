import "server-only";
import { prisma } from "./db";
import { resolveMediaPath } from "./files";
import { enqueue, registerJob } from "./jobs";
import { parseBeatMap, type BeatMap } from "./music-rules";

/**
 * Beat maps of music videos on TV: tempo + drops, so the watch buddy can rave in time.
 * Rendered tracks get one at render time; older / uploaded music clips are analysed once in the background
 * the first time they air.
 */
const asked = new Set<string>();

/** The clip's beat map, or null (and a background analysis is queued once if it was never done). */
export function clipBeatMap(clip: { id: string; kind: string; beatJson: string }): BeatMap | null {
  if (clip.kind !== "MUSIC") return null;
  if (clip.beatJson === "" && !asked.has(clip.id)) {
    asked.add(clip.id);
    void enqueue("clip.beats", { clipId: clip.id }).catch(() => asked.delete(clip.id));
  }
  return parseBeatMap(clip.beatJson);
}

/** Analyses `file` (song or video) and stores the map on the clip; "-" when there's nothing to analyse. */
export async function analyzeClipBeats(clipId: string, fileRef?: string) {
  const clip = await prisma.tvClip.findUnique({ where: { id: clipId }, select: { videoUrl: true, kind: true } });
  if (!clip || clip.kind !== "MUSIC") return;
  const file = resolveMediaPath(fileRef ?? clip.videoUrl);
  let json = "-";
  if (file) {
    try {
      const { beatMapOf } = await import("./music-render"); // heavy (ffmpeg, LLM, video gen): only when analysing
      json = JSON.stringify(await beatMapOf(file));
    } catch (e) {
      console.error("[clip beats]", clipId, e instanceof Error ? e.message : e);
    }
  }
  await prisma.tvClip.update({ where: { id: clipId }, data: { beatJson: json } });
}

registerJob("clip.beats", async (p) => {
  await analyzeClipBeats(String(p.clipId));
});
