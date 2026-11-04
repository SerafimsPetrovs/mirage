"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Moon, Repeat } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { btn } from "@/components/ui/button";

const SLEEP_KEY = "mirage.sleepUntil";
const LOOP_KEY = "mirage.loop";
const FADE_MS = 5000;
const OPTIONS = [15, 30, 45];

function mmss(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Kids-mode player tools: sleep timer (15/30/45 min, survives episode changes, fades out then pauses)
 * and loop (keeps the favourite tale on repeat).
 */
export function useKidsTools(videoRef: React.RefObject<HTMLVideoElement | null>, enabled: boolean, episodeKey: string) {
  const [loop, setLoop] = useState(false);
  const [sleepUntil, setSleepUntil] = useState<number | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [asleep, setAsleep] = useState(false);
  const [fade, setFade] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    /* eslint-disable react-hooks/set-state-in-effect -- restore persisted settings once on mount */
    setLoop(sessionStorage.getItem(LOOP_KEY) === "1");
    const until = Number(sessionStorage.getItem(SLEEP_KEY));
    if (until > Date.now()) setSleepUntil(until);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [enabled]);

  // Apply loop to the (possibly new) video element
  useEffect(() => {
    const v = videoRef.current;
    if (v && enabled) v.loop = loop;
  }, [loop, enabled, videoRef, episodeKey]);

  useEffect(() => {
    if (!sleepUntil) return;
    const tick = () => {
      const ms = sleepUntil - Date.now();
      setLeft(ms);
      const v = videoRef.current;
      if (ms <= FADE_MS && ms > 0 && v) {
        const k = ms / FADE_MS;
        v.volume = Math.max(0, Math.min(1, k));
        setFade(1 - k);
      }
      if (ms <= 0) {
        v?.pause();
        if (v) v.volume = 1;
        sessionStorage.removeItem(SLEEP_KEY);
        setSleepUntil(null);
        setLeft(null);
        setFade(1);
        setAsleep(true);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [sleepUntil, videoRef]);

  const setSleep = useCallback((min: number | null) => {
    if (min === null) {
      sessionStorage.removeItem(SLEEP_KEY);
      setSleepUntil(null);
      setLeft(null);
      setFade(0);
      if (videoRef.current) videoRef.current.volume = 1;
      return;
    }
    const until = Date.now() + min * 60_000;
    sessionStorage.setItem(SLEEP_KEY, String(until));
    setSleepUntil(until);
  }, [videoRef]);

  const toggleLoop = useCallback(() => {
    setLoop((l) => {
      sessionStorage.setItem(LOOP_KEY, l ? "0" : "1");
      return !l;
    });
  }, []);

  const wake = useCallback(() => {
    setAsleep(false);
    setFade(0);
  }, []);

  return { loop, toggleLoop, sleepUntil, left, setSleep, asleep, wake, fade };
}

export type KidsTools = ReturnType<typeof useKidsTools>;

/** Moon + loop buttons. `tone="overlay"` for the vertical player's glass rail. */
export function KidsToolButtons({ tools, tone = "overlay" }: { tools: KidsTools; tone?: "overlay" | "bar" }) {
  const { t } = useI18n();
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);

  const base =
    tone === "overlay"
      ? "flex h-10 items-center gap-1.5 rounded-full bg-black/30 px-3 text-sm font-semibold backdrop-blur-md transition active:scale-95"
      : btn("ghost", "sm", "h-10");
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={tools.toggleLoop} aria-pressed={tools.loop} aria-label={t.kids.loop} title={tools.loop ? t.kids.loopOn : t.kids.loopOff} className={clsx(base, tools.loop && "bg-accent/90 text-white ring-1 ring-white/40")}>
        <Repeat size={18} />
      </button>
      <div ref={ref} className="relative">
        <button
          onClick={() => setMenu((m) => !m)}
          aria-label={t.kids.sleep}
          aria-expanded={menu}
          className={clsx(base, tools.sleepUntil && "bg-[#ffd36e] text-[#1d1747]")}
        >
          <Moon size={18} className={tools.sleepUntil ? "fill-current" : ""} />
          {tools.left !== null && <span className="tabular-nums">{mmss(tools.left)}</span>}
        </button>
        {menu && (
          <div className="glass animate-pop absolute right-0 top-12 z-40 w-48 rounded-2xl p-1.5 shadow-2xl">
            <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted">{t.kids.sleep}</p>
            {OPTIONS.map((m) => (
              <button key={m} onClick={() => { tools.setSleep(m); setMenu(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/10">
                <Moon size={16} /> {fmt(t.kids.sleepMin, { n: m })}
              </button>
            ))}
            <button onClick={() => { tools.setSleep(null); setMenu(false); }} className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-muted hover:bg-white/10">
              {t.kids.sleepOff}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Night-sky fade during the last seconds, then a "good night" screen. */
export function SleepOverlay({ tools }: { tools: KidsTools }) {
  const { t } = useI18n();
  if (!tools.fade && !tools.asleep) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0d0a26] transition-opacity duration-300"
      style={{ opacity: tools.asleep ? 1 : tools.fade * 0.92, pointerEvents: tools.asleep ? "auto" : "none" }}
    >
      {tools.asleep && (
        <div className="animate-fade-up px-6 text-center">
          <div className="text-6xl" aria-hidden>🌙</div>
          <h2 className="mt-4 font-display text-3xl font-bold">{t.kids.goodNight}</h2>
          <p className="mt-2 text-white/70">{t.kids.goodNightText}</p>
          <button onClick={tools.wake} className={btn("glass", "md", "mt-8")}>{t.kids.continue}</button>
        </div>
      )}
    </div>
  );
}
