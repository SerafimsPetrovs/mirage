"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getEpisodeAccess } from "@/lib/coins";

type Result<T = unknown> = { ok: true; data?: T } | { ok: false; error: "auth" | "invalid" | "locked" | "closed" };

export async function toggleListAction(seriesId: string): Promise<Result<{ inList: boolean }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const key = { userId_seriesId: { userId: user.id, seriesId } };
  const existing = await prisma.listItem.findUnique({ where: key });
  if (existing) await prisma.listItem.delete({ where: key });
  else await prisma.listItem.create({ data: { userId: user.id, seriesId } });
  revalidatePath("/me");
  return { ok: true, data: { inList: !existing } };
}

export async function rateAction(seriesId: string, value: number): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const v = Math.round(value);
  if (v < 1 || v > 5) return { ok: false, error: "invalid" };
  await prisma.rating.upsert({
    where: { userId_seriesId: { userId: user.id, seriesId } },
    create: { userId: user.id, seriesId, value: v },
    update: { value: v },
  });
  return { ok: true };
}

export async function toggleLikeAction(episodeId: string): Promise<Result<{ liked: boolean; count: number }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const key = { userId_episodeId: { userId: user.id, episodeId } };
  const existing = await prisma.like.findUnique({ where: key });
  if (existing) await prisma.like.delete({ where: key });
  else await prisma.like.create({ data: { userId: user.id, episodeId } });
  const count = await prisma.like.count({ where: { episodeId } });
  return { ok: true, data: { liked: !existing, count } };
}

export async function addCommentAction(episodeId: string, body: string): Promise<Result<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user || user.kidsMode) return { ok: false, error: "auth" };
  const text = z.string().trim().min(1).max(500).safeParse(body);
  if (!text.success) return { ok: false, error: "invalid" };
  const c = await prisma.comment.create({ data: { userId: user.id, episodeId, body: text.data } });
  return { ok: true, data: { id: c.id } };
}

export async function getCommentsAction(episodeId: string) {
  if ((await getCurrentUser())?.kidsMode) return [];
  const comments = await prisma.comment.findMany({
    where: { episodeId, hidden: false },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { name: true, avatarHue: true, role: true, subscription: true } } },
  });
  const now = new Date();
  return comments.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    user: {
      name: c.user.name,
      hue: c.user.avatarHue,
      creator: c.user.role === "CREATOR",
      vip: !!c.user.subscription && c.user.subscription.status === "ACTIVE" && c.user.subscription.currentPeriodEnd > now,
    },
  }));
}

/** Called periodically by the player. Also counts a view the first time. */
export async function saveProgressAction(episodeId: string, positionSec: number, completed: boolean): Promise<Result> {
  const user = await getCurrentUser();
  const res = await getEpisodeAccess(user, episodeId);
  if (!res) return { ok: false, error: "invalid" };
  if (!res.access.ok) return { ok: false, error: "locked" };
  if (!user) return { ok: true };
  const pos = Math.max(0, Math.floor(positionSec));
  const key = { userId_episodeId: { userId: user.id, episodeId } };
  const existing = await prisma.watchProgress.findUnique({ where: key });
  await prisma.watchProgress.upsert({
    where: key,
    create: { userId: user.id, episodeId, seriesId: res.episode.seriesId, positionSec: pos, completed },
    update: { positionSec: pos, completed: completed || existing?.completed || false },
  });
  if (!existing) {
    await prisma.$transaction([
      prisma.episode.update({ where: { id: episodeId }, data: { views: { increment: 1 } } }),
      prisma.series.update({ where: { id: res.episode.seriesId }, data: { views: { increment: 1 } } }),
    ]);
  }
  return { ok: true };
}

export async function voteAction(pollId: string, optionId: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const poll = await prisma.poll.findUnique({ where: { id: pollId }, include: { options: true, series: true } });
  if (!poll || !poll.options.some((o) => o.id === optionId)) return { ok: false, error: "invalid" };
  if (poll.closesAt < new Date()) return { ok: false, error: "closed" };
  await prisma.pollVote.upsert({
    where: { userId_pollId: { userId: user.id, pollId } },
    create: { userId: user.id, pollId, optionId },
    update: { optionId },
  });
  revalidatePath(`/series/${poll.series.slug}`);
  return { ok: true };
}
