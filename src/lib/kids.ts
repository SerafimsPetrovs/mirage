import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { utcDay } from "./rewards";

export const PIN_RE = /^\d{4}$/;
/** After this many wrong PINs in a row the PIN is locked for PIN_LOCK_MIN minutes (stops a kid brute-forcing 10 000 combos). */
export const PIN_MAX_FAILS = 5;
export const PIN_LOCK_MIN = 10;

export type PinCheck = "ok" | "wrong" | "locked" | "nopin" | "invalid";

export async function setKidsPin(userId: string, pin: string) {
  if (!PIN_RE.test(pin)) return false;
  await prisma.user.update({
    where: { id: userId },
    data: { kidsPinHash: await bcrypt.hash(pin, 10), kidsPinFails: 0, kidsPinLockedUntil: null },
  });
  return true;
}

export async function checkKidsPin(userId: string, pin: string): Promise<PinCheck> {
  if (!PIN_RE.test(pin)) return "invalid";
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { kidsPinHash: true, kidsPinFails: true, kidsPinLockedUntil: true },
  });
  if (!u.kidsPinHash) return "nopin";
  if (u.kidsPinLockedUntil && u.kidsPinLockedUntil > new Date()) return "locked";
  if (await bcrypt.compare(pin, u.kidsPinHash)) {
    if (u.kidsPinFails) await prisma.user.update({ where: { id: userId }, data: { kidsPinFails: 0, kidsPinLockedUntil: null } });
    return "ok";
  }
  const fails = u.kidsPinFails + 1;
  const lock = fails >= PIN_MAX_FAILS;
  await prisma.user.update({
    where: { id: userId },
    data: { kidsPinFails: lock ? 0 : fails, kidsPinLockedUntil: lock ? new Date(Date.now() + PIN_LOCK_MIN * 60_000) : undefined },
  });
  return lock ? "locked" : "wrong";
}

export async function setSessionKidsMode(sessionId: string, on: boolean) {
  await prisma.session.update({ where: { id: sessionId }, data: { kidsMode: on } });
}

/** Parent allowed auto-unlocking episodes of this series today. */
export async function hasKidsAllowance(userId: string, seriesId: string) {
  return !!(await prisma.kidsAllowance.findUnique({ where: { userId_seriesId_day: { userId, seriesId, day: utcDay() } } }));
}

export async function grantKidsAllowance(userId: string, seriesId: string) {
  const day = utcDay();
  await prisma.kidsAllowance.upsert({
    where: { userId_seriesId_day: { userId, seriesId, day } },
    create: { userId, seriesId, day },
    update: {},
  });
}
