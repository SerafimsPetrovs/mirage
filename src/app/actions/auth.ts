"use server";
import { promoProblem, redeemPromo } from "@/lib/promo";
import { attachReferrer, REF_COOKIE } from "@/lib/referrals";
import { headers } from "next/headers";
import { createPasswordReset, resetPassword } from "@/lib/password-reset";
import { mailIsReal, sendMail } from "@/lib/mail";
import { fmt } from "@/i18n/shared";
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

/** `values` echoes what the user typed (never passwords) so the form is not wiped after an error. */
export type FormState = { error?: string; ok?: boolean; message?: string; values?: Record<string, string> } | undefined;

const WELCOME_BONUS = 50;

const safeNext = (next: FormDataEntryValue | null) => safePath(next);

function echo(form: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, String(form.get(k) ?? "").slice(0, 200)]));
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) return { error: t.auth.invalid, values: echo(form, ["email"]) };
  if (user.banned) return { error: t.auth.banned, values: echo(form, ["email"]) };
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
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: echo(form, ["name", "email", "promo"]) };
  const { name, email, password } = parsed.data;
  if (await prisma.user.findUnique({ where: { email } })) return { error: t.auth.emailTaken, values: echo(form, ["name", "email", "promo"]) };
  const promo = String(form.get("promo") ?? "").trim().slice(0, 40);
  if (promo) {
    const problem = await promoProblem(promo);
    if (problem) return { error: `${t.promo.errors[problem]}. ${t.promo.fixOrClear}`, values: echo(form, ["name", "email", "promo"]) };
  }
  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password), avatarHue: Math.floor(Math.random() * 360) },
  });
  await grantCoins(user.id, WELCOME_BONUS, "BONUS", { note: "welcome" });
  if (promo) await redeemPromo(user.id, promo).catch((e) => console.error("promo at sign-up", e));
  const jar = await cookies();
  const ref = String(form.get("ref") || jar.get(REF_COOKIE)?.value || "");
  if (ref) {
    await attachReferrer(user.id, ref).catch((e) => console.error("referral at sign-up", e));
    jar.delete(REF_COOKIE);
  }
  await createSession(user.id);
  redirect(safeNext(form.get("next")));
}

/** Always answers the same way, whether or not the email exists. */
export async function forgotPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const email = z.string().trim().toLowerCase().email().max(200).safeParse(form.get("email"));
  if (!email.success) return { error: t.auth.badEmail, values: echo(form, ["email"]) };
  const r = await createPasswordReset(email.data);
  if (r) {
    const h = await headers();
    const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
    const link = `${origin}/reset-password?token=${r.token}`;
    await sendMail({ to: r.user.email, subject: t.auth.mailSubject, text: fmt(t.auth.mailText, { name: r.user.name, link }) }).catch((e) =>
      console.error("reset mail", e),
    );
  }
  return { ok: true, message: mailIsReal() ? t.auth.linkSent : `${t.auth.linkSent} ${t.auth.devMailHint}` };
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  if (password.length < 6 || password.length > 200) return { error: t.auth.weakPassword };
  if (password !== String(form.get("password2") ?? "")) return { error: t.auth.mismatch };
  const userId = await resetPassword(token, password);
  if (!userId) return { error: t.auth.badLink };
  await createSession(userId);
  redirect("/");
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
