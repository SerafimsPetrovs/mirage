"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/i18n/server";
import { logAdmin } from "@/lib/admin-log";
import { TvError, fileDuration } from "@/lib/tv";
import { addAlert, forcePlayNow, injectMascot, panicSlot, playNext, reorderQueue, setBountyBoost, stopAlert } from "@/lib/tv-control";
import { EMOTIONS, TONES } from "@/lib/mascot";

type R = { ok: true } | { ok: false; error: string };

const id = z.string().min(1).max(64);

/** Every control-room action: admin only, logged in the admin journal. */
async function run(action: string, target: string, targetId: string, fn: () => Promise<unknown>, details: string | Record<string, unknown> = ""): Promise<R> {
  try {
    const u = await getCurrentUser();
    if (!u || u.kidsMode || u.role !== "ADMIN") throw new TvError("AUTH");
    await fn();
    await logAdmin(u.id, action, target, targetId, details);
    revalidatePath("/admin/live-control");
    return { ok: true };
  } catch (e) {
    if (e instanceof TvError) return { ok: false, error: e.code };
    if (e instanceof z.ZodError) return { ok: false, error: "invalid" };
    console.error("[live control]", e);
    return { ok: false, error: "unknown" };
  }
}

export async function panicAction(slotId: string): Promise<R> {
  return run("tv_panic", "TV_SLOT", slotId, () => panicSlot(id.parse(slotId)));
}

export async function reorderAction(channelId: string, ids: string[]): Promise<R> {
  return run("tv_reorder", "TV_CHANNEL", channelId, () => reorderQueue(id.parse(channelId), z.array(id).max(200).parse(ids)), { n: ids.length });
}

const item = z.object({ type: z.enum(["CLIP", "EPISODE"]), id });

export async function playNextAction(channelId: string, it: unknown): Promise<R> {
  const parsed = item.safeParse(it);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return run("tv_play_next", "TV_CHANNEL", channelId, () => playNext(id.parse(channelId), parsed.data), parsed.data);
}

export async function forceNowAction(channelId: string, it: unknown): Promise<R> {
  const parsed = item.safeParse(it);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return run("tv_force_now", "TV_CHANNEL", channelId, () => forcePlayNow(id.parse(channelId), parsed.data), parsed.data);
}

export async function bountyBoostAction(channelId: string, hours: number | null): Promise<R> {
  const h = hours === null ? null : z.number().int().min(1).max(168).parse(hours);
  return run("tv_bounty_boost", "TV_CHANNEL", channelId, () => setBountyBoost(id.parse(channelId), h), { hours: h });
}

export async function alertAction(channelId: string | null, text: string, minutes: number): Promise<R> {
  return run("tv_alert", "TV_CHANNEL", channelId ?? "ALL", () => addAlert(channelId ? id.parse(channelId) : null, z.string().max(400).parse(text), z.number().min(1).max(1440).parse(minutes)), { text });
}

export async function stopAlertAction(alertId: string): Promise<R> {
  return run("tv_alert_stop", "TV_ALERT", alertId, () => stopAlert(id.parse(alertId)));
}

const prompter = z.object({
  channelId: id.nullable(),
  text: z.string().min(1).max(1200),
  mode: z.enum(["PIP", "BREAKING"]),
  tone: z.enum(TONES),
});

/** 🔴 ON AIR: the mascot reads the admin's text (corner window or breaking-news slot). */
export async function injectAction(input: unknown): Promise<R> {
  const parsed = prompter.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const locale = await getLocale();
  return run("tv_prompter", "TV_CHANNEL", parsed.data.channelId ?? "ALL", () => injectMascot({ ...parsed.data, locale }), { mode: parsed.data.mode, tone: parsed.data.tone, text: parsed.data.text.slice(0, 200) });
}

// ───────────── mascot clip bank ─────────────

export async function addMascotClipAction(emotion: string, ref: string): Promise<R> {
  return run("mascot_clip_add", "MASCOT", emotion, async () => {
    const e = z.enum(EMOTIONS).parse(emotion);
    if (!/^storage:videos\/[\w.-]+$/.test(ref)) throw new TvError("STATE");
    const sec = await fileDuration(ref);
    await prisma.mascotClip.create({ data: { emotion: e, url: ref, durationMs: sec > 0 ? Math.round(sec * 1000) : 800 } });
  });
}

export async function deleteMascotClipAction(clipId: string): Promise<R> {
  return run("mascot_clip_delete", "MASCOT", clipId, () => prisma.mascotClip.deleteMany({ where: { id: id.parse(clipId) } }));
}
