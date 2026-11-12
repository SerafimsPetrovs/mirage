"use client";
import { useTransition } from "react";
import clsx from "clsx";
import { useI18n } from "@/i18n/client";
import { setMode67Action } from "@/app/actions/auth";

/** "67" mode switch: meme texts and unhinged buddies on/off. Hidden in family mode (the action refuses there too). */
export function Mode67Switch({ kids = false, className }: { kids?: boolean; className?: string }) {
  const { t, mode67 } = useI18n();
  const [pending, start] = useTransition();
  if (kids) return null;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={mode67}
      title={t.m67.hint}
      onClick={() => start(() => setMode67Action(!mode67))}
      className={clsx(
        "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-bold transition",
        mode67 ? "border-transparent bg-[linear-gradient(90deg,#7c5cff,#ff2e63,#ffb547)] text-white" : "border-line text-muted hover:text-text",
        pending && "opacity-60",
        className,
      )}
    >
      <span className={clsx("font-display text-sm", mode67 && "m67-wobble inline-block")}>67</span>
      {mode67 ? t.m67.on : t.m67.label}
    </button>
  );
}
