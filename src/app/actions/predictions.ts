"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InsufficientGoldError, unlockEpisodeWithGold } from "@/lib/gold";
import { cancelPrediction, createPrediction, placeBet, PredictionError, resolvePrediction } from "@/lib/predictions";
import { PREDICTION_OPTIONS_MAX } from "@/lib/gold-rules";

type Err = PredictionError["code"] | "auth" | "kids" | "gold" | "unknown";
export type PredictionResult<T = object> = ({ ok: true } & T) | { ok: false; error: Err };

async function viewer() {
  const user = await getCurrentUser();
  if (!user) return { error: "auth" as const };
  if (user.kidsMode) return { error: "kids" as const };
  return { user };
}

function fail(e: unknown): { ok: false; error: Err } {
  if (e instanceof PredictionError) return { ok: false, error: e.code };
  if (e instanceof InsufficientGoldError) return { ok: false, error: "gold" };
  console.error("[predictions]", e);
  return { ok: false, error: "unknown" };
}

export async function placeBetAction(predictionId: string, input: { optionId?: string; customText?: string; stake: number }): Promise<PredictionResult<{ gold: number }>> {
  const v = await viewer();
  if ("error" in v) return { ok: false, error: v.error! };
  try {
    const r = await placeBet(v.user.id, String(predictionId), { optionId: input.optionId || null, customText: input.customText || null, stake: Number(input.stake) });
    revalidatePath("/me/wallet");
    return { ok: true, gold: r.gold };
  } catch (e) {
    return fail(e);
  }
}

export async function unlockWithGoldAction(episodeId: string): Promise<PredictionResult<{ gold: number; charged: number }>> {
  const v = await viewer();
  if ("error" in v) return { ok: false, error: v.error! };
  try {
    const r = await unlockEpisodeWithGold(v.user.id, String(episodeId));
    revalidatePath(`/watch/${episodeId}`);
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_UNLOCKED") return { ok: true, gold: v.user.gold, charged: 0 };
    return fail(e);
  }
}

const createSchema = z.object({
  episodeId: z.string().min(1).max(40),
  questionRu: z.string().max(200),
  questionEn: z.string().max(200),
  options: z.array(z.object({ ru: z.string().max(100), en: z.string().max(100) })).max(PREDICTION_OPTIONS_MAX),
  allowCustom: z.boolean(),
});

async function creator() {
  const user = await getCurrentUser();
  if (!user || user.kidsMode || (user.role !== "CREATOR" && user.role !== "ADMIN")) return null;
  return user;
}

async function revalidateSeriesOf(predictionOrEpisode: { seriesId: string }) {
  const s = await prisma.series.findUnique({ where: { id: predictionOrEpisode.seriesId }, select: { id: true, slug: true } });
  if (s) {
    revalidatePath(`/studio/series/${s.id}`);
    revalidatePath(`/series/${s.slug}`);
  }
}

export async function createPredictionAction(input: unknown): Promise<PredictionResult> {
  const user = await creator();
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const p = await createPrediction(user, parsed.data);
    await revalidateSeriesOf(p);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function resolvePredictionAction(predictionId: string, correctOptionIds: string[], correctCustomBetIds: string[]): Promise<PredictionResult<{ winners: number; bets: number }>> {
  const user = await creator();
  if (!user) return { ok: false, error: "forbidden" };
  try {
    const r = await resolvePrediction(user, String(predictionId), correctOptionIds.map(String).slice(0, 10), correctCustomBetIds.map(String).slice(0, 1000));
    const p = await prisma.prediction.findUnique({ where: { id: predictionId }, select: { seriesId: true } });
    if (p) await revalidateSeriesOf(p);
    return { ok: true, winners: r.winners, bets: r.bets };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelPredictionAction(predictionId: string): Promise<PredictionResult> {
  const user = await creator();
  if (!user) return { ok: false, error: "forbidden" };
  try {
    await cancelPrediction(user, String(predictionId));
    const p = await prisma.prediction.findUnique({ where: { id: predictionId }, select: { seriesId: true } });
    if (p) await revalidateSeriesOf(p);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
