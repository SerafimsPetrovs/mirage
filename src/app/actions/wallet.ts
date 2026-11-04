"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { dailyCheckIn, InsufficientCoinsError, unlockEpisode } from "@/lib/coins";
import { createOrder } from "@/lib/payments";

export type UnlockResult =
  | { ok: true; balance: number; charged: number }
  | { ok: false; error: "auth" | "insufficient" | "unknown"; price?: number; balance?: number };

export async function unlockEpisodeAction(episodeId: string): Promise<UnlockResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  // In kids mode purchases go through the parental gate (PIN) — see actions/kids.ts.
  if (user.kidsMode) return { ok: false, error: "auth" };
  try {
    const res = await unlockEpisode(user.id, episodeId);
    revalidatePath("/me/wallet");
    return { ok: true, ...res };
  } catch (e) {
    if (e instanceof InsufficientCoinsError) return { ok: false, error: "insufficient", price: e.price, balance: e.balance };
    if (e instanceof Error && e.message === "ALREADY_UNLOCKED") return { ok: true, balance: user.coins, charged: 0 };
    console.error(e);
    return { ok: false, error: "unknown" };
  }
}

export async function purchaseAction(sku: string): Promise<{ ok: boolean; redirectUrl?: string | null; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.kidsMode) return { ok: false, error: "auth" };
  try {
    const { redirectUrl } = await createOrder(user.id, sku);
    revalidatePath("/", "layout");
    return { ok: true, redirectUrl };
  } catch (e) {
    console.error(e);
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export async function checkInAction(): Promise<{ ok: boolean; reward?: number; streak?: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.kidsMode) return { ok: false, error: "auth" };
  const res = await dailyCheckIn(user.id);
  if (!res) return { ok: false, error: "already" };
  revalidatePath("/", "layout");
  return { ok: true, ...res };
}
