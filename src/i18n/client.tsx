"use client";
import { createContext, useContext } from "react";
import { dictionaries, type Locale } from "./shared";

const I18nContext = createContext<Locale>("ru");

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <I18nContext.Provider value={locale}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const locale = useContext(I18nContext);
  return { locale, t: dictionaries[locale] };
}
