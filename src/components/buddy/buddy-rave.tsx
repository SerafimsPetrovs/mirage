"use client";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useI18n } from "@/i18n/client";
import { dropAt, type BeatMap } from "@/lib/music-rules";
import type { BuddyId, Outfit } from "@/lib/buddy-catalog";
import { BuddyFigure } from "./buddy-figure";

/** Seconds before a drop when the buddy starts the build-up (shakes, "here it comes…"). */
const BUILD_SEC = 2.5;
/** No more than ~2.5 flashes a second (photosensitivity): on fast tracks, every other beat. */
const MAX_FLASH_HZ = 2.5;
const HUES = [330, 190, 55, 275, 140, 15];

type Phase = "off" | "build" | "drop" | "after";
type Spot = { x: number; y: number; r: number; s: number; flip: boolean };
type Six = { id: number; x: number; y: number; r: number; size: number; hue: number };

function pickLine(list: readonly string[]) {
  return list[Math.floor(Math.random() * list.length)] ?? "";
}

/**
 * Music videos: on every drop the watch buddy leaves its corner and raves over the whole picture — jumping to a
 * new spot on every beat, with colour flashes in time. 67 mode turns it up: laser eyes sweeping the screen and
 * "67" popping everywhere. Driven by the clip's beat map (tempo + drops found on the server) and the real video
 * time, so it hits the drop of what you hear. Reduced motion → just the buddy dancing in place, no flashes.
 */
