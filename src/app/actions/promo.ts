"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getBalance } from "@/lib/coins";
import { createPromo, PROMO_KINDS, PromoError, redeemPromo } from "@/lib/promo";
import { logAdmin } from "@/lib/admin-log";

export type RedeemResult =
  | { ok: true; kind: "COINS" | "VIP_DAYS"; value: number; balance: number }
  | { ok: false; error: PromoError["code"] | "kids" | "auth" | "unknown" };

export async function redeemPromoAction(code: string): Promise<RedeemResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (user.kidsMode) return { ok: false, error: "kids" };
  if (typeof code !== "string" || code.length > 64) return { ok: false, error: "NOT_FOUND" };
  try {
    const r = await redeemPromo(user.id, code);
    revalidatePath("/", "layout");
    return { ok: true, kind: r.kind, value: r.value, balance: await getBalance(user.id) };
  } catch (e) {
    if (e instanceof PromoError) return { ok: false, error: e.code };
    console.error(e);
    return { ok: false, error: "unknown" };
  }
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.kidsMode || user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return user;
}

const optInt = (max: number) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().int().min(1).max(max).nullable());

const createSchema = z.object({
  code: z.string().trim().max(32),
  kind: z.enum(PROMO_KINDS),
  value: z.coerce.number().int().min(1).max(100_000),
  maxUses: optInt(1_000_000),
  expiresDays: optInt(3650),
  newUsersOnly: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  note: z.string().trim().max(200),
});

export async function createPromoAction(input: Record<string, unknown>): Promise<{ ok: true; code: string } | { ok: false; error: "duplicate" | "badCode" | "invalid" | "forbidden" }> {
  let me;
  try {
    me = await requireAdmin();
  } catch {
    return { ok: false, error: "forbidden" };
  }
  const p = createSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  const d = p.data;
  // VIP codes are capped at a year per redemption.
  if (d.kind === "VIP_DAYS" && d.value > 365) return { ok: false, error: "invalid" };
  try {
    const promo = await createPromo({
      code: d.code || undefined,
      kind: d.kind,
      value: d.value,
      maxUses: d.maxUses,
      expiresAt: d.expiresDays ? new Date(Date.now() + d.expiresDays * 86400_000) : null,
      newUsersOnly: d.newUsersOnly,
      note: d.note,
    });
    revalidatePath("/admin/promos");
    await logAdmin(me.id, "promo.create", "promo", promo.id, { code: promo.code, kind: promo.kind, value: promo.value });
    return { ok: true, code: promo.code };
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    if (m === "DUPLICATE") return { ok: false, error: "duplicate" };
    if (m === "BAD_CODE") return { ok: false, error: "badCode" };
    throw e;
  }
}

export async function togglePromoAction(id: string, active: boolean) {
  const me = await requireAdmin();
  await logAdmin(me.id, active ? "promo.enable" : "promo.disable", "promo", id);
  await prisma.promoCode.update({ where: { id }, data: { active } });
  revalidatePath("/admin/promos");
}
