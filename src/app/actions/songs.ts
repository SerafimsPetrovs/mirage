"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { logAdmin } from "@/lib/admin-log";
import { createSong, hideSong, hookHeard, sendSongToAir, SongError, songPlayed, toggleSave } from "@/lib/songs";

export type SongResult<T = object> = ({ ok: true } & T) | { ok: false; error: SongError["code"] | "unknown" };

function fail(e: unknown): { ok: false; error: SongError["code"] | "unknown" } {
  if (e instanceof SongError) return { ok: false, error: e.code };
  console.error("[songs action]", e);
  return { ok: false, error: "unknown" };
}

const input = z.object({
  title: z.string().max(200),
  artist: z.string().max(200),
  genre: z.string().max(30),
  audioRef: z.string().max(200),
  coverRef: z.string().max(200).nullable().optional(),
  lyrics: z.string().max(20_000).optional(),
  hookStart: z.number().min(0).max(36_000),
  aiTool: z.string().max(20),
  rightsOk: z.boolean(),
});
const id = z.string().min(1).max(40);

export async function createSongAction(raw: unknown): Promise<SongResult<{ id: string }>> {
  const p = input.safeParse(raw);
  if (!p.success) return { ok: false, error: "INVALID" };
  try {
    const s = await createSong(await getCurrentUser(), p.data);
    revalidatePath("/songs/library");
    return { ok: true, id: s.id };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleSaveAction(songId: string): Promise<SongResult<{ saved: boolean }>> {
  if (!id.safeParse(songId).success) return { ok: false, error: "INVALID" };
  try {
    const saved = await toggleSave(await getCurrentUser(), songId);
    revalidatePath("/songs/library");
    return { ok: true, saved };
  } catch (e) {
    return fail(e);
  }
}

/** Fire-and-forget counters from the feed / player. */
export async function hookHeardAction(songId: string) {
  if (id.safeParse(songId).success) await hookHeard(await getCurrentUser(), songId).catch(() => {});
}
export async function songPlayedAction(songId: string) {
  if (id.safeParse(songId).success) await songPlayed(songId).catch(() => {});
}

export async function sendSongToAirAction(songId: string, channelId: string, style: string): Promise<SongResult<{ trackId: string }>> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return { ok: false, error: "AUTH" };
  try {
    const trackId = await sendSongToAir(user, String(songId), String(channelId), String(style));
    await logAdmin(user.id, "song.air", "song", String(songId), { channelId, style });
    revalidatePath("/songs/chart");
    return { ok: true, trackId };
  } catch (e) {
    return fail(e);
  }
}

export async function hideSongAction(songId: string, hidden: boolean): Promise<SongResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return { ok: false, error: "AUTH" };
  try {
    await hideSong(user, String(songId), !!hidden);
    await logAdmin(user.id, hidden ? "song.hide" : "song.show", "song", String(songId));
    revalidatePath("/songs/chart");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
