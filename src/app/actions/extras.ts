"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { getBalance, getEpisodeAccess, InsufficientCoinsError } from "@/lib/coins";
import { boostPoll, buyScene, buySkin, ChatError, sendChatMessage, spinSkin, unlockPhoto } from "@/lib/extras";
import { CHAT_MAX_LEN, spicyBlock, type SpicyBlock } from "@/lib/spicy";
import { getLocale } from "@/i18n/server";

export type ExtraError = SpicyBlock | "insufficient" | "rate" | "locked" | "nothing" | "closed" | "owner" | "invalid" | "llm" | "unknown";
export type ExtraResult<T = object> = ({ ok: true; balance: number } & T) | { ok: false; error: ExtraError };

function fail(e: unknown): { ok: false; error: ExtraError } {
  if (e instanceof InsufficientCoinsError) return { ok: false, error: "insufficient" };
  if (e instanceof ChatError) return { ok: false, error: e.message === "INSUFFICIENT" ? "insufficient" : e.message === "RATE" ? "rate" : "llm" };
  if (e instanceof Error) {
    const map: Record<string, ExtraError> = { NOTHING_LEFT: "nothing", CLOSED: "closed", OWNER: "owner", INVALID: "invalid", NOT_SENT: "invalid" };
    if (map[e.message]) return { ok: false, error: map[e.message] };
  }
  console.error(e);
  return { ok: false, error: "unknown" };
}

/** Common gate for 18+ add-ons on a series. */
async function gate(user: CurrentUser | null, seriesId: string): Promise<SpicyBlock | "invalid" | null> {
  const s = await prisma.series.findUnique({ where: { id: seriesId }, select: { isFamilySafe: true, status: true } });
  if (!s || s.status !== "PUBLISHED") return "invalid";
  return spicyBlock(user, s);
}

/** "I'm 18+": confirms age and switches 18+ content on. */
export async function confirmAdultAction(): Promise<{ ok: boolean }> {
  return setAdultContentAction(true);
}

/** Toggle 18+ series and fan-service visibility. Turning on records the 18+ self-declaration. */
export async function setAdultContentAction(on: boolean): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || user.kidsMode) return { ok: false };
  await prisma.user.update({
    where: { id: user.id },
    data: on ? { showAdult: true, adultConfirmedAt: user.adultConfirmedAt ?? new Date() } : { showAdult: false },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function boostPollAction(pollId: string, optionId: string, votes: number): Promise<ExtraResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (user.kidsMode) return { ok: false, error: "kids" };
  const n = z.number().int().min(1).max(100).safeParse(votes);
  if (!n.success) return { ok: false, error: "invalid" };
  try {
    await boostPoll(user, pollId, optionId, n.data);
    const poll = await prisma.poll.findUnique({ where: { id: pollId }, select: { series: { select: { slug: true } } } });
    if (poll) revalidatePath(`/series/${poll.series.slug}`);
    revalidatePath("/me/wallet");
    return { ok: true, balance: await getBalance(user.id) };
  } catch (e) {
    return fail(e);
  }
}

async function episodeGate(user: CurrentUser | null, episodeId: string) {
  const res = await getEpisodeAccess(user, episodeId);
  if (!res) return { error: "invalid" as const };
  const g = await gate(user, res.episode.seriesId);
  if (g) return { error: g };
  if (!res.access.ok) return { error: "locked" as const };
  return { error: null };
}

export async function buySkinAction(skinId: string): Promise<ExtraResult> {
  const user = await getCurrentUser();
  const skin = await prisma.skin.findUnique({ where: { id: skinId }, select: { episodeId: true } });
  if (!skin) return { ok: false, error: "invalid" };
  const g = await episodeGate(user, skin.episodeId);
  if (g.error) return { ok: false, error: g.error };
  try {
    await buySkin(user!, skinId);
    return { ok: true, balance: await getBalance(user!.id) };
  } catch (e) {
    return fail(e);
  }
}

export async function spinSkinAction(episodeId: string): Promise<ExtraResult<{ skinId: string }>> {
  const user = await getCurrentUser();
  const g = await episodeGate(user, episodeId);
  if (g.error) return { ok: false, error: g.error };
  try {
    const won = await spinSkin(user!, episodeId);
    return { ok: true, balance: await getBalance(user!.id), skinId: won.id };
  } catch (e) {
    return fail(e);
  }
}

export async function buySceneAction(sceneId: string): Promise<ExtraResult> {
  const user = await getCurrentUser();
  const scene = await prisma.bonusScene.findUnique({ where: { id: sceneId }, select: { episodeId: true } });
  if (!scene) return { ok: false, error: "invalid" };
  const g = await episodeGate(user, scene.episodeId);
  if (g.error) return { ok: false, error: g.error };
  try {
    await buyScene(user!, sceneId);
    return { ok: true, balance: await getBalance(user!.id) };
  } catch (e) {
    return fail(e);
  }
}

export type SentChat = {
  reply: { id: string; body: string; photo: { id: string; price: number; caption: string } | null };
  charged: number;
};

export async function sendChatAction(characterId: string, text: string): Promise<ExtraResult<SentChat>> {
  const user = await getCurrentUser();
  const body = z.string().trim().min(1).max(CHAT_MAX_LEN).safeParse(text);
  if (!body.success) return { ok: false, error: "invalid" };
  const c = await prisma.character.findUnique({ where: { id: characterId }, select: { seriesId: true } });
  if (!c) return { ok: false, error: "invalid" };
  const g = await gate(user, c.seriesId);
  if (g) return { ok: false, error: g };
  const locale = await getLocale();
  try {
    const r = await sendChatMessage(user!, characterId, body.data, locale);
    return {
      ok: true,
      balance: await getBalance(user!.id),
      charged: r.charged,
      reply: {
        id: r.reply.id,
        body: r.reply.body,
        photo: r.reply.photo
          ? { id: r.reply.photo.id, price: r.reply.photo.price, caption: locale === "en" ? r.reply.photo.captionEn || r.reply.photo.captionRu : r.reply.photo.captionRu }
          : null,
      },
    };
  } catch (e) {
    return fail(e);
  }
}

export async function unlockPhotoAction(photoId: string): Promise<ExtraResult> {
  const user = await getCurrentUser();
  const p = await prisma.characterPhoto.findUnique({ where: { id: photoId }, select: { character: { select: { seriesId: true } } } });
  if (!p) return { ok: false, error: "invalid" };
  const g = await gate(user, p.character.seriesId);
  if (g) return { ok: false, error: g };
  try {
    await unlockPhoto(user!, photoId);
    return { ok: true, balance: await getBalance(user!.id) };
  } catch (e) {
    return fail(e);
  }
}
