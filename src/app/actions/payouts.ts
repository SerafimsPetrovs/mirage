"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { movePayout, PayoutError, requestPayout } from "@/lib/payouts";
import { PAYOUT_METHODS } from "@/lib/payout-rules";

export type PayoutResult = { ok: true } | { ok: false; error: PayoutError["code"] | "forbidden" | "invalid" | "unknown" };

function fail(e: unknown): PayoutResult {
  if (e instanceof PayoutError) return { ok: false, error: e.code };
  console.error(e);
  return { ok: false, error: "unknown" };
}

async function creator() {
  const u = await getCurrentUser();
  return u && !u.kidsMode && (u.role === "CREATOR" || u.role === "ADMIN") ? u : null;
}

const requestSchema = z.object({
  coins: z.coerce.number().int().positive().max(10_000_000),
  method: z.enum(PAYOUT_METHODS),
  details: z.string().max(300),
  holderName: z.string().max(120),
});

export async function requestPayoutAction(input: { coins: number; method: string; details: string; holderName: string }): Promise<PayoutResult> {
  const user = await creator();
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    await requestPayout(user.id, parsed.data);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/studio", "layout");
  revalidatePath("/admin/payouts");
  return { ok: true };
}

export async function cancelPayoutAction(payoutId: string): Promise<PayoutResult> {
  const user = await creator();
  if (!user) return { ok: false, error: "forbidden" };
  try {
    await movePayout(payoutId, "CANCELED", { byUserId: user.id });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/studio", "layout");
  revalidatePath("/admin/payouts");
  return { ok: true };
}

export async function adminPayoutAction(payoutId: string, to: "APPROVED" | "PAID" | "REJECTED", note?: string): Promise<PayoutResult> {
  const user = await getCurrentUser();
  if (!user || user.kidsMode || user.role !== "ADMIN") return { ok: false, error: "forbidden" };
  if (!["APPROVED", "PAID", "REJECTED"].includes(to)) return { ok: false, error: "invalid" };
  try {
    await movePayout(payoutId, to, { note });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/studio/payouts");
  return { ok: true };
}
