"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, verifyPassword } from "@/lib/auth";
import { checkKidsPin, grantKidsAllowance, hasKidsAllowance, PIN_RE, setKidsPin, setSessionKidsMode, type PinCheck } from "@/lib/kids";
import { InsufficientCoinsError, unlockEpisode } from "@/lib/coins";

type KidsResult = { ok: true } | { ok: false; error: "auth" | "needPin" | "insufficient" | "notAllowed" | "unknown" | PinCheck };

/** One click into kids mode. The first time, the parent must choose a 4-digit PIN. */
export async function enterKidsModeAction(newPin?: string): Promise<KidsResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (!user.kidsPinHash) {
    if (!newPin || !PIN_RE.test(newPin)) return { ok: false, error: "needPin" };
    await setKidsPin(user.id, newPin);
  }
  await setSessionKidsMode(user.sessionId, true);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function exitKidsModeAction(pin: string): Promise<KidsResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const r = await checkKidsPin(user.id, pin);
  if (r !== "ok") return { ok: false, error: r };
  await setSessionKidsMode(user.sessionId, false);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** "Forgot PIN?" — the account password sets a new PIN and leaves kids mode. */
export async function resetKidsPinAction(password: string, newPin: string): Promise<KidsResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (!PIN_RE.test(newPin)) return { ok: false, error: "invalid" };
  if (!(await verifyPassword(password, user.passwordHash))) return { ok: false, error: "wrong" };
  await setKidsPin(user.id, newPin);
  await setSessionKidsMode(user.sessionId, false);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Parental gate on a paid episode: the parent types the PIN, optionally allowing this series for today. */
export async function parentUnlockAction(episodeId: string, pin: string, allowToday: boolean): Promise<KidsResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const r = await checkKidsPin(user.id, pin);
  if (r !== "ok") return { ok: false, error: r };
  return unlockFor(user.id, episodeId, allowToday);
}

/** Kids mode: open the next paid episode without the PIN if the parent allowed this series today. */
export async function kidsAutoUnlockAction(episodeId: string): Promise<KidsResult> {
  const user = await getCurrentUser();
  if (!user || !user.kidsMode) return { ok: false, error: "auth" };
  const ep = await prisma.episode.findUnique({ where: { id: episodeId }, select: { seriesId: true } });
  if (!ep || !(await hasKidsAllowance(user.id, ep.seriesId))) return { ok: false, error: "notAllowed" };
  return unlockFor(user.id, episodeId, false);
}

async function unlockFor(userId: string, episodeId: string, allowToday: boolean): Promise<KidsResult> {
  const ep = await prisma.episode.findUnique({ where: { id: episodeId }, select: { seriesId: true, series: { select: { isFamilySafe: true } } } });
  if (!ep || !ep.series.isFamilySafe) return { ok: false, error: "unknown" };
  try {
    await unlockEpisode(userId, episodeId);
  } catch (e) {
    if (e instanceof InsufficientCoinsError) return { ok: false, error: "insufficient" };
    if (!(e instanceof Error && e.message === "ALREADY_UNLOCKED")) {
      console.error(e);
      return { ok: false, error: "unknown" };
    }
  }
  if (allowToday) await grantKidsAllowance(userId, ep.seriesId);
  return { ok: true };
}

/** Profile → "Family mode PIN": set or change the PIN with the account password (outside family mode only). */
export async function setFamilyPinAction(password: string, newPin: string): Promise<KidsResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (user.kidsMode) return { ok: false, error: "notAllowed" };
  if (!PIN_RE.test(newPin)) return { ok: false, error: "invalid" };
  if (!(await verifyPassword(password, user.passwordHash))) return { ok: false, error: "wrong" };
  await setKidsPin(user.id, newPin);
  revalidatePath("/me");
  return { ok: true };
}
