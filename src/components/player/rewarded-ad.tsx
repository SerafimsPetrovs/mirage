"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Play, X } from "lucide-react";
import { btn } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { completeAdAction, startAdAction, type HouseAd } from "@/app/actions/ads";

type Phase =
  | { kind: "loading" }
  | { kind: "playing"; adId: string; ad: HouseAd | null; total: number; endsAt: number }
  | { kind: "between" }
  | { kind: "done" }
  | { kind: "error"; text: string };

/**
 * Full-screen rewarded ad sequence. Each ad is timed on the server (start → complete);
 * the client countdown is only UX. After the last one the episode unlocks and the page refreshes.
 */
export function RewardedAd({ episodeId, watched, needed, onClose }: { episodeId: string; watched: number; needed: number; onClose: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [done, setDone] = useState(watched);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [now, setNow] = useState(0);
  const completing = useRef(false);
  const errText = (e: string) => t.ads.errors[e as keyof typeof t.ads.errors] ?? t.ads.errors.unknown;

  const play = async () => {
    setPhase({ kind: "loading" });
    const r = await startAdAction(episodeId);
    if (!r.ok) return setPhase({ kind: "error", text: errText(r.error) });
    completing.current = false;
    setNow(Date.now());
    setPhase({ kind: "playing", adId: r.adId, ad: r.ad, total: r.seconds, endsAt: Date.now() + r.seconds * 1000 + 300 });
  };

  // Start the first ad on open.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown → complete on the server.
  useEffect(() => {
    if (phase.kind !== "playing") return;
    const id = setInterval(async () => {
      const n = Date.now();
      setNow(n);
      if (n < phase.endsAt || completing.current) return;
      completing.current = true;
      clearInterval(id);
      const r = await completeAdAction(phase.adId);
      if (!r.ok) return setPhase({ kind: "error", text: errText(r.error) });
      setDone(r.watched);
      if (r.unlocked) {
        setPhase({ kind: "done" });
        toast(t.ads.unlocked, "ok");
        setTimeout(() => router.refresh(), 900);
      } else setPhase({ kind: "between" });
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Esc closes (the current view simply won't count).
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const left = phase.kind === "playing" ? Math.max(0, Math.ceil((phase.endsAt - now) / 1000)) : 0;
  const progress = phase.kind === "playing" ? 1 - Math.max(0, phase.endsAt - now) / (phase.total * 1000) : 0;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t.ads.ad} className="fixed inset-0 z-[80] flex flex-col bg-black">
      {/* top bar */}
      <div className="flex items-center justify-between gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))]">
        <span className="rounded-md bg-coin px-2 py-0.5 text-xs font-bold text-black">{t.ads.ad}</span>
        <span className="text-sm text-white/70 tabular-nums">{fmt(t.ads.of, { i: Math.min(done + (phase.kind === "playing" ? 1 : 0), needed), need: needed })}</span>
        <button onClick={onClose} aria-label={t.ads.close} title={phase.kind === "playing" ? t.ads.closeWarn : t.ads.close} className={btn("glass", "icon")}>
          <X size={18} />
        </button>
      </div>
      <div className="mx-4 mt-3 h-1 overflow-hidden rounded-full bg-white/15">
        <div className="h-full bg-coin transition-[width] duration-200 ease-linear" style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
        {phase.kind === "playing" && phase.ad && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={phase.ad.poster} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-125 object-cover opacity-35 blur-2xl" />
            <div className="relative flex max-w-sm flex-col items-center text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={phase.ad.poster}
                alt={phase.ad.title}
                className={`animate-[kenburns_16s_ease-out_forwards] rounded-3xl object-cover shadow-2xl ring-1 ring-white/15 ${phase.ad.orientation === "VERTICAL" ? "aspect-[9/16] w-48 md:w-56" : "aspect-video w-full"}`}
              />
              <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-white/60">{t.ads.sponsor}</p>
              <h2 className="mt-1 font-display text-2xl font-bold">{phase.ad.title}</h2>
              {phase.ad.tagline && <p className="mt-2 text-sm text-white/75">{phase.ad.tagline}</p>}
            </div>
          </>
        )}
        {phase.kind === "loading" && <Loader2 size={36} className="animate-spin text-white/70" />}
        {phase.kind === "between" && (
          <div className="animate-fade-up text-center">
            <CheckCircle2 size={44} className="mx-auto text-ok" />
            <p className="mt-3 font-display text-xl font-semibold">{fmt(t.ads.of, { i: done, need: needed })}</p>
            <button onClick={() => void play()} className={btn("coin", "lg", "mt-6")}>
              <Play size={18} fill="currentColor" /> {t.ads.next}
            </button>
          </div>
        )}
        {phase.kind === "done" && (
          <div className="animate-pop text-center">
            <CheckCircle2 size={56} className="mx-auto text-ok" />
            <p className="mt-3 font-display text-2xl font-bold">{t.ads.done}</p>
            <p className="mt-1 text-white/70">{t.ads.unlocked}</p>
          </div>
        )}
        {phase.kind === "error" && (
          <div className="text-center">
            <p className="max-w-xs text-white/80" role="alert">{phase.text}</p>
            <button onClick={onClose} className={btn("glass", "md", "mt-5")}>{t.ads.close}</button>
          </div>
        )}
      </div>

      {phase.kind === "playing" && (
        <div className="flex justify-end px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium tabular-nums backdrop-blur">{fmt(t.ads.skipIn, { n: left })}</span>
        </div>
      )}
    </div>,
    document.body,
  );
}
