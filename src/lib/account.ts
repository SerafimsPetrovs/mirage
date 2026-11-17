import "server-only";
import { prisma } from "./db";
import { verifyPassword } from "./auth";

export type DeleteAccountProblem = "wrong" | "admin" | "creator" | "missing";

/**
 * GDPR "right to erasure": deletes the user row; every personal record (sessions, history, list, comments,
 * chats, wallet, orders, payout details, buddy items…) goes with it through onDelete: Cascade in the schema.
 * Reports, TV clips and invite links keep existing with the user set to null.
 *
 * Refused for admins (the platform must never lose its last admin by accident) and for creators who still own
 * series — deleting those would also delete episodes other viewers paid for; support moves them first.
 */
export async function deleteAccount(userId: string, password: string): Promise<DeleteAccountProblem | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, role: true } });
  if (!user) return "missing";
  if (!(await verifyPassword(password, user.passwordHash))) return "wrong";
  if (user.role === "ADMIN") return "admin";
  if (await prisma.series.count({ where: { creatorId: userId } })) return "creator";
  await prisma.user.delete({ where: { id: userId } });
  return null;
}
