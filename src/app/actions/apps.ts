"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getBalance } from "@/lib/coins";
import { logAdmin } from "@/lib/admin-log";
import { AppError, appSchema, buyApp, saveApp } from "@/lib/apps";
import { APPS_ENABLED } from "@/lib/features";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: AppError["code"] | "invalid" | "unknown" };

export async function buyAppAction(slug: string): Promise<R<{ balance: number }>> {
  if (!APPS_ENABLED) return { ok: false, error: "unknown" };
  try {
    const u = await getCurrentUser();
    await buyApp(u, z.string().max(60).parse(slug));
    revalidatePath(`/apps/${slug}`);
    return { ok: true, balance: u ? await getBalance(u.id) : 0 };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.code };
    console.error("[apps buy]", e);
    return { ok: false, error: "unknown" };
  }
}

async function admin() {
  const u = await getCurrentUser();
  if (!u || u.kidsMode || u.role !== "ADMIN") throw new AppError("AUTH");
  return u;
}

export async function saveAppAction(input: unknown): Promise<R> {
  try {
    const a = await admin();
    const data = appSchema.parse(input);
    const app = await saveApp(data);
    await logAdmin(a.id, data.id ? "app_update" : "app_create", "AI_APP", app.id, { slug: app.slug });
    revalidatePath("/apps");
    revalidatePath("/admin/apps");
    return { ok: true };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.code };
    if (e instanceof z.ZodError) return { ok: false, error: "invalid" };
    console.error("[apps save]", e);
    return { ok: false, error: "unknown" };
  }
}

export async function deleteAppAction(id: string): Promise<R> {
  try {
    const a = await admin();
    await prisma.aiApp.delete({ where: { id: z.string().max(64).parse(id) } });
    await logAdmin(a.id, "app_delete", "AI_APP", id);
    revalidatePath("/apps");
    revalidatePath("/admin/apps");
    return { ok: true };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.code };
    return { ok: false, error: "unknown" };
  }
}
