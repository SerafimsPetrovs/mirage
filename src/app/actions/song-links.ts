"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { findSongs, SongLinkError, tagSong, untagSong } from "@/lib/song-links";

type Code = SongLinkError["code"] | "unknown";
export type LinkResult = { ok: true } | { ok: false; error: Code };

async function editor() {
  const u = await getCurrentUser();
  if (!u || (u.role !== "CREATOR" && u.role !== "ADMIN")) throw new SongLinkError("AUTH");
  return u;
}

function fail(e: unknown): { ok: false; error: Code } {
  if (e instanceof SongLinkError) return { ok: false, error: e.code };
  console.error("[song links]", e);
  return { ok: false, error: "unknown" };
}

const tagInput = z.object({ episodeId: z.string().min(1).max(40), songId: z.string().min(1).max(40), atSec: z.number().min(0).max(36_000), lenSec: z.number().min(5).max(600) });

/** Studio: "this song plays in this episode from atSec". */
export async function tagSongAction(raw: unknown): Promise<LinkResult> {
  const p = tagInput.safeParse(raw);
  if (!p.success) return { ok: false, error: "INVALID" };
  try {
    await tagSong(await editor(), p.data);
    revalidatePath("/studio", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function untagSongAction(useId: string): Promise<LinkResult> {
  try {
    await untagSong(await editor(), String(useId).slice(0, 40));
    revalidatePath("/studio", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Studio picker: published songs by title / artist. */
export async function findSongsAction(q: string) {
  try {
    await editor();
  } catch {
    return [];
  }
  const rows = await findSongs(String(q ?? ""));
  return rows.map((r) => ({ id: r.id, title: r.title, artist: r.artist || r.user.name, durationSec: r.durationSec }));
}
