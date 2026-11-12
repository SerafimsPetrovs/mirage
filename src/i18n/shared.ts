import { ru, type Dict } from "./ru";
import { en } from "./en";
import { ru67 } from "./ru67";
import { en67 } from "./en67";
import { ru67more } from "./ru67.more";
import { en67more } from "./en67.more";
import { deepMerge } from "./mode67";

export const LOCALES = ["ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "locale";
/** English is the main language of the platform. */
export const DEFAULT_LOCALE: Locale = "en";

export const dictionaries: Record<Locale, Dict> = { ru, en };
/** The same dictionaries with the "67" overlay (memes and absurdity instead of plain texts). */
const dictionaries67: Record<Locale, Dict> = {
  ru: deepMerge(deepMerge(ru, ru67), ru67more),
  en: deepMerge(deepMerge(en, en67), en67more),
};

export function dictFor(locale: Locale, mode67 = false): Dict {
  return (mode67 ? dictionaries67 : dictionaries)[locale];
}

export function isLocale(v: unknown): v is Locale {
  return v === "ru" || v === "en";
}

/** Replace {key} placeholders. */
export function fmt(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** Russian-style plural: forms = [one, few, many]. English uses one/other. */
export function plural(n: number, forms: readonly string[], locale: Locale = "ru") {
  const abs = Math.abs(n);
  if (locale === "en") return abs === 1 ? forms[0] : forms[1];
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

type Localized<K extends string> = { [P in `${K}Ru` | `${K}En`]: string };

/** Pick a localized DB field in the viewer's language, falling back to the other one when empty. */
export function pick<K extends string>(obj: Localized<K>, key: K, locale: Locale): string {
  const en = (obj as Record<string, string>)[`${key}En`] ?? "";
  const ru = (obj as Record<string, string>)[`${key}Ru`] ?? "";
  return locale === "en" ? en || ru : ru || en;
}

export function formatNumber(n: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU", { notation: n >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);
}

export function formatMoney(amount: number, currency: string, locale: Locale) {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU", { style: "currency", currency, maximumFractionDigits: currency === "RUB" ? 0 : 2, minimumFractionDigits: currency === "RUB" ? 0 : 2 }).format(amount);
}

export function formatDate(d: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(d);
}
