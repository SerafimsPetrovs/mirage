"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveMediaPath } from "@/lib/files";
import { logAdmin } from "@/lib/admin-log";
import { detectLeak, prepareAllWatermarks, type DetectResult } from "@/lib/watermark";

async function admin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN" || user.kidsMode) throw new Error("FORBIDDEN");
  return user;
}

/** Encodes the A/B package for every episode video that isn't protected yet (runs in the background). */
export async function protectAllAction() {
  const user = await admin();
  after(() => prepareAllWatermarks().catch((e) => console.error("[watermark all]", e)));
  await logAdmin(user.id, "watermark.protectAll", "SYSTEM", "watermark");
  revalidatePath("/admin/watermark");
  return { ok: true };
}

/** Who leaked this copy? `episode` = episode id or a /watch/<id> link; `leakRef` = uploaded storage ref. */
export async function detectLeakAction(episode: string, leakRef: string): Promise<DetectResult | { ok: false; reason: "episode" | "file" }> {
  const user = await admin();
  const id = episode.trim().match(/([a-z0-9]{20,})\/?$/i)?.[1] ?? episode.trim();
  const ep = await prisma.episode.findUnique({ where: { id }, select: { id: true, videoUrl: true } });
  if (!ep) return { ok: false, reason: "episode" };
  const file = leakRef.startsWith("storage:") ? resolveMediaPath(leakRef) : null;
  if (!file) return { ok: false, reason: "file" };
  const r = await detectLeak(file, ep.videoUrl);
  await logAdmin(user.id, "watermark.detect", "EPISODE", ep.id, { result: r.ok ? `code ${r.code} → ${r.user?.email ?? "?"}` : r.reason });
  return r;
}
