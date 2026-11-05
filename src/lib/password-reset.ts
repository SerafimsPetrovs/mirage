import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./db";
import { hashPassword } from "./auth";

export const RESET_TTL_MIN = 60;
/** Max reset emails per account per hour (stops mail bombing). */
export const RESET_PER_HOUR = 3;

const sha = (t: string) => createHash("sha256").update(t).digest("hex");

/**
 * Creates a one-time reset token for the account with this email.
 * Returns null (and does nothing) for unknown / banned accounts or when rate-limited —
 * the caller always shows the same neutral message, so emails can't be enumerated.
 */
export async function createPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, name: true, email: true, banned: true } });
  if (!user || user.banned) return null;
  const recent = await prisma.passwordReset.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
  if (recent >= RESET_PER_HOUR) return null;
  const token = randomBytes(32).toString("base64url");
  await prisma.passwordReset.create({
    data: { userId: user.id, tokenHash: sha(token), expiresAt: new Date(Date.now() + RESET_TTL_MIN * 60_000) },
  });
  return { token, user };
}

/** Valid, unused, not expired → the reset row. */
export async function findValidReset(token: string) {
  if (!token || token.length > 100) return null;
  const r = await prisma.passwordReset.findUnique({ where: { tokenHash: sha(token) } });
  if (!r || r.usedAt || r.expiresAt < new Date()) return null;
  return r;
}

/**
 * Sets the new password exactly once per token, invalidates every other reset link
 * and logs the account out everywhere. Returns the user id or null.
 */
export async function resetPassword(token: string, newPassword: string) {
  const r = await findValidReset(token);
  if (!r) return null;
  const passwordHash = await hashPassword(newPassword);
  return prisma.$transaction(async (tx) => {
    const used = await tx.passwordReset.updateMany({ where: { id: r.id, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count !== 1) return null;
    await tx.user.update({ where: { id: r.userId }, data: { passwordHash } });
    await tx.passwordReset.updateMany({ where: { userId: r.userId, usedAt: null }, data: { usedAt: new Date() } });
    await tx.session.deleteMany({ where: { userId: r.userId } });
    return r.userId;
  });
}