export function BuddyRave({
  buddy,
  outfit,
  beat,
  timeRef,
  slotKey,
  onRaving,
}: {
  buddy: BuddyId;
  outfit: Outfit;
  beat: BeatMap;
  /** Current video time (s) of the music video. */
  timeRef: React.RefObject<number>;
  /** Changes with the programme: resets the state. */
  slotKey: string;
  /** Tells the TV to hide the corner buddy while this one raves. */
  onRaving: (on: boolean) => void;
}) {
  const { t, mode67 } = useI18n();
  const r = t.buddy.rave;
  const [phase, setPhase] = useState<Phase>("off");
  const [beatN, setBeatN] = useState(0);
  const [spot, setSpot] = useState<Spot>({ x: 50, y: 45, r: 0, s: 1, flip: false });
  const [line, setLine] = useState<string | null>(null);
  const [sixes, setSixes] = useState<Six[]>([]);
  const [calm, setCalm] = useState(false);
  const state = useRef({ phase: "off" as Phase, beat: -1, drop: -1, six: 0 });
  const onRavingRef = useRef(onRaving);
  useEffect(() => {
    onRavingRef.current = onRaving;
  }, [onRaving]);

  useEffect(() => {
    const id = window.setTimeout(() => setCalm(window.matchMedia("(prefers-reduced-motion: reduce)").matches), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const st = state.current;
    st.phase = "off";
    st.beat = -1;
    st.drop = -1;
    const period = 60 / (beat.bpm || 120);
    const every = 1 / period > MAX_FLASH_HZ ? 2 : 1;
    let raf = 0;
    let afterTimer = 0;
    // the video reports its time ~4×/s: interpolate between reports so beats land on time
    let seen = -1;
    let seenAt = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const raw = timeRef.current ?? 0;
      const now = performance.now();
      if (raw !== seen) {
        seen = raw;
        seenAt = now;
      }
      const t = raw + Math.min(0.5, (now - seenAt) / 1000);
      const into = dropAt(beat.drops, t);
      const nextDrop = beat.drops.find((d) => d.t > t && d.t - t <= BUILD_SEC);
      let ph: Phase = into >= 0 ? "drop" : nextDrop ? "build" : st.phase === "drop" || st.phase === "after" ? "after" : "off";
      if (ph === "after" && st.phase !== "drop" && st.phase !== "after") ph = "off";
      if (ph !== st.phase) {
        const prev = st.phase;
        st.phase = ph;
        if (ph === "drop") {
          const idx = beat.drops.findIndex((d) => t >= d.t && t < d.t + d.len);
          if (idx !== st.drop) {
            st.drop = idx;
            setLine(pickLine(mode67 ? r.drop67 : r.drop));
            window.setTimeout(() => setLine(null), 2600);
          }
          onRavingRef.current(true);
        } else if (ph === "build") {
          setLine(pickLine(r.build));
          onRavingRef.current(false);
        } else if (ph === "after" && prev === "drop") {
          onRavingRef.current(false);
          setLine(pickLine(r.after));
          clearTimeout(afterTimer);
          afterTimer = window.setTimeout(() => {
            if (st.phase === "after") {
              st.phase = "off";
              setPhase("off");
            }
            setLine(null);
          }, 3500);
        } else if (ph === "off") {
          onRavingRef.current(false);
          setLine(null);
        }
        setPhase(ph);
      }
      if (ph === "drop") {
        const b = Math.floor((t - beat.beat0) / period);
        if (b !== st.beat) {
          st.beat = b;
          if (b % every === 0) {
            setBeatN((n) => n + 1);
            // a new spot on every beat: anywhere on screen, tilted, sometimes huge
            setSpot((cur) => ({
              x: 12 + Math.random() * 70,
              y: 14 + Math.random() * 52,
              r: (Math.random() - 0.5) * (mode67 ? 70 : 36),
              s: Math.random() < (mode67 ? 0.3 : 0.15) ? 1.6 : 0.9 + Math.random() * 0.35,
              flip: !cur.flip,
            }));
            if (mode67) {
              setSixes((list) => {
                const add: Six[] = Array.from({ length: 2 }, () => ({
                  id: ++st.six,
                  x: 4 + Math.random() * 86,
                  y: 6 + Math.random() * 78,
                  r: (Math.random() - 0.5) * 50,
                  size: 2 + Math.random() * 5,
                  hue: HUES[Math.floor(Math.random() * HUES.length)],
                }));
                return [...list, ...add].slice(-14);
              });
            }
          }
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(afterTimer);
      onRavingRef.current(false);
    };
  }, [beat, timeRef, slotKey, mode67, r]);

  if (phase === "off") return null;
  const raving = phase === "drop";
  const hue = HUES[beatN % HUES.length];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[22] overflow-hidden">
      {raving && !calm && (
        <>
          {/* colour flash on the beat */}
          <div key={`f${beatN}`} className="rave-flash absolute inset-0 mix-blend-screen" style={{ background: `radial-gradient(80% 70% at ${spot.x}% ${spot.y}%, hsl(${hue} 95% 60% / .55), transparent 70%)` }} />
          {/* spotlights */}
          <div className="rave-beams absolute inset-0 opacity-60 mix-blend-screen" style={{ ["--rave-hue" as string]: hue }} />
        </>
      )}
      {mode67 && raving && !calm &&
        sixes.map((s) => (
          <span
            key={s.id}
            className="rave-six absolute font-display font-black leading-none"
            style={{ left: `${s.x}%`, top: `${s.y}%`, fontSize: `${s.size}rem`, color: `hsl(${s.hue} 100% 62%)`, rotate: `${s.r}deg`, textShadow: `0 0 18px hsl(${s.hue} 100% 55%), 0 4px 0 #000` }}
          >
            67
          </span>
        ))}
      {raving ? (
        <div
          className="absolute"
          style={{
            left: calm ? "50%" : `${spot.x}%`,
            top: calm ? "40%" : `${spot.y}%`,
            transform: `translate(-50%, -50%) rotate(${calm ? 0 : spot.r}deg) scale(${calm ? 1 : spot.s})`,
            transition: calm ? undefined : `left ${Math.min(220, (60 / beat.bpm) * 600)}ms cubic-bezier(.2,1.6,.4,1), top ${Math.min(220, (60 / beat.bpm) * 600)}ms cubic-bezier(.2,1.6,.4,1), transform 160ms ease-out`,
          }}
        >
          <div key={`p${beatN}`} className={clsx(!calm && "rave-punch", calm && "buddy-dance")}>
            <div className="relative" style={{ transform: spot.flip ? "scaleX(-1)" : undefined }}>
              {mode67 && !calm && (
                <>
                  <span className="rave-laser absolute left-[38%] top-[40%] h-[6px] w-[160vmax] origin-left" style={{ ["--laser-from" as string]: "-30deg", ["--laser-to" as string]: "40deg" }} />
                  <span className="rave-laser absolute left-[62%] top-[40%] h-[6px] w-[160vmax] origin-left" style={{ ["--laser-from" as string]: "200deg", ["--laser-to" as string]: "130deg", animationDelay: "-.35s" }} />
                </>
              )}
              <BuddyFigure id={buddy} mood="hype" outfit={outfit} className="relative h-[min(34vmin,260px)] w-[min(34vmin,260px)] drop-shadow-[0_10px_30px_rgba(0,0,0,.7)]" />
            </div>
          </div>
        </div>
      ) : null}
      {line && (
        <div
          className={clsx(
            "animate-pop absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-2xl px-4 py-2 font-display font-black text-[#17121f] shadow-2xl",
            raving ? "top-[14%] bg-white text-2xl md:text-5xl" : "bottom-[28%] bg-white/95 text-base md:text-xl",
          )}
          style={raving ? { boxShadow: `0 0 40px hsl(${hue} 100% 60% / .8)` } : undefined}
        >
          {line}
        </div>
      )}
      {phase === "build" && !calm && <div className="rave-build absolute inset-0" />}
    </div>
  );
}
