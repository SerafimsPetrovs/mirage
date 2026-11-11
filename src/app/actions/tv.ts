"use server";
import { after } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { InsufficientCoinsError } from "@/lib/coins";
import { getLocale } from "@/i18n/server";
import { buyTicker, channelFor, createOrder, expandOrderPrompt, myOrders, postMessage, reportMessage, toggleLike, TvError } from "@/lib/tv";
import { runLtxJob } from "@/lib/video-gen";
import { addReaction, answerQuiz, finishGame, postSuperchat, quizResult, startGame, votePoll } from "@/lib/tv-live";
import type { TvOrderDTO } from "@/lib/tv-types";

export type TvResult<T = object> = ({ ok: true } & T) | { ok: false; error: TvError["code"] | "insufficient" | "invalid" | "unknown" };

function fail(e: unknown): { ok: false; error: TvError["code"] | "insufficient" | "unknown" } {
  if (e instanceof TvError) return { ok: false, error: e.code };
  if (e instanceof InsufficientCoinsError) return { ok: false, error: "insufficient" };
  console.error("[tv action]", e);
  return { ok: false, error: "unknown" };
}

const slugSchema = z.string().min(1).max(40);
const idSchema = z.string().min(1).max(64);

async function ctx(slug: unknown) {
  const s = slugSchema.safeParse(slug);
  if (!s.success) throw new TvError("NOT_FOUND");
  const user = await getCurrentUser();
  if (user?.banned) throw new TvError("AUTH");
  const ch = await channelFor(s.data, user);
  if (!ch) throw new TvError("NOT_FOUND");
  return { user, ch };
}

export async function sendTvMessageAction(slug: string, text: string): Promise<TvResult> {
  try {
    const { user, ch } = await ctx(slug);
    await postMessage(user, ch, String(text ?? ""));
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function reportTvMessageAction(messageId: string): Promise<TvResult> {
  const id = idSchema.safeParse(messageId);
  if (!id.success) return { ok: false, error: "invalid" };
  try {
    await reportMessage(await getCurrentUser(), id.data);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function buyTickerAction(slug: string, text: string): Promise<TvResult<{ balance: number }>> {
  try {
    const { user, ch } = await ctx(slug);
    const balance = await buyTicker(user, ch, String(text ?? ""));
    return { ok: true, balance };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleTvLikeAction(clipId: string): Promise<TvResult<{ liked: boolean; likes: number }>> {
  const id = idSchema.safeParse(clipId);
  if (!id.success) return { ok: false, error: "invalid" };
  try {
    return { ok: true, ...(await toggleLike(await getCurrentUser(), id.data)) };
  } catch (e) {
    return fail(e);
  }
}

export async function orderTvClipAction(slug: string, idea: string): Promise<TvResult<{ balance: number; orders: TvOrderDTO[] }>> {
  try {
    const { user, ch } = await ctx(slug);
    const { order, job, balance } = await createOrder(user, ch, String(idea ?? ""));
    // Prompt polishing and real generation run after the response (they take seconds to minutes).
    after(async () => {
      await expandOrderPrompt(order.id).catch((e) => console.error("[tv order prompt]", e));
      if (job.provider !== "mock") await runLtxJob(job.id);
    });
    return { ok: true, balance, orders: await myOrders(user!.id, await getLocale()) };
  } catch (e) {
    return fail(e);
  }
}

export async function myTvOrdersAction(): Promise<TvResult<{ orders: TvOrderDTO[] }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH" };
  return { ok: true, orders: await myOrders(user.id, await getLocale()) };
}

// ───────────── v2: live interactions ─────────────

export async function reactTvAction(slug: string, emoji: string, viewerKey: string): Promise<TvResult> {
  try {
    const { user, ch } = await ctx(slug);
    addReaction(user, String(viewerKey ?? "").replace(/[^\w-]/g, "").slice(0, 40) || "x", ch, String(emoji));
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function superchatTvAction(slug: string, text: string, coins: number): Promise<TvResult<{ balance: number }>> {
  try {
    const { user, ch } = await ctx(slug);
    const balance = await postSuperchat(user, ch, String(text ?? ""), Number(coins));
    return { ok: true, balance };
  } catch (e) {
    return fail(e);
  }
}

export async function voteTvPollAction(pollId: string, option: number): Promise<TvResult<{ gold: number }>> {
  const id = idSchema.safeParse(pollId);
  if (!id.success) return { ok: false, error: "invalid" };
  try {
    const gold = await votePoll(await getCurrentUser(), id.data, Number(option));
    return { ok: true, gold };
  } catch (e) {
    return fail(e);
  }
}

export async function answerQuizAction(slotId: string, choice: number): Promise<TvResult> {
  const id = idSchema.safeParse(slotId);
  if (!id.success) return { ok: false, error: "invalid" };
  try {
    await answerQuiz(await getCurrentUser(), id.data, Number(choice));
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function quizResultAction(slotId: string): Promise<TvResult<{ correct: number; mine: number | null; gold: number; total: number; right: number }>> {
  const id = idSchema.safeParse(slotId);
  if (!id.success) return { ok: false, error: "invalid" };
  try {
    return { ok: true, ...(await quizResult(await getCurrentUser(), id.data)) };
  } catch (e) {
    return fail(e);
  }
}

export async function startTvGameAction(): Promise<TvResult<{ id: string }>> {
  try {
    const g = await startGame(await getCurrentUser());
    return { ok: true, id: g.id };
  } catch (e) {
    return fail(e);
  }
}

export async function finishTvGameAction(gameId: string, score: number): Promise<TvResult<{ verdict: string; gold: number }>> {
  const id = idSchema.safeParse(gameId);
  if (!id.success) return { ok: false, error: "invalid" };
  try {
    return { ok: true, ...(await finishGame(await getCurrentUser(), id.data, Number(score))) };
  } catch (e) {
    return fail(e);
  }
}
