"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { AdError, completeAd, startAd } from "@/lib/ads";
import { listSeries } from "@/lib/catalog";
import { getLocale } from "@/i18n/server";

export type AdErrorCode = AdError["code"] | "auth" | "unknown";
export type HouseAd = { slug: string; title: string; tagline: string; poster: string; orientation: "VERTICAL" | "HORIZONTAL" };

function fail(e: unknown): { ok: false; error: AdErrorCode } {
  if (e instanceof AdError) return { ok: false, error: e.code };
  console.error(e);
  return { ok: false, error: "unknown" };
}

/** Starts a server-timed ad view and returns what to show (a house ad: another series' trailer card). */
export async function startAdAction(episodeId: string): Promise<{ ok: true; adId: string; seconds: number; ad: HouseAd | null } | { ok: false; error: AdErrorCode }> {
  const user = await getCurrentUser();
  if (!user || user.kidsMode) return { ok: false, error: "auth" };
  try {
    const { adId, seconds } = await startAd(user, episodeId);
    const pool = await listSeries(await getLocale(), { where: { featured: true }, take: 8 });
    const pickIdx = adId.charCodeAt(adId.length - 1) % Math.max(1, pool.length);
    const s = pool[pickIdx];
    const ad = s ? { slug: s.slug, title: s.title, tagline: s.tagline, poster: s.orientation === "VERTICAL" ? s.poster : s.backdrop, orientation: s.orientation } : null;
    return { ok: true, adId, seconds, ad };
  } catch (e) {
    return fail(e);
  }
}

export async function completeAdAction(adId: string): Promise<{ ok: true; unlocked: boolean; watched: number } | { ok: false; error: AdErrorCode }> {
  const user = await getCurrentUser();
  if (!user || user.kidsMode) return { ok: false, error: "auth" };
  try {
    const r = await completeAd(user.id, adId);
    if (r.unlocked) revalidatePath("/watch", "layout");
    return { ok: true, ...r };
  } catch (e) {
    return fail(e);
  }
}
