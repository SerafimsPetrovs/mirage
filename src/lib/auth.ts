import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "./db";

export const SESSION_COOKIE = "mirage_session";
const SESSION_DAYS = 30;

function hashToken(token: string) {
  return createHash("sha256").update(token + (process.env.SESSION_SECRET ?? "")).digest("hex");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

/** Creates a DB session and sets the cookie. Call only from Server Actions / Route Handlers. */
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { include: { subscription: true } } },
  });
  if (!session || session.expiresAt < new Date() || session.user.banned) return null;
  const u = session.user;
  return { ...u, coins: u.paidCoins + u.bonusCoins, kidsMode: session.kidsMode, sessionId: session.id };
});

/** Kids mode for the current request (false for guests). */
export const getKidsMode = cache(async () => (await getCurrentUser())?.kidsMode ?? false);

/** Redirects away from grown-up-only pages (wallet, studio, admin, profile settings) in kids mode. */
export async function forbidInKidsMode() {
  if (await getKidsMode()) redirect("/?family=locked");
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser(next?: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

export async function requireRole(roles: Role[], next?: string) {
  const user = await requireUser(next);
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

export function isVip(user: { subscription: { status: string; currentPeriodEnd: Date } | null } | null) {
  return !!user?.subscription && user.subscription.status === "ACTIVE" && user.subscription.currentPeriodEnd > new Date();
}
