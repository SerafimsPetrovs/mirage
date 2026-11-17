"use server";
import { getI18n } from "@/i18n/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, SESSION_COOKIE } from "@/lib/auth";
import { deleteAccount } from "@/lib/account";
import { rateLimit } from "@/lib/rate-limit";
import type { FormState } from "./auth";

export async function updateProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user || user.kidsMode) return { error: "auth" };
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(40),
      bio: z.string().trim().max(300),
      avatarHue: z.coerce.number().int().min(0).max(360),
    })
    .safeParse({ name: form.get("name"), bio: form.get("bio") ?? "", avatarHue: form.get("avatarHue") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await prisma.user.update({ where: { id: user.id }, data: { ...parsed.data, bio: parsed.data.bio || null } });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Deletes the signed-in account after a password check, then signs out and goes home. */
export async function deleteAccountAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user || user.kidsMode) return { error: "auth" };
  const { t } = await getI18n();
  if (!rateLimit(`delete-account:${user.id}`, 5, 15 * 60_000).allowed) return { error: t.auth.tooMany };
  const problem = await deleteAccount(user.id, String(form.get("password") ?? "").slice(0, 200));
  if (problem === "wrong") return { error: t.gdpr.deleteWrong };
  if (problem === "admin") return { error: t.gdpr.deleteAdmin };
  if (problem === "creator") return { error: t.gdpr.deleteCreator };
  if (problem) return { error: t.common.error };
  (await cookies()).delete(SESSION_COOKIE);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function applyCreatorAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user || user.kidsMode) return { error: "auth" };
  if (user.role !== "VIEWER") return { ok: true };
  const parsed = z
    .object({ message: z.string().trim().min(30).max(1000), portfolio: z.string().trim().max(300) })
    .safeParse({ message: form.get("message"), portfolio: form.get("portfolio") ?? "" });
  if (!parsed.success || form.get("agree") !== "on") {
    const { t } = await getI18n();
    if (!parsed.success) return { error: parsed.error.issues[0].path[0] === "message" ? t.me.apply2.tooShort : t.me.apply2.badLink };
    return { error: t.me.apply2.mustAgree };
  }
  const pending = await prisma.creatorApplication.findFirst({ where: { userId: user.id, status: "PENDING" } });
  if (!pending) await prisma.creatorApplication.create({ data: { userId: user.id, ...parsed.data } });
  revalidatePath("/me");
  return { ok: true };
}
