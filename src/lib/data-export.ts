import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";

/** Security internals: login sessions, one-time tokens and watermark keys are not "your data" and must not leak. */
const SKIP_MODELS = new Set(["Session", "PasswordReset", "EmailVerification", "WatermarkSession"]);
/** Fields never exported, whatever model they are in. */
const SECRET_FIELD = /hash|token|secret|pin/i;
/** Columns that link a row to the person. */
const OWNER_FIELDS = ["userId", "creatorId", "reporterId", "ownerId", "referredById"];

type Row = Record<string, unknown>;
const clean = (row: Row): Row => Object.fromEntries(Object.entries(row).filter(([k]) => !SECRET_FIELD.test(k)));
const delegate = (model: string) =>
  (prisma as unknown as Record<string, { findMany: (a: unknown) => Promise<Row[]> }>)[model[0].toLowerCase() + model.slice(1)];

/**
 * GDPR access / portability (art. 15 and 20): everything stored about the user, as JSON.
 * Built from the Prisma schema, so a model added later is exported automatically as long as it has a userId-like column.
 */
export async function exportUserData(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  const data: Record<string, Row[]> = {};
  for (const m of Prisma.dmmf.datamodel.models) {
    if (m.name === "User" || SKIP_MODELS.has(m.name)) continue;
    const scalar = new Set(m.fields.filter((f) => f.kind === "scalar").map((f) => f.name));
    const owners = OWNER_FIELDS.filter((f) => scalar.has(f));
    if (!owners.length) continue;
    const rows = await delegate(m.name).findMany({ where: { OR: owners.map((f) => ({ [f]: userId })) } });
    if (rows.length) data[m.name] = rows.map(clean);
  }
  // Chat messages hang off the thread, not the user.
  const threadIds = (data.ChatThread ?? []).map((t) => String(t.id));
  if (threadIds.length) {
    const msgs = await prisma.chatMessage.findMany({ where: { threadId: { in: threadIds } }, orderBy: { createdAt: "asc" } });
    if (msgs.length) data.ChatMessage = msgs.map((x) => clean(x as unknown as Row));
  }
  // People you invited: only that they exist and when, not their accounts.
  const invited = await prisma.user.findMany({ where: { referredById: userId }, select: { createdAt: true } });
  return {
    exportedAt: new Date().toISOString(),
    format: "MIRAGE personal data export v1",
    account: clean(user as unknown as Row),
    invitedPeople: invited.length,
    data,
  };
}
