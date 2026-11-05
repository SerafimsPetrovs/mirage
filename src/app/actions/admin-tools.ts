"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { adminAdjustCoins } from "@/lib/coins";
import { extendVip, fulfillOrder } from "@/lib/payments";
import { logAdmin } from "@/lib/admin-log";

export type AdminResult = { ok: true } | { ok: false; error: string };

async function admin() {
  const u = await getCurrentUser();
  return u && !u.kidsMode && u.role === "ADMIN" ? u : null;
}

const ok = (paths: string[]): AdminResult => {
  for (const p of paths) revalidatePath(p);
  revalidatePath("/admin/log");
  return { ok: true };
};

// ---------------------------------------------------------------- users

export async function adjustCoinsAction(userId: string, delta: number, bucket: "paid" | "bonus", note: string): Promise<AdminResult> {
  const me = await admin();
  if (!me) return { ok: false, error: "forbidden" };
  const n = Math.trunc(Number(delta));
  if (!n || Math.abs(n) > 1_000_000 || (bucket !== "paid" && bucket !== "bonus")) return { ok: false, error: "invalid" };
  try {
    await adminAdjustCoins(userId, n, bucket, String(note ?? ""));
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message === "INSUFFICIENT" ? "insufficient" : "invalid" };
  }
  await logAdmin(me.id, n > 0 ? "coins.add" : "coins.remove", "user", userId, { amount: n, bucket, note });
  return ok([`/admin/users/${userId}`, "/admin/users"]);
}

export async function setVipAction(userId: string, days: number): Promise<AdminResult> {
  const me = await admin();
  if (!me) return { ok: false, error: "forbidden" };
  const d = Math.trunc(Number(days));
  if (d === 0) {
    await prisma.subscription.updateMany({ where: { userId }, data: { status: "CANCELED", currentPeriodEnd: new Date() } });
    await logAdmin(me.id, "vip.revoke", "user", userId);
  } else {
    if (d < 1 || d > 3650) return { ok: false, error: "invalid" };
    await prisma.$transaction((tx) => extendVip(tx, userId, d, "admin"));
    await logAdmin(me.id, "vip.grant", "user", userId, { days: d });
  }
  return ok([`/admin/users/${userId}`, "/admin/users"]);
}

export async function setGenCreditsAction(userId: string, credits: number): Promise<AdminResult> {
  const me = await admin();
  if (!me) return { ok: false, error: "forbidden" };
  const c = Math.trunc(Number(credits));
  if (c < 0 || c > 1_000_000) return { ok: false, error: "invalid" };
  await prisma.user.update({ where: { id: userId }, data: { genCredits: c } });
  await logAdmin(me.id, "credits.set", "user", userId, { credits: c });
  return ok([`/admin/users/${userId}`]);
}

export async function userToolAction(userId: string, tool: "logout" | "resetPin" | "resetAdult"): Promise<AdminResult> {
  const me = await admin();
  if (!me) return { ok: false, error: "forbidden" };
  if (tool === "logout") await prisma.session.deleteMany({ where: { userId } });
  else if (tool === "resetPin") await prisma.user.update({ where: { id: userId }, data: { kidsPinHash: null, kidsPinFails: 0, kidsPinLockedUntil: null } });
  else if (tool === "resetAdult") await prisma.user.update({ where: { id: userId }, data: { showAdult: false, adultConfirmedAt: null } });
  else return { ok: false, error: "invalid" };
  await logAdmin(me.id, `user.${tool}`, "user", userId);
  return ok([`/admin/users/${userId}`]);
}

// ---------------------------------------------------------------- series & charts

export async function setChartRankAction(seriesId: string, rank: number | null): Promise<AdminResult> {
  const me = await admin();
  if (!me) return { ok: false, error: "forbidden" };
  const r = rank === null ? null : Math.trunc(Number(rank));
  if (r !== null && (r < 1 || r > 10)) return { ok: false, error: "invalid" };
  await prisma.$transaction(async (tx) => {
    // one series per chart place
    if (r !== null) await tx.series.updateMany({ where: { chartRank: r, id: { not: seriesId } }, data: { chartRank: null } });
    await tx.series.update({ where: { id: seriesId }, data: { chartRank: r } });
  });
  await logAdmin(me.id, "chart.rank", "series", seriesId, { rank: r });
  return ok(["/", "/admin/series", `/admin/series/${seriesId}`]);
}

