import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./db";

export const VERIFY_TTL_HOURS = 48;
/** Max confirmation emails per account per hour (stops mail bombing). */
export const VERIFY_PER_HOUR = 3;

const sha = (t: string) => createHash("sha256").update(t).digest("hex");

/** New one-time token for a not-yet-confirmed account; null when already confirmed or rate-limited. */
export async function createEmailVerification(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, emailVerifiedAt: true, banned: true } });
  if (!user || user.banned || user.emailVerifiedAt) return null;
  const recent = await prisma.emailVerification.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
  if (recent >= VERIFY_PER_HOUR) return null;
  const token = randomBytes(32).toString("base64url");
  await prisma.emailVerification.create({
    data: { userId, tokenHash: sha(token), expiresAt: new Date(Date.now() + VERIFY_TTL_HOURS * 3600_000) },
  });
  return { token, user };
}

/**
 * Confirms the email for a valid, unused, unexpired token. Returns the user id or null.
 * All of the account's other confirmation links stop working.
 */
export async function verifyEmail(token: string) {
  if (!token || token.length > 100) return null;
  const v = await prisma.emailVerification.findUnique({ where: { tokenHash: sha(token) } });
  if (!v || v.usedAt || v.expiresAt < new Date()) return null;
  return prisma.$transaction(async (tx) => {
    const used = await tx.emailVerification.updateMany({ where: { id: v.id, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count !== 1) return null;
    await tx.user.updateMany({ where: { id: v.userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
    await tx.emailVerification.updateMany({ where: { userId: v.userId, usedAt: null }, data: { usedAt: new Date() } });
    return v.userId;
  });
}
