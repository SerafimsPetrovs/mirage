"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { InsufficientCoinsError } from "@/lib/coins";
import { logAdmin } from "@/lib/admin-log";
import { createTrack, moderateTrack, orderTrack, queueRender, saveTimings, setStyle } from "@/lib/music";
import { MUSIC_STYLES } from "@/lib/music-rules";
import { TvError } from "@/lib/tv";

export type MusicResult<T = object> = ({ ok: true } & T) | { ok: false; error: TvError["code"] | "insufficient" | "invalid" | "unknown" };

function fail(e: unknown): { ok: false; error: TvError["code"] | "insufficient" | "unknown" } {
  if (e instanceof TvError) return { ok: false, error: e.code };
  if (e instanceof InsufficientCoinsError) return { ok: false, error: "insufficient" };
  console.error("[music action]", e);
  return { ok: false, error: "unknown" };
}

const trackSchema = z.object({
  channelId: z.string().min(1).max(64),
  title: z.string().max(200),
  artist: z.string().max(200),
  audioRef: z.string().max(200),
  coverRef: z.string().max(200).nullable().optional(),
  images: z.array(z.string().max(200)).max(20).optional(),
  lyrics: z.string().max(20_000).optional(),
  style: z.enum(MUSIC_STYLES),
  orientation: z.enum(["HORIZONTAL", "VERTICAL"]).optional(),
  rightsOk: z.boolean(),
});

/** Admin / creator: new track (draft). A viewer with `order` pays MUSIC_ORDER_PRICE coins instead. */
export async function createTrackAction(input: unknown, order = false): Promise<MusicResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user || user.banned) return { ok: false, error: "AUTH" };
  const p = trackSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  try {
    const isStaff = user.role === "ADMIN" || user.role === "CREATOR";
    const t = order || !isStaff ? (await orderTrack(user, p.data)).track : await createTrack(user, p.data);
    revalidatePath("/music");
    return { ok: true, id: t.id };
  } catch (e) {
    return fail(e);
  }
}

const idSchema = z.string().min(1).max(64);

export async function saveTimingsAction(id: string, lines: unknown, lyrics?: string): Promise<MusicResult<{ count: number }>> {
  const user = await getCurrentUser();
  if (!user || !idSchema.safeParse(id).success) return { ok: false, error: "AUTH" };
  try {
    const clean = await saveTimings(user, id, lines, typeof lyrics === "string" ? lyrics : undefined);
    revalidatePath(`/music/${id}`);
    return { ok: true, count: clean.length };
  } catch (e) {
    return fail(e);
  }
}

export async function setStyleAction(id: string, style: string): Promise<MusicResult> {
  const user = await getCurrentUser();
  if (!user || !idSchema.safeParse(id).success) return { ok: false, error: "AUTH" };
  try {
    await setStyle(user, id, style);
    revalidatePath(`/music/${id}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Render now (staff) or send to moderation (viewer orders). */
export async function renderTrackAction(id: string): Promise<MusicResult<{ status: "QUEUED" | "REVIEW" }>> {
  const user = await getCurrentUser();
  if (!user || !idSchema.safeParse(id).success) return { ok: false, error: "AUTH" };
  try {
    const status = await queueRender(user, id);
    revalidatePath(`/music/${id}`);
    revalidatePath("/admin/tv/music");
    return { ok: true, status };
  } catch (e) {
    return fail(e);
  }
}

export async function moderateTrackAction(id: string, decision: "approve" | "reject", reason = ""): Promise<MusicResult> {
  const user = await getCurrentUser();
  if (!user || user.kidsMode || user.role !== "ADMIN") return { ok: false, error: "AUTH" };
  if (!idSchema.safeParse(id).success || (decision !== "approve" && decision !== "reject")) return { ok: false, error: "invalid" };
  try {
    await moderateTrack(id, decision, String(reason ?? "").slice(0, 300));
    await logAdmin(user.id, `music.${decision}`, "music", id, { reason });
    revalidatePath("/admin/tv/music");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