const seriesSchema = z.object({
  views: z.coerce.number().int().min(0).max(2_000_000_000),
  defaultCoinPrice: z.coerce.number().int().min(1).max(500),
  freeEpisodes: z.coerce.number().int().min(0).max(500),
  ownerEmail: z.string().trim().toLowerCase().max(200),
});

export async function updateSeriesAdminAction(seriesId: string, input: unknown): Promise<AdminResult> {
  const me = await admin();
  if (!me) return { ok: false, error: "forbidden" };
  const p = seriesSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  const d = p.data;
  let creatorId: string | undefined;
  if (d.ownerEmail) {
    const owner = await prisma.user.findUnique({ where: { email: d.ownerEmail }, select: { id: true } });
    if (!owner) return { ok: false, error: "owner" };
    creatorId = owner.id;
  }
  const s = await prisma.series.update({
    where: { id: seriesId },
    data: { views: d.views, defaultCoinPrice: d.defaultCoinPrice, freeEpisodes: d.freeEpisodes, ...(creatorId ? { creatorId } : {}) },
  });
  await logAdmin(me.id, "series.update", "series", seriesId, d);
  return ok(["/", "/admin/series", `/admin/series/${seriesId}`, `/series/${s.slug}`]);
}

export async function setEpisodePriceAction(episodeId: string, price: number | null): Promise<AdminResult> {
  const me = await admin();
  if (!me) return { ok: false, error: "forbidden" };
  const p = price === null ? null : Math.trunc(Number(price));
  if (p !== null && (p < 0 || p > 500)) return { ok: false, error: "invalid" };
  const ep = await prisma.episode.update({ where: { id: episodeId }, data: { coinPrice: p } });
  await logAdmin(me.id, "episode.price", "episode", episodeId, { price: p });
  return ok([`/admin/series/${ep.seriesId}`]);
}

/** Deletes an episode and renumbers the following ones (unlocks / progress of that episode go with it). */
export async function deleteEpisodeAction(episodeId: string): Promise<AdminResult> {
  const me = await admin();
  if (!me) return { ok: false, error: "forbidden" };
  const ep = await prisma.episode.findUnique({ where: { id: episodeId } });
  if (!ep) return { ok: false, error: "invalid" };
  await prisma.$transaction(async (tx) => {
    await tx.episode.delete({ where: { id: ep.id } });
    const later = await tx.episode.findMany({ where: { seriesId: ep.seriesId, number: { gt: ep.number } }, orderBy: { number: "asc" }, select: { id: true, number: true } });
    for (const e of later) await tx.episode.update({ where: { id: e.id }, data: { number: e.number - 1 } });
  });
  await logAdmin(me.id, "episode.delete", "episode", episodeId, { seriesId: ep.seriesId, number: ep.number });
  return ok([`/admin/series/${ep.seriesId}`, "/"]);
}

/** Irreversible: requires typing the slug. */
export async function deleteSeriesAction(seriesId: string, confirmSlug: string): Promise<AdminResult> {
  const me = await admin();
  if (!me) return { ok: false, error: "forbidden" };
  const s = await prisma.series.findUnique({ where: { id: seriesId }, select: { slug: true } });
  if (!s || s.slug !== String(confirmSlug).trim()) return { ok: false, error: "confirm" };
  await prisma.series.delete({ where: { id: seriesId } });
  await logAdmin(me.id, "series.delete", "series", seriesId, { slug: s.slug });
  return ok(["/", "/admin/series"]);
}

// ---------------------------------------------------------------- orders

/** Manually credits a pending order (e.g. payment confirmed by hand). Idempotent. */
export async function fulfillOrderAction(orderId: string): Promise<AdminResult> {
  const me = await admin();
  if (!me) return { ok: false, error: "forbidden" };
  const done = await fulfillOrder(orderId);
  if (!done) return { ok: false, error: "state" };
  await logAdmin(me.id, "order.fulfill", "order", orderId);
  return ok(["/admin/orders"]);
}
