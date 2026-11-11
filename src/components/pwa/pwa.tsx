"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { btn } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { MascotCameo } from "@/components/mascot/mascot-cameo";

/**
 * Installable app (PWA).
 * - `PwaRegister` (root layout) registers /sw.js in production and catches the browser's install prompt,
 *   which can fire before any menu is mounted — so it lives in a tiny module-level store.
 * - `InstallAppItem` shows "Install the app" when installing is possible: the native prompt (Chrome/Edge/Android)
 *   or step-by-step instructions on iPhone/iPad Safari, which has no prompt.
 */
type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: PromptEvent | null = null;
let iosHelp = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

export function PwaRegister() {
  const { t } = useI18n();
  const iosOpen = useSyncExternalStore(subscribe, () => iosHelp, () => false);
  const closeIos = () => {
    iosHelp = false;
    emit();
  };
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred = e as PromptEvent;
      emit();
    };
    const onInstalled = () => {
      deferred = null;
      emit();
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // Only in production: a service worker during `next dev` would cache stale chunks.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return (
    <Modal
      open={iosOpen}
      onClose={closeIos}
      label={t.pwa.iosTitle}
      className="max-w-sm"
    >
      <MascotCameo kind="want-you" className="mx-auto -mt-2 w-[150px]" />
      <h2 className="text-center font-display text-xl font-bold">{t.pwa.iosTitle}</h2>
      <p className="mt-1 text-center text-sm text-muted">{t.pwa.installHint}</p>
      <ol className="mt-4 space-y-2.5">
        {t.pwa.iosSteps.map((s, i) => (
          <li key={s} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2.5 text-sm">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
              {i === 0 ? <Share size={16} /> : i === 1 ? <SquarePlus size={16} /> : <span className="font-bold">3</span>}
            </span>
            {s}
          </li>
        ))}
      </ol>
      <button
        type="button"
        className={btn("primary", "lg", "mt-5 w-full")}
        onClick={closeIos}
      >
        {t.pwa.gotIt}
      </button>
    </Modal>
  );
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
function isIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

/** "prompt" = native install available, "ios" = show instructions, null = nothing to offer. */
function useInstallMode(): "prompt" | "ios" | null {
  const hasPrompt = useSyncExternalStore(subscribe, () => deferred !== null, () => false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only detection after hydration
    setIos(isIos() && !isStandalone());
  }, []);
  if (hasPrompt) return "prompt";
  return ios ? "ios" : null;
}

export function InstallAppItem({ className, onDone }: { className: string; onDone?: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const mode = useInstallMode();
  if (!mode) return null;
  const run = async () => {
    if (mode === "ios") {
      iosHelp = true;
      emit();
      onDone?.();
      return;
    }
    const ev = deferred;
    if (!ev) return;
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    deferred = null;
    emit();
    if (outcome === "accepted") toast(t.pwa.installed);
    onDone?.();
  };
  return (
    <button type="button" className={className} onClick={run} title={t.pwa.installHint}>
      <Download size={18} /> {t.pwa.install}
    </button>
  );
}
