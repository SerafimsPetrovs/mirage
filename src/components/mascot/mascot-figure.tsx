"use client";
import clsx from "clsx";
import { useId } from "react";
import type { Emotion } from "@/lib/mascot";

/**
 * The MIRAGE host "Mr. Static": an anglerfish TV reporter whose lure is a glowing microphone.
 * The artwork is the original raster (public/mascot/mr-static.jpg, 2752×1536) shown untouched — no redraw,
 * no re-encode. Its flat dark background is faded out with a soft mask so it blends into any window.
 * Emotions read through the pose (tilt / lift / zoom), the mood animations in globals.css and the
 * lure's glow colour; `pulse` makes the lure flare on loud syllables.
 */
type Pose = { head: number; y: number; scale: number };

const POSES: Record<Emotion, Pose[]> = {
  IDLE: [
    { head: 0, y: 0, scale: 1 },
    { head: -1.5, y: 1, scale: 1 },
    { head: 1.2, y: 0, scale: 1 },
  ],
  NEUTRAL_TALK: [
    { head: -2, y: 0, scale: 1 },
    { head: 2, y: -1, scale: 1.01 },
    { head: 0, y: 0, scale: 1.015 },
    { head: 3, y: -2, scale: 1 },
  ],
  HYPE_EXCITED: [
    { head: -4, y: -10, scale: 1.06 },
    { head: 4, y: -14, scale: 1.08 },
    { head: 0, y: -8, scale: 1.1 },
  ],
  ANGRY_RAGE: [
    { head: 0, y: 4, scale: 1.14 },
    { head: -3, y: 6, scale: 1.18 },
    { head: 3, y: 2, scale: 1.16 },
  ],
  LAUGH_SARCASM: [
    { head: -6, y: 4, scale: 0.99 },
    { head: 5, y: 2, scale: 1 },
    { head: -3, y: 6, scale: 0.98 },
  ],
  SHOCK_SCARED: [
    { head: 0, y: 10, scale: 0.92 },
    { head: -4, y: 12, scale: 0.9 },
    { head: 4, y: 8, scale: 0.93 },
  ],
  LOVE: [
    { head: -4, y: -3, scale: 1.03 },
    { head: 4, y: -5, scale: 1.04 },
  ],
  SAD: [
    { head: 5, y: 10, scale: 0.95 },
    { head: 3, y: 12, scale: 0.94 },
  ],
  CONFUSED: [
    { head: -6, y: 0, scale: 1 },
    { head: 5, y: 1, scale: 1 },
  ],
  GLITCH_TRANSITION: [{ head: 0, y: 0, scale: 1 }],
};

export const LENS: Record<Emotion, string> = {
  IDLE: "#5fe3ff",
  NEUTRAL_TALK: "#7dffb2",
  HYPE_EXCITED: "#ffd23d",
  ANGRY_RAGE: "#ff3b3b",
  LAUGH_SARCASM: "#ff9a3d",
  SHOCK_SCARED: "#f2f2ff",
  LOVE: "#ff5fa2",
  SAD: "#5fa8ff",
  CONFUSED: "#c9a7ff",
  GLITCH_TRANSITION: "#ffffff",
};

export const MASCOT_SRC = "/mascot/mr-static.jpg";
const W = 2752;
const H = 1536;
/** Centre of the glowing microphone lure in the source image (px). */
const LURE = { x: 1942, y: 512 };

export function MascotFigure({ emotion, variant = 0, pulse = 0, className }: { emotion: Emotion; variant?: number; pulse?: number; className?: string }) {
  const poses = POSES[emotion] ?? POSES.IDLE;
  const p = poses[variant % poses.length];
  const ease = "transform 180ms cubic-bezier(.2,.8,.2,1)";
  const uid = useId().replace(/:/g, "");
  const c = LENS[emotion];
  const flare = 1 + Math.min(0.35, pulse * 0.12);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={clsx("mascot-fig overflow-visible", `mascot-${emotion.toLowerCase()}`, className)} role="img" aria-label="Mr. Static">
      <defs>
        <radialGradient id={`${uid}-fade`} cx="0.5" cy="0.55" r="0.62">
          <stop offset="0.62" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <mask id={`${uid}-mask`} maskContentUnits="userSpaceOnUse">
          <rect width={W} height={H} fill={`url(#${uid}-fade)`} />
        </mask>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0" stopColor={c} stopOpacity=".55" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </radialGradient>
      </defs>
      <g style={{ transform: `translateY(${p.y * 6}px) scale(${p.scale}) rotate(${p.head}deg)`, transformOrigin: `${W / 2}px ${H}px`, transition: ease }}>
        <image href={MASCOT_SRC} width={W} height={H} mask={`url(#${uid}-mask)`} preserveAspectRatio="xMidYMid meet" />
        {/* lure glow tinted by the current emotion; flares with the voice */}
        <circle
          cx={LURE.x}
          cy={LURE.y}
          r={260}
          fill={`url(#${uid}-glow)`}
          style={{ mixBlendMode: "screen", transform: `scale(${flare})`, transformOrigin: `${LURE.x}px ${LURE.y}px`, transition: "transform 90ms ease-out, fill 200ms" }}
        />
      </g>
    </svg>
  );
}
