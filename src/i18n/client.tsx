"use client";
import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, dictFor, type Locale } from "./shared";

const I18nContext = createContext<{ locale: Locale; mode67: boolean }>({ locale: DEFAULT_LOCALE, mode67: false });

export function I18nProvider({ locale, mode67 = false, children }: { locale: Locale; mode67?: boolean; children: React.ReactNode }) {
  return <I18nContext.Provider value={{ locale, mode67 }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const { locale, mode67 } = useContext(I18nContext);
  return { locale, mode67, t: dictFor(locale, mode67) };
}
