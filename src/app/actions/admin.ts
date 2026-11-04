"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { deductCoins, grantCoins } from "@/lib/coins";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.kidsMode || user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return user;
}

export async function moderateSeriesAction(seriesId: string, decision: "approve" | "reject", reason?: string) {
  await requireAdmin();
  if (decision === "approve") {
    await prisma.series.update({ where: { id: seriesId }, data: { status: "PUBLISHED", rejectReason: null, publishedAt: new Date() } });
  } else {
    await prisma.series.update({ where: { id: seriesId }, data: { status: "REJECTED", rejectReason: (reason ?? "").slice(0, 500) || "—" } });
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/");
}

export async function setSeriesFlagsAction(seriesId: string, patch: { featured?: boolean; isFamilySafe?: boolean; status?: "PUBLISHED" | "DRAFT" }) {
  await requireAdmin();
  const clean = { featured: patch.featured, isFamilySafe: patch.isFamilySafe, status: patch.status };
  await prisma.series.update({
    where: { id: seriesId },
    data: { ...clean, ...(patch.status === "PUBLISHED" ? { publishedAt: new Date() } : {}) },
  });
  revalidatePath("/admin", "layout");
  revalidatePath("/");
}

export async function setUserRoleAction(userId: string, role: "VIEWER" | "CREATOR" | "ADMIN") {
  const me = await requireAdmin();
  if (me.id === userId) return; // never demote yourself
  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin/users");
}

export async function setUserBannedAction(userId: string, banned: boolean) {
  const me = await requireAdmin();
  if (me.id === userId) return;
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { banned } }),
    ...(banned ? [prisma.session.deleteMany({ where: { userId } })] : []),
  ]);
  revalidatePath("/admin/users");
}

export async function grantCoinsAction(userId: string, amount: number) {
  await requireAdmin();
  const n = Math.trunc(amount);
  if (!n || Math.abs(n) > 100000) return;
  if (n < 0) {
    try {
      await deductCoins(userId, -n);
    } catch {
      return; // not enough coins — never go negative
    }
  } else await grantCoins(userId, n, "ADMIN");
  revalidatePath("/admin/users");
}

export async function reviewApplicationAction(appId: string, approve: boolean) {
  await requireAdmin();
  const app = await prisma.creatorApplication.findUniqueOrThrow({ where: { id: appId } });
  await prisma.$transaction([
    prisma.creatorApplication.update({ where: { id: appId }, data: { status: approve ? "APPROVED" : "REJECTED" } }),
    ...(approve ? [prisma.user.update({ where: { id: app.userId }, data: { role: "CREATOR" } })] : []),
  ]);
  revalidatePath("/admin", "layout");
}

export async function setCommentHiddenAction(commentId: string, hidden: boolean) {
  await requireAdmin();
  await prisma.comment.update({ where: { id: commentId }, data: { hidden } });
  revalidatePath("/admin/comments");
}
