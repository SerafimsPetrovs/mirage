"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { FormState } from "./auth";

async function requireCreator() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "CREATOR" && user.role !== "ADMIN")) throw new Error("FORBIDDEN");
  return user;
}

async function requireOwnSeries(seriesId: string) {
  const user = await requireCreator();
  const s = await prisma.series.findUnique({ where: { id: seriesId } });
  if (!s || (s.creatorId !== user.id && user.role !== "ADMIN")) throw new Error("FORBIDDEN");
  return { user, series: s };
}

const mediaRef = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || v.startsWith("storage:images/") || /^https:\/\//.test(v), "Invalid media");

const seriesSchema = z.object({
  titleRu: z.string().trim().min(1).max(120),
  titleEn: z.string().trim().max(120),
  taglineRu: z.string().trim().max(200),
  taglineEn: z.string().trim().max(200),
  descriptionRu: z.string().trim().min(1).max(4000),
  descriptionEn: z.string().trim().max(4000),
  orientation: z.enum(["VERTICAL", "HORIZONTAL"]),
  genres: z.array(z.string().max(30)).max(6),
  moods: z.array(z.string().max(30)).max(6),
  aiModels: z.string().trim().max(300),
  promptNotesRu: z.string().trim().max(3000),
  promptNotesEn: z.string().trim().max(3000),
  ageRating: z.enum(["0+", "6+", "12+", "16+", "18+"]),
  freeEpisodes: z.coerce.number().int().min(0).max(50),
  defaultCoinPrice: z.coerce.number().int().min(1).max(500),
  hue: z.coerce.number().int().min(0).max(360),
  posterUrl: mediaRef,
  backdropUrl: mediaRef,
});

function slugify(s: string) {
  const map: Record<string, string> = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ы: "y", э: "e", ю: "yu", я: "ya" };
  return (
    s
      .toLowerCase()
      .split("")
      .map((c) => map[c] ?? c)
      .join("")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "series"
  );
}

export async function saveSeriesAction(_: FormState, form: FormData): Promise<FormState> {
  let user;
  try {
    user = await requireCreator();
  } catch {
    return { error: "forbidden" };
  }
  const parsed = seriesSchema.safeParse({
    ...Object.fromEntries(form.entries()),
    genres: form.getAll("genres"),
    moods: form.getAll("moods"),
  });
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { error: `${i.path.join(".")}: ${i.message}` };
  }
  const d = parsed.data;
  const data = {
    ...d,
    titleEn: d.titleEn || d.titleRu,
    descriptionEn: d.descriptionEn || d.descriptionRu,
    genres: d.genres.join(","),
    moods: d.moods.join(","),
    aiModels: d.aiModels.split(",").map((x) => x.trim()).filter(Boolean).join(","),
    posterUrl: d.posterUrl || null,
    backdropUrl: d.backdropUrl || null,
  };
  const id = form.get("id");
  if (typeof id === "string" && id) {
    try {
      await requireOwnSeries(id);
    } catch {
      return { error: "forbidden" };
    }
    const s = await prisma.series.update({ where: { id }, data });
    revalidatePath(`/studio/series/${id}`);
    revalidatePath(`/series/${s.slug}`);
    return { ok: true };
  }
  let slug = slugify(d.titleEn || d.titleRu);
  if (await prisma.series.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  const s = await prisma.series.create({ data: { ...data, slug, creatorId: user.id, status: "DRAFT" } });
  redirect(`/studio/series/${s.id}`);
}

const episodeSchema = z.object({
  titleRu: z.string().trim().max(120),
  titleEn: z.string().trim().max(120),
  videoUrl: z.string().trim().min(1).max(500).refine((v) => v.startsWith("storage:videos/") || /^https:\/\//.test(v), "Invalid video"),
  durationSec: z.coerce.number().int().min(1).max(4 * 3600),
  coinPrice: z.union([z.literal(""), z.coerce.number().int().min(1).max(500)]),
});

export async function addEpisodeAction(seriesId: string, input: Record<string, string>): Promise<FormState> {
  try {
    await requireOwnSeries(seriesId);
  } catch {
    return { error: "forbidden" };
  }
  const parsed = episodeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const last = await prisma.episode.findFirst({ where: { seriesId }, orderBy: { number: "desc" } });
  const number = (last?.number ?? 0) + 1;
  await prisma.episode.create({
    data: {
      seriesId,
      number,
      titleRu: parsed.data.titleRu,
      titleEn: parsed.data.titleEn || parsed.data.titleRu,
      videoUrl: parsed.data.videoUrl,
      durationSec: parsed.data.durationSec,
      coinPrice: parsed.data.coinPrice === "" ? null : parsed.data.coinPrice,
    },
  });
  revalidatePath(`/studio/series/${seriesId}`);
  return { ok: true };
}

export async function deleteEpisodeAction(episodeId: string) {
  const ep = await prisma.episode.findUnique({ where: { id: episodeId } });
  if (!ep) return;
  await requireOwnSeries(ep.seriesId);
  await prisma.$transaction(async (tx) => {
    await tx.episode.delete({ where: { id: episodeId } });
    // Keep numbering contiguous
    const rest = await tx.episode.findMany({ where: { seriesId: ep.seriesId, number: { gt: ep.number } }, orderBy: { number: "asc" } });
    for (const e of rest) await tx.episode.update({ where: { id: e.id }, data: { number: e.number - 1 } });
  });
  revalidatePath(`/studio/series/${ep.seriesId}`);
}

export async function submitSeriesAction(seriesId: string): Promise<FormState> {
  const { series } = await requireOwnSeries(seriesId);
  const count = await prisma.episode.count({ where: { seriesId } });
  if (count === 0) return { error: "no_episodes" };
  if (series.status === "DRAFT" || series.status === "REJECTED") {
    await prisma.series.update({ where: { id: seriesId }, data: { status: "PENDING", rejectReason: null } });
  }
  revalidatePath(`/studio/series/${seriesId}`);
  revalidatePath("/studio");
  return { ok: true };
}

export async function deleteSeriesAction(seriesId: string) {
  await requireOwnSeries(seriesId);
  await prisma.series.delete({ where: { id: seriesId } });
  revalidatePath("/studio");
  redirect("/studio");
}

export async function createPollAction(seriesId: string, _: FormState, form: FormData): Promise<FormState> {
  try {
    await requireOwnSeries(seriesId);
  } catch {
    return { error: "forbidden" };
  }
  const questionRu = String(form.get("questionRu") ?? "").trim();
  const questionEn = String(form.get("questionEn") ?? "").trim() || questionRu;
  const days = Math.min(30, Math.max(1, Number(form.get("days")) || 3));
  const options = String(form.get("options") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((l) => {
      const [ru, en] = l.split("|").map((x) => x.trim());
      return { labelRu: ru, labelEn: en || ru };
    });
  if (!questionRu || options.length < 2) return { error: "2+" };
  await prisma.poll.create({
    data: { seriesId, questionRu, questionEn, closesAt: new Date(Date.now() + days * 86400_000), options: { create: options } },
  });
  revalidatePath(`/studio/series/${seriesId}`);
  return { ok: true };
}
