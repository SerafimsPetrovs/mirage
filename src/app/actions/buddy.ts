"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { buyBuddyItem, claimAchievement, saveBuddyLook, type BuddyLook, type ClaimResult } from "@/lib/buddy";

type Result = { ok: true; charged?: number } | { ok: false; error: "auth" | "kids" | "unknown" | "free" | "funds" | "notOwned" | "reward" };

/** Buys a buddy or an outfit piece (price is read from the catalog on the server). No spending in kids mode. */
export async function buyBuddyItemAction(itemId: unknown): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (user.kidsMode) return { ok: false, error: "kids" };
  if (typeof itemId !== "string" || itemId.length > 40) return { ok: false, error: "unknown" };
  const r = await buyBuddyItem(user.id, itemId);
  if (r.ok) revalidatePath("/me/buddy");
  return r;
}

/** Puts on a look. Only owned (or free) things can be worn — checked on the server. */
export async function saveBuddyLookAction(look: unknown): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (!look || typeof look !== "object") return { ok: false, error: "unknown" };
  const { buddy, outfit } = look as Partial<BuddyLook>;
  if (typeof buddy !== "string" || !outfit || typeof outfit !== "object") return { ok: false, error: "unknown" };
  const saved = await saveBuddyLook(user.id, { buddy, outfit });
  if (!saved) return { ok: false, error: "notOwned" };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Takes an achievement's reward (progress is re-checked on the server, a second claim does nothing). */
export async function claimAchievementAction(id: unknown): Promise<ClaimResult | { ok: false; error: "auth" }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (typeof id !== "string" || id.length > 40) return { ok: false, error: "unknown" };
  const r = await claimAchievement(user.id, id);
  if (r.ok) revalidatePath("/me/buddy");
  return r;
}
