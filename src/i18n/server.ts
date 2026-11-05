import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, dictionaries, isLocale, LOCALE_COOKIE, type Locale } from "./shared";

/** English is the platform's main language; Russian only when the viewer picks it (cookie set by the switcher). */
export const getLocale = cache(async (): Promise<Locale> => {
  const jar = await cookies();
  const c = jar.get(LOCALE_COOKIE)?.value;
  return isLocale(c) ? c : DEFAULT_LOCALE;
});

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}
