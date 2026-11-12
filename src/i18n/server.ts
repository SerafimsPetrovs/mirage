import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getKidsMode } from "@/lib/auth";
import { DEFAULT_LOCALE, dictFor, isLocale, LOCALE_COOKIE, type Locale } from "./shared";
import { MODE67_COOKIE } from "./mode67";

/** English is the platform's main language; Russian only when the viewer picks it (cookie set by the switcher). */
export const getLocale = cache(async (): Promise<Locale> => {
  const jar = await cookies();
  const c = jar.get(LOCALE_COOKIE)?.value;
  return isLocale(c) ? c : DEFAULT_LOCALE;
});

/** "67" mode (meme texts) — the viewer's own switch; never in family mode. */
export const getMode67 = cache(async (): Promise<boolean> => {
  const jar = await cookies();
  if (jar.get(MODE67_COOKIE)?.value !== "1") return false;
  return !(await getKidsMode());
});

export async function getI18n() {
  const [locale, mode67] = await Promise.all([getLocale(), getMode67()]);
  return { locale, mode67, t: dictFor(locale, mode67) };
}
