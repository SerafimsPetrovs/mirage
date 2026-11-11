"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, Gift, Lock } from "lucide-react";
import clsx from "clsx";
import { btn, inputCls, labelCls } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { loginAction, registerAction, type FormState } from "@/app/actions/auth";
import { DynamicMascotPlayer } from "@/components/mascot/dynamic-mascot-player";

/** Seconds of free watching a guest gets before the hard login wall. */
export const GUEST_LIMIT_SEC = 60;
const KEY = "mirage_gw";

/**
 * guestWatchTimeSeconds lives in localStorage + sessionStorage + a cookie; the largest value wins, so a reload
 * (F5) or clearing one storage does not reset it. It is a sign-up funnel, not DRM (see docs/security.md).
 */
export function readGuestSeconds() {
  const vals: number[] = [];
  try {
    vals.push(Number(localStorage.getItem(KEY)) || 0, Number(sessionStorage.getItem(KEY)) || 0);
  } catch {}
  const m = document.cookie.match(/(?:^|;\s*)mirage_gw=(\d+)/);
  if (m) vals.push(Number(m[1]) || 0);
  return Math.max(0, ...vals);
}

function writeGuestSeconds(n: number) {
  const v = String(Math.floor(n));
  try {
    localStorage.setItem(KEY, v);
    sessionStorage.setItem(KEY, v);
  } catch {}
  document.cookie = `${KEY}=${v}; path=/; max-age=${365 * 86400}; samesite=lax`;
}

/**
 * Counts real watching time of a guest (only while the video plays and the tab is visible).
 * `locked` turns true at GUEST_LIMIT_SEC — and right away if the limit was already used up earlier.
 */
export function useGuestWall(enabled: boolean, playing: boolean) {
  const [locked, setLocked] = useState(false);
  const seconds = useRef(0);
  useEffect(() => {
    if (!enabled) {
      const id = window.setTimeout(() => setLocked(false), 0);
      return () => clearTimeout(id);
    }
    seconds.current = readGuestSeconds();
    const first = window.setTimeout(() => setLocked(seconds.current >= GUEST_LIMIT_SEC), 0);
    return () => clearTimeout(first);
  }, [enabled]);
  useEffect(() => {
    if (!enabled || !playing || locked) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      seconds.current = Math.max(seconds.current, readGuestSeconds()) + 1;
      writeGuestSeconds(seconds.current);
      if (seconds.current >= GUEST_LIMIT_SEC) setLocked(true);
    }, 1000);
    return () => clearInterval(id);
  }, [enabled, playing, locked]);
  return locked;
}

/**
 * The hard login wall: no close button, ignores Esc and clicks outside. Sign-up / sign-in happen right inside;
 * the server action redirects back to this page, the viewer is logged in and the broadcast continues.
 */
export function HardLoginWall({ open }: { open: boolean }) {
  const { t, locale } = useI18n();
  const [mode, setMode] = useState<"register" | "login">("register");
  const [next, setNext] = useState("/");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => setNext(window.location.pathname + window.location.search), 0);
    // Swallow Esc so no other handler closes or exits anything underneath.
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", esc, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.querySelector<HTMLInputElement>("input:not([type=hidden])")?.focus();
    return () => {
      clearTimeout(id);
      window.removeEventListener("keydown", esc, true);
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="wall-title">
      <div ref={box} className="animate-fade-up relative max-h-[100dvh] w-full max-w-[440px] overflow-y-auto rounded-t-[28px] bg-surface/95 p-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-white/10 backdrop-blur-xl sm:rounded-[28px] md:p-7">
        <div className="flex items-center gap-4">
          <div className="h-24 w-20 shrink-0">
            <DynamicMascotPlayer variant="badge" emotion="HYPE_EXCITED" locale={locale} captions={false} className="h-full w-full" />
          </div>
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/80">
              <Lock size={12} /> {t.v3.wall.paused}
            </span>
            <h2 id="wall-title" className="mt-2 font-display text-xl font-bold leading-tight md:text-2xl">
              {t.v3.wall.title}
            </h2>
          </div>
        </div>
        <p className="mt-3 text-[15px] text-muted">{t.v3.wall.text}</p>
        <p className="mt-3 flex items-center gap-2 rounded-2xl bg-coin/10 px-3.5 py-2.5 text-sm font-semibold text-coin ring-1 ring-coin/25">
          <Gift size={17} /> {t.v3.wall.bonus}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-white/5 p-1" role="tablist">
          {(["register", "login"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={clsx("h-10 rounded-xl text-sm font-semibold transition-colors", mode === m ? "bg-white text-black" : "text-muted hover:text-text")}
            >
              {m === "register" ? t.v3.wall.registerTab : t.v3.wall.loginTab}
            </button>
          ))}
        </div>
        <WallForm key={mode} mode={mode} next={next} />
      </div>
    </div>
  );
}

function WallForm({ mode, next }: { mode: "register" | "login"; next: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "login" ? loginAction : registerAction, undefined);
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="next" value={next} />
      {mode === "register" && (
        <div>
          <label htmlFor="wall-name" className={labelCls}>
            {t.auth.name}
          </label>
          <input id="wall-name" name="name" required maxLength={40} autoComplete="name" defaultValue={state?.values?.name} className={inputCls} />
        </div>
      )}
      <div>
        <label htmlFor="wall-email" className={labelCls}>
          {t.auth.email}
        </label>
        <input id="wall-email" name="email" type="email" required autoComplete="email" defaultValue={state?.values?.email} className={inputCls} />
      </div>
      <div>
        <label htmlFor="wall-password" className={labelCls}>
          {t.auth.password}
        </label>
        <input
          id="wall-password"
          name="password"
          type="password"
          required
          minLength={mode === "register" ? 6 : undefined}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className={inputCls}
        />
      </div>
      {state?.error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
          <AlertCircle size={16} /> {state.error}
        </p>
      )}
      <button disabled={pending} className={btn("primary", "lg", "w-full")}>
        {pending ? t.common.loading : mode === "login" ? t.auth.submitLogin : t.v3.wall.register}
      </button>
      {mode === "register" && (
        <p className="text-center text-xs leading-relaxed text-muted">
          {t.legal.agree}{" "}
          <a href="/legal/terms" target="_blank" className="text-text underline">
            {t.legal.termsLink}
          </a>{" "}
          {t.legal.and}{" "}
          <a href="/legal/privacy" target="_blank" className="text-text underline">
            {t.legal.privacyLink}
          </a>
          .
        </p>
      )}
    </form>
  );
}
