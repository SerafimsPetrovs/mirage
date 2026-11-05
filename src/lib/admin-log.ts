import "server-only";
import { prisma } from "./db";

/** Records an admin action for /admin/log. Never throws (logging must not break the action). */
export async function logAdmin(adminId: string, action: string, targetType: string, targetId: string, details: Record<string, unknown> | string = "") {
  try {
    await prisma.adminLog.create({
      data: { adminId, action, targetType, targetId, details: typeof details === "string" ? details : JSON.stringify(details).slice(0, 2000) },
    });
  } catch (e) {
    console.error("admin log", e);
  }
}
