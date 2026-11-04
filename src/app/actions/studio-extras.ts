"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { RARITIES } from "@/lib/spicy";

type Res = { ok: true } | { ok: false; error: string };

/** Creator/admin who owns the series; 18+ add-ons are never allowed on family-safe series. */
async function ownSeries(seriesId: string) {
  const user = await getCurrentUser();
  if (!user || user.kidsMode || (user.role !== "CREATOR" && user.role !== "ADMIN")) throw new Error("forbidden");
  const s = await prisma.series.findUnique({ where: { id: seriesId } });
  if (!s || (s.creatorId !== user.id && user.role !== "ADMIN")) throw new Error("forbidden");
  if (s.isFamilySafe) throw new Error("family");
  return s;
}

async function ownEpisode(episodeId: string) {
  const ep = await prisma.episode.findUnique({ where: { id: episodeId }, select: { seriesId: true } });
  if (!ep) throw new Error("forbidden");
  await ownSeries(ep.seriesId);
  return ep;
}

async function ownCharacter(characterId: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId }, select: { seriesId: true } });
  if (!c) throw new Error("forbidden");
  await ownSeries(c.seriesId);
  return c;
}

const videoRef = z.string().trim().min(1).max(500).refine((v) => v.startsWith("storage:videos/") || /^https:\/\//.test(v), "Invalid video");
const privateImage = z.string().trim().min(1).max(500).refine((v) => v.startsWith("storage:private/"), "Invalid image");
const publicImage = z.string().trim().max(500).refine((v) => v === "" || v.startsWith("storage:images/"), "Invalid image");

async function wrap(fn: () => Promise<string | void>): Promise<Res> {
  try {
    const path = await fn();
    if (path) revalidatePath(path);
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "invalid" };
    return { ok: false, error: e instanceof Error ? e.message : "error" };
  }
}

export async function addSkinAction(episodeId: string, input: Record<string, string>) {
  return wrap(async () => {
    const ep = await ownEpisode(episodeId);
    const d = z
      .object({
        nameRu: z.string().trim().min(1).max(40),
        nameEn: z.string().trim().max(40),
        emoji: z.string().trim().min(1).max(8),
        rarity: z.enum(RARITIES),
        videoUrl: videoRef,
        price: z.coerce.number().int().min(1).max(500),
      })
      .parse(input);
    await prisma.skin.create({ data: { ...d, nameEn: d.nameEn || d.nameRu, episodeId } });
    return `/studio/series/${ep.seriesId}`;
  });
}

export async function deleteSkinAction(skinId: string) {
  return wrap(async () => {
    const skin = await prisma.skin.findUniqueOrThrow({ where: { id: skinId }, select: { episodeId: true } });
    const ep = await ownEpisode(skin.episodeId);
    await prisma.skin.delete({ where: { id: skinId } });
    return `/studio/series/${ep.seriesId}`;
  });
}

export async function saveSceneAction(episodeId: string, input: Record<string, string>) {
  return wrap(async () => {
    const ep = await ownEpisode(episodeId);
    const d = z
      .object({
        titleRu: z.string().trim().min(1).max(80),
        titleEn: z.string().trim().max(80),
        videoUrl: videoRef,
        durationSec: z.coerce.number().int().min(5).max(600),
        price: z.coerce.number().int().min(1).max(500),
        triggerAtSec: z.union([z.literal(""), z.coerce.number().int().min(0).max(4 * 3600)]),
      })
      .parse(input);
    const data = { ...d, titleEn: d.titleEn || d.titleRu, triggerAtSec: d.triggerAtSec === "" ? null : d.triggerAtSec };
    await prisma.bonusScene.upsert({ where: { episodeId }, create: { ...data, episodeId }, update: data });
    return `/studio/series/${ep.seriesId}`;
  });
}

export async function deleteSceneAction(episodeId: string) {
  return wrap(async () => {
    const ep = await ownEpisode(episodeId);
    await prisma.bonusScene.deleteMany({ where: { episodeId } });
    return `/studio/series/${ep.seriesId}`;
  });
}

export async function saveCharacterAction(seriesId: string, input: Record<string, string>) {
  return wrap(async () => {
    await ownSeries(seriesId);
    const d = z
      .object({
        id: z.string().optional(),
        nameRu: z.string().trim().min(1).max(40),
        nameEn: z.string().trim().max(40),
        taglineRu: z.string().trim().max(120),
        taglineEn: z.string().trim().max(120),
        greetingRu: z.string().trim().max(400),
        greetingEn: z.string().trim().max(400),
        persona: z.string().trim().min(20).max(4000),
        // Hard platform rule: chat characters are adults.
        age: z.coerce.number().int().min(18, "age_18").max(150),
        avatarUrl: publicImage,
        hue: z.coerce.number().int().min(0).max(360),
      })
      .parse(input);
    const { id, ...rest } = d;
    const data = { ...rest, nameEn: d.nameEn || d.nameRu, avatarUrl: d.avatarUrl || null };
    if (id) {
      const c = await ownCharacter(id);
      if (c.seriesId !== seriesId) throw new Error("forbidden");
      await prisma.character.update({ where: { id }, data });
    } else await prisma.character.create({ data: { ...data, seriesId } });
    return `/studio/series/${seriesId}`;
  });
}

export async function deleteCharacterAction(characterId: string) {
  return wrap(async () => {
    const c = await ownCharacter(characterId);
    await prisma.character.delete({ where: { id: characterId } });
    return `/studio/series/${c.seriesId}`;
  });
}

export async function addPhotoAction(characterId: string, input: Record<string, string>) {
  return wrap(async () => {
    const c = await ownCharacter(characterId);
    const d = z
      .object({
        imageUrl: privateImage,
        captionRu: z.string().trim().max(120),
        captionEn: z.string().trim().max(120),
        price: z.coerce.number().int().min(1).max(500),
      })
      .parse(input);
    const count = await prisma.characterPhoto.count({ where: { characterId } });
    if (count >= 8) throw new Error("max_8");
    await prisma.characterPhoto.create({ data: { ...d, captionEn: d.captionEn || d.captionRu, characterId, order: count } });
    return `/studio/series/${c.seriesId}`;
  });
}

export async function deletePhotoAction(photoId: string) {
  return wrap(async () => {
    const p = await prisma.characterPhoto.findUniqueOrThrow({ where: { id: photoId }, select: { characterId: true } });
    const c = await ownCharacter(p.characterId);
    await prisma.characterPhoto.delete({ where: { id: photoId } });
    return `/studio/series/${c.seriesId}`;
  });
}
