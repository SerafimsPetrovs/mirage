"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { deductCoins, grantCoins } from "@/lib/coins";
import { logAdmin } from "@/lib/admin-log";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.kidsMode || user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return user;
}

export async function moderateSeriesAction(seriesId: string, decision: "approve" | "reject", reason?: string) {
  const me = await requireAdmin();
  await logAdmin(me.id, `series.${decision}`, "series", seriesId, reason ?? "");
  if (decision === "approve") {
    await prisma.series.update({ where: { id: seriesId }, data: { status: "PUBLISHED", rejectReason: null, publishedAt: new Date() } });
  } else {
    await prisma.series.update({ where: { id: seriesId }, data: { status: "REJECTED", rejectReason: (reason ?? "").slice(0, 500) || "—" } });
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/library");
}

export async function setSeriesFlagsAction(seriesId: string, patch: { featured?: boolean; isFamilySafe?: boolean; isAdult?: boolean; status?: "PUBLISHED" | "DRAFT" }) {
  const me = await requireAdmin();
  // Server actions accept any JSON from the network — validate shapes, not just types.
  const p = z
    .object({ featured: z.boolean().optional(), isFamilySafe: z.boolean().optional(), isAdult: z.boolean().optional(), status: z.enum(["PUBLISHED", "DRAFT"]).optional() })
    .strict()
    .safeParse(patch);
  if (!p.success) return;
  patch = p.data;
  await logAdmin(me.id, "series.flags", "series", seriesId, patch);
  // "For kids" and "18+" are mutually exclusive: turning one on turns the other off.
  const clean = {
    featured: patch.featured,
    status: patch.status,
    isFamilySafe: patch.isAdult ? false : patch.isFamilySafe,
    isAdult: patch.isFamilySafe ? false : patch.isAdult,
    ...(patch.isAdult ? { ageRating: "18+" } : {}),
    // A moderator decision on 18+ is final for the creator (they can no longer switch it off).
    ...(patch.isAdult !== undefined ? { adultLocked: patch.isAdult } : {}),
  };
  await prisma.series.update({
    where: { id: seriesId },
    data: { ...clean, ...(patch.status === "PUBLISHED" ? { publishedAt: new Date() } : {}) },
  });
  revalidatePath("/admin", "layout");
  revalidatePath("/library");
}

export async function setUserRoleAction(userId: string, role: "VIEWER" | "CREATOR" | "ADMIN") {
  const me = await requireAdmin();
  if (me.id === userId) return; // never demote yourself
  if (!["VIEWER", "CREATOR", "ADMIN"].includes(role)) return;
  await prisma.user.update({ where: { id: userId }, data: { role } });
  await logAdmin(me.id, "user.role", "user", userId, { role });
  revalidatePath("/admin/users");
}

export async function setUserBannedAction(userId: string, banned: boolean) {
  const me = await requireAdmin();
  if (me.id === userId) return;
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { banned } }),
    ...(banned ? [prisma.session.deleteMany({ where: { userId } })] : []),
  ]);
  await logAdmin(me.id, banned ? "user.ban" : "user.unban", "user", userId);
  revalidatePath("/admin/users");
}

export async function grantCoinsAction(userId: string, amount: number) {
  const me = await requireAdmin();
  const n = Math.trunc(amount);
  if (!n || Math.abs(n) > 100000) return;
  if (n < 0) {
    try {
      await deductCoins(userId, -n);
    } catch {
      return; // not enough coins — never go negative
    }
  } else await grantCoins(userId, n, "ADMIN");
  await logAdmin(me.id, n > 0 ? "coins.add" : "coins.remove", "user", userId, { amount: n, bucket: "bonus" });
  revalidatePath("/admin/users");
}

export async function reviewApplicationAction(appId: string, approve: boolean) {
  const me = await requireAdmin();
  await logAdmin(me.id, approve ? "application.approve" : "application.reject", "application", appId);
  const app = await prisma.creatorApplication.findUniqueOrThrow({ where: { id: appId } });
  await prisma.$transaction([
    prisma.creatorApplication.update({ where: { id: appId }, data: { status: approve ? "APPROVED" : "REJECTED" } }),
    ...(approve ? [prisma.user.update({ where: { id: app.userId }, data: { role: "CREATOR" } })] : []),
  ]);
  revalidatePath("/admin", "layout");
}

export async function setCommentHiddenAction(commentId: string, hidden: boolean) {
  const me = await requireAdmin();
  await logAdmin(me.id, hidden ? "comment.hide" : "comment.show", "comment", commentId);
  await prisma.comment.update({ where: { id: commentId }, data: { hidden } });
  revalidatePath("/admin/comments");
}
