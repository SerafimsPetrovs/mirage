"use server";
import { invalidateBuffers, uploadZone } from "@/lib/tv-control";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { runLtxJob } from "@/lib/video-gen";
import { addIdea, airIdea, breakIn, channelSchema, deleteClip, filmIdea, muteFromMessage, muteUser, rewriteNow, saveChannel, suggestIdeas, techBreak, updateClip } from "@/lib/tv-admin";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { logAdmin } from "@/lib/admin-log";
import { createClip, hideTicker, hideTvMessage, moderateClip, moderateOrder, rebuildRestOfDay, TvError } from "@/lib/tv";

type R = { ok: true } | { ok: false; error: string };

async function admin() {
  const u = await getCurrentUser();
  if (!u || u.kidsMode || u.role !== "ADMIN") throw new TvError("AUTH");
  return u;
}

function fail(e: unknown): R {
  if (e instanceof TvError) return { ok: false, error: e.code };
  console.error("[tv admin]", e);
  return { ok: false, error: "unknown" };
}

const id = z.string().min(1).max(64);

export async function moderateTvOrderAction(orderId: string, decision: "approve" | "reject", reason = ""): Promise<R> {
  try {
    const a = await admin();
    await moderateOrder(id.parse(orderId), decision === "approve" ? "approve" : "reject", String(reason).slice(0, 300));
    await logAdmin(a.id, `tv_order_${decision}`, "TV_ORDER", orderId, reason);
    revalidatePath("/admin/tv");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function moderateTvClipAction(clipId: string, decision: "approve" | "reject"): Promise<R> {
  try {
    const a = await admin();
    await moderateClip(id.parse(clipId), decision === "approve" ? "approve" : "reject");
    await logAdmin(a.id, `tv_clip_${decision}`, "TV_CLIP", clipId);
    revalidatePath("/admin/tv");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function rebuildTvChannelAction(channelId: string): Promise<R> {
  try {
    const a = await admin();
    await rebuildRestOfDay(id.parse(channelId));
    await logAdmin(a.id, "tv_rebuild", "TV_CHANNEL", channelId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function hideTvItemAction(kind: "message" | "ticker", itemId: string): Promise<R> {
  try {
    const a = await admin();
    if (kind === "ticker") await hideTicker(id.parse(itemId));
    else await hideTvMessage(id.parse(itemId));
    await logAdmin(a.id, `tv_hide_${kind}`, kind === "ticker" ? "TV_TICKER" : "TV_MESSAGE", itemId);
    revalidatePath("/admin/tv");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const clipSchema = z.object({
  channelId: z.string().min(1).max(64),
  kind: z.enum(["SHOW", "BUMPER", "AD", "MUSIC"]),
  title: z.string().max(200),
  artist: z.string().max(200).default(""),
  videoRef: z.string().max(200),
  orientation: z.enum(["VERTICAL", "HORIZONTAL"]),
  seriesId: z.string().max(64).nullable().optional(),
  lore: z.string().max(2000).optional(),
  prompts: z.string().max(4000).optional(),
  aiTools: z.string().max(400).optional(),
  tags: z.string().max(400).optional(),
  ageRating: z.string().max(4).optional(),
  captions: z.string().max(40_000).optional(),
});

/** Creators (moderated) and admins (approved at once) add a TV clip to a channel. */
export async function createTvClipAction(input: unknown): Promise<R> {
  const parsed = clipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const u = await getCurrentUser();
    if (!u) throw new TvError("AUTH");
    // Bounty: the channel's zone at upload time decides the reward when moderation accepts the clip.
    const zone = u.role === "ADMIN" ? "" : await uploadZone(parsed.data.channelId);
    const clip = await createClip(u, parsed.data, { zone });
    invalidateBuffers();
    // Admin uploads are approved at once: put them into today's schedule now.
    if (clip.status === "APPROVED") await rebuildRestOfDay(clip.channelId).catch((e) => console.error("[tv rebuild]", e));
    revalidatePath("/studio/tv");
    revalidatePath("/admin/tv");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ───────────── v2 admin ─────────────

async function adminRun(action: string, target: string, id: string, fn: () => Promise<unknown>, details: string | Record<string, unknown> = ""): Promise<R> {
  try {
    const a = await admin();
    await fn();
    await logAdmin(a.id, action, target, id, details);
    revalidatePath("/admin/tv", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "invalid" };
    return fail(e);
  }
}

export async function saveTvChannelAction(input: unknown): Promise<R> {
  const parsed = channelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return adminRun("tv_channel_save", "TV_CHANNEL", parsed.data.id ?? parsed.data.slug, () => saveChannel(parsed.data), { slug: parsed.data.slug });
}

export async function techBreakAction(slotId: string): Promise<R> {
  return adminRun("tv_tech_break", "TV_SLOT", slotId, () => techBreak(id.parse(slotId)));
}

export async function breakInAction(clipId: string): Promise<R> {
  return adminRun("tv_break_in", "TV_CLIP", clipId, () => breakIn(id.parse(clipId)));
}

export async function rewriteHostsAction(channelId: string): Promise<R & { rewritten?: boolean }> {
  let rewritten = false;
  const r = await adminRun("tv_rewrite_hosts", "TV_CHANNEL", channelId, async () => (rewritten = await rewriteNow(id.parse(channelId))));
  return r.ok ? { ok: true, rewritten } : r;
}

const clipEdit = z.object({ title: z.string().max(200).optional(), artist: z.string().max(200).optional(), kind: z.string().max(10).optional(), status: z.string().max(10).optional() });

export async function updateTvClipAction(clipId: string, input: unknown): Promise<R> {
  const parsed = clipEdit.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return adminRun("tv_clip_update", "TV_CLIP", clipId, () => updateClip(id.parse(clipId), parsed.data), parsed.data);
}

export async function deleteTvClipAction(clipId: string): Promise<R> {
  return adminRun("tv_clip_delete", "TV_CLIP", clipId, () => deleteClip(id.parse(clipId)));
}

export async function suggestIdeasAction(channelId: string): Promise<R> {
  return adminRun("tv_factory_suggest", "TV_CHANNEL", channelId, () => suggestIdeas(id.parse(channelId)));
}

export async function addIdeaAction(channelId: string, title: string, prompt: string, kind: string): Promise<R> {
  return adminRun("tv_factory_add", "TV_CHANNEL", channelId, () => addIdea(id.parse(channelId), String(title ?? ""), String(prompt ?? ""), String(kind ?? "SHOW")));
}

export async function filmIdeaAction(itemId: string): Promise<R> {
  try {
    const a = await admin();
    const job = await filmIdea(id.parse(itemId), a.id);
    if (job.provider !== "mock") after(() => runLtxJob(job.id));
    await logAdmin(a.id, "tv_factory_film", "TV_FACTORY", itemId);
    revalidatePath("/admin/tv", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function airIdeaAction(itemId: string): Promise<R> {
  return adminRun("tv_factory_air", "TV_FACTORY", itemId, () => airIdea(id.parse(itemId)));
}

export async function deleteIdeaAction(itemId: string): Promise<R> {
  return adminRun("tv_factory_delete", "TV_FACTORY", itemId, () => prisma.tvFactoryItem.delete({ where: { id: id.parse(itemId) } }));
}

export async function muteTvUserAction(userId: string, hours: number | null): Promise<R> {
  return adminRun("tv_mute", "USER", userId, () => muteUser(id.parse(userId), hours == null ? null : Number(hours)), { hours });
}

/** From the TV chat itself: mute the author for 24 h and hide the message. */
export async function muteFromChatAction(messageId: string): Promise<R> {
  return adminRun("tv_mute_chat", "TV_MESSAGE", messageId, () => muteFromMessage(id.parse(messageId)));
}
