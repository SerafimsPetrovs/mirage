"use client";
import { useTransition } from "react";
import clsx from "clsx";
import { useI18n } from "@/i18n/client";
import { setLocaleAction } from "@/app/actions/auth";

export function LangSwitch() {
  const { locale, t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <div role="group" aria-label={t.nav.language} className={clsx("inline-flex rounded-full border border-line p-1", pending && "opacity-60")}>
      {(["ru", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => start(() => setLocaleAction(l))}
          aria-pressed={locale === l}
          className={clsx(
            "rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition",
            locale === l ? "bg-white text-black" : "text-muted hover:text-text",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
