"use server";
import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { grantCoins } from "@/lib/coins";
import { getI18n } from "@/i18n/server";
import { safePath } from "@/lib/url";
import { isLocale, LOCALE_COOKIE } from "@/i18n/shared";

export type FormState = { error?: string; ok?: boolean; message?: string } | undefined;

const WELCOME_BONUS = 50;

const safeNext = (next: FormDataEntryValue | null) => safePath(next);

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) return { error: t.auth.invalid };
  if (user.banned) return { error: t.auth.banned };
  await createSession(user.id);
  redirect(safeNext(form.get("next")));
}

export async function registerAction(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const schema = z.object({
    name: z.string().trim().min(1, t.auth.nameRequired).max(40),
    email: z.string().trim().toLowerCase().email(t.auth.badEmail),
    password: z.string().min(6, t.auth.weakPassword).max(200),
  });
  const parsed = schema.safeParse({ name: form.get("name"), email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;
  if (await prisma.user.findUnique({ where: { email } })) return { error: t.auth.emailTaken };
  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password), avatarHue: Math.floor(Math.random() * 360) },
  });
  await grantCoins(user.id, WELCOME_BONUS, "BONUS", { note: "welcome" });
  await createSession(user.id);
  redirect(safeNext(form.get("next")));
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
  revalidatePath("/", "layout");
}
