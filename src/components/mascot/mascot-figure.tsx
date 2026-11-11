"use client";
import clsx from "clsx";
import { useEffect, useId, useState } from "react";
import type { Emotion } from "@/lib/mascot";

/**
 * The MIRAGE host "Mr. Static": an anglerfish TV reporter in a brown suit whose lure is a glowing vintage
 * microphone. Drawn as a vector puppet (cel-shaded like the reference art: warm light from the lure on the
 * right, cool violet shadows, thick ink outline) so every part can act:
 *  - eyes: lids / brows / pupils per emotion (smug half-lids, angry slits, laughing arcs, heart pupils…) + blinking;
 *  - mouth: shape per emotion and flapping while talking, `pulse` (loud syllables) opens it wider;
 *  - arms: per-pose angles and hand gestures (point, fist, open palm);
 *  - lure: sways, its glow takes the emotion's colour and flares on loud syllables.
 * `variant` switches between a few poses per emotion ("micro-clips").
 */
type Hand = "relaxed" | "point" | "fist" | "palm";
type Pose = { head: number; lean: number; armL: number; armR: number; y: number; scale: number; hL: Hand; hR: Hand };

const P = (head: number, lean: number, armL: number, armR: number, y: number, scale: number, hL: Hand, hR: Hand): Pose => ({ head, lean, armL, armR, y, scale, hL, hR });

const POSES: Record<Emotion, Pose[]> = {
  IDLE: [P(0, 0, 4, -4, 0, 1, "relaxed", "relaxed"), P(-3, 1, 6, -2, 1, 1, "relaxed", "relaxed"), P(3, -1, 2, -6, 0, 1, "relaxed", "relaxed")],
  NEUTRAL_TALK: [
    P(-5, 0, 34, -6, 0, 1, "point", "relaxed"),
    P(5, 2, 20, -30, -1, 1, "palm", "relaxed"),
    P(0, -2, 48, -10, 0, 1.01, "point", "relaxed"),
    P(7, 1, 12, -40, -2, 1, "relaxed", "palm"),
  ],
  HYPE_EXCITED: [P(-10, -4, 140, -140, -12, 1.06, "fist", "fist"), P(9, 4, 70, -150, -16, 1.08, "palm", "fist"), P(0, 0, 150, -70, -8, 1.1, "fist", "palm")],
  ANGRY_RAGE: [P(0, 6, 60, -8, 4, 1.14, "point", "fist"), P(-7, 8, 95, -20, 6, 1.18, "fist", "fist"), P(7, 6, 30, -110, 2, 1.16, "fist", "fist")],
  LAUGH_SARCASM: [P(-16, -10, 30, -30, 5, 0.98, "palm", "relaxed"), P(13, -7, 60, -12, 2, 1, "point", "relaxed"), P(-9, -12, 14, -55, 7, 0.97, "relaxed", "palm")],
  SHOCK_SCARED: [P(0, -8, 120, -120, 10, 0.92, "palm", "palm"), P(-12, -10, 100, -60, 12, 0.9, "palm", "palm"), P(12, -6, 60, -105, 8, 0.93, "palm", "palm")],
  LOVE: [P(-10, 3, 40, -40, -3, 1.03, "palm", "palm"), P(10, -3, 55, -25, -5, 1.04, "relaxed", "palm")],
  SAD: [P(12, 5, 0, 0, 10, 0.95, "relaxed", "relaxed"), P(7, 6, -4, 4, 12, 0.94, "relaxed", "relaxed")],
  CONFUSED: [P(-14, 0, 6, -100, 0, 1, "relaxed", "palm"), P(13, 2, 70, -14, 1, 1, "palm", "relaxed")],
  GLITCH_TRANSITION: [P(0, 0, 4, -4, 0, 1, "relaxed", "relaxed")],
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

/** Lure light: warm amber at rest (as in the artwork), the emotion colour otherwise. */
const LURE: Record<Emotion, string> = { ...LENS, IDLE: "#ffad42", NEUTRAL_TALK: "#ffad42", LAUGH_SARCASM: "#ff9a3d" };

// palette sampled from the reference art
const OUT = "#150f13";
const SKIN = "#bf7c43";
const SKIN_LIT = "#e8a35a";
const SKIN_SH = "#6c5865";
const SPOT = "#56434f";
const SUIT = "#4b3326";
const SUIT_LIT = "#93603a";
const SUIT_SH = "#2a2029";
const VEST = "#3a281f";
const SHIRT = "#e3cfa2";
const SHIRT_SH = "#8c8189";
const TIE = "#4a3a31";
const TOOTH = "#efe2c0";
const EYE_W = "#f1e3bf";

const HEAD =
  "M84 236 C80 176 118 120 196 114 C262 110 306 140 318 182 C324 204 336 222 344 240 C352 262 340 292 304 312 C262 334 166 338 122 318 C96 304 86 270 84 236 Z";

// ---------- eyes ----------
type EyeKind = "normal" | "laugh" | "heart" | "star";
type EyeSet = { top: [number, number]; tilt: number; bottom: number; pupil: number; look: [number, number]; kind: EyeKind; size: number };
const E = (top: number | [number, number], tilt: number, bottom: number, pupil: number, look: [number, number], kind: EyeKind = "normal", size = 1): EyeSet => ({
  top: typeof top === "number" ? [top, top] : top,
  tilt,
  bottom,
  pupil,
  look,
  kind,
  size,
});
const EYES: Record<Emotion, EyeSet> = {
  IDLE: E(0.44, 0, 0.12, 1, [3, 2]),
  NEUTRAL_TALK: E(0.3, 0, 0.08, 1, [2, 1]),
  HYPE_EXCITED: E(0, 0, 0, 1.2, [0, 0], "star", 1.08),
  ANGRY_RAGE: E(0.36, 0.24, 0.16, 0.85, [0, 2]),
  LAUGH_SARCASM: E(0, 0, 0, 1, [0, 0], "laugh"),
  SHOCK_SCARED: E(0, 0, 0, 0.42, [0, 0], "normal", 1.14),
  LOVE: E(0.16, 0, 0.1, 1.15, [0, 0], "heart"),
  SAD: E(0.3, -0.2, 0.1, 1, [-1, 5]),
  CONFUSED: E([0.5, 0.02], 0, 0.06, 0.9, [-3, -2]),
  GLITCH_TRANSITION: E(0.3, 0, 0.08, 1, [0, 0]),
};
/** Brows: raise (px, negative = up) per eye and tilt (positive = inner end down). */
const BROWS: Record<Emotion, { dy: [number, number]; tilt: number }> = {
  IDLE: { dy: [4, 4], tilt: 2 },
  NEUTRAL_TALK: { dy: [0, 0], tilt: 0 },
  HYPE_EXCITED: { dy: [-10, -10], tilt: -3 },
  ANGRY_RAGE: { dy: [6, 6], tilt: 11 },
  LAUGH_SARCASM: { dy: [-4, -6], tilt: -2 },
  SHOCK_SCARED: { dy: [-14, -14], tilt: -4 },
  LOVE: { dy: [-6, -6], tilt: -4 },
  SAD: { dy: [-2, -2], tilt: -9 },
  CONFUSED: { dy: [6, -14], tilt: 3 },
  GLITCH_TRANSITION: { dy: [0, 0], tilt: 0 },
};

function Eye({ cx, cy, rx, ry, inner, set, uid, idx, brow, browTilt }: { cx: number; cy: number; rx: number; ry: number; inner: 1 | -1; set: EyeSet; uid: string; idx: number; brow: number; browTilt: number }) {
  rx *= set.size;
  ry *= set.size;
  const clip = `${uid}-eye${idx}`;
  const top = set.top[idx];
  const tIn = Math.max(0, Math.min(0.95, top + set.tilt));
  const tOut = Math.max(0, Math.min(0.95, top - set.tilt));
  const yIn = cy - ry + tIn * 2 * ry;
  const yOut = cy - ry + tOut * 2 * ry;
  const xIn = cx + inner * (rx + 5);
  const xOut = cx - inner * (rx + 5);
  const lidEdge = `M${xOut} ${yOut} Q${cx} ${(yIn + yOut) / 2 + 5} ${xIn} ${yIn}`;
  const yB = cy + ry - set.bottom * 2 * ry;
  const pr = 8.5 * set.pupil * (rx / 27);
  const px = cx + set.look[0];
  const py = cy + set.look[1];
  // brow
  const bOut = cy - ry - 13 + brow - browTilt;
  const bIn = cy - ry - 13 + brow + browTilt;
  const bx0 = cx - inner * (rx + 2);
  const bx1 = cx + inner * (rx + 4);
  return (
    <g>
      {/* socket bulge */}
      <ellipse cx={cx} cy={cy - 2} rx={rx + 8} ry={ry + 7} fill={SKIN} />
      <path d={`M${cx - rx - 8} ${cy} Q${cx} ${cy - ry - 22} ${cx + rx + 8} ${cy - 2}`} fill="none" stroke={OUT} strokeWidth="3.5" strokeLinecap="round" />
      <path d={`M${cx - rx + 2} ${cy + ry + 6} Q${cx} ${cy + ry + 14} ${cx + rx - 2} ${cy + ry + 5}`} fill="none" stroke={OUT} strokeWidth="2.5" strokeLinecap="round" opacity=".55" />
      {set.kind === "laugh" ? (
        <path d={`M${cx - rx + 2} ${cy + 5} Q${cx} ${cy - 16} ${cx + rx - 2} ${cy + 5}`} fill="none" stroke={OUT} strokeWidth="5.5" strokeLinecap="round" />
      ) : (
        <>
          <defs>
            <clipPath id={clip}>
              <ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
            </clipPath>
          </defs>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={EYE_W} />
          <g clipPath={`url(#${clip})`}>
            <ellipse cx={cx} cy={cy + ry * 0.55} rx={rx} ry={ry * 0.5} fill="#d6c39a" opacity=".6" />
            {set.kind === "heart" ? (
              <path
                d={`M${px} ${py + pr * 1.1} C${px - pr * 1.9} ${py - pr * 0.1} ${px - pr * 1.1} ${py - pr * 1.6} ${px} ${py - pr * 0.6} C${px + pr * 1.1} ${py - pr * 1.6} ${px + pr * 1.9} ${py - pr * 0.1} ${px} ${py + pr * 1.1} Z`}
                fill="#ff4f97"
                stroke={OUT}
                strokeWidth="1.5"
                className="mascot-heartbeat"
              />
            ) : (
              <>
                <circle cx={px} cy={py} r={pr} fill={OUT} />
                <circle cx={px - pr * 0.38} cy={py - pr * 0.4} r={Math.max(1.6, pr * 0.3)} fill="#fff" opacity=".9" />
                {set.kind === "star" && (
                  <path d={`M${px + pr * 0.4} ${py - pr * 1.3} l1.6 4.2 4.4 .2-3.5 2.8 1.2 4.3-3.7-2.5-3.7 2.5 1.2-4.3-3.5-2.8 4.4-.2Z`} fill="#fff" />
                )}
              </>
            )}
            {/* upper lid */}
            <path d={`M${xOut} ${cy - ry - 8} L${xIn} ${cy - ry - 8} L${xIn} ${yIn} Q${cx} ${(yIn + yOut) / 2 + 5} ${xOut} ${yOut} Z`} fill={SKIN} />
            {/* lower lid */}
            {set.bottom > 0 && <path d={`M${cx - rx - 4} ${cy + ry + 4} L${cx + rx + 4} ${cy + ry + 4} L${cx + rx + 4} ${yB + 3} Q${cx} ${yB - 4} ${cx - rx - 4} ${yB + 3} Z`} fill={SKIN} />}
            {/* blink */}
            <rect x={cx - rx - 2} y={cy - ry - 2} width={2 * rx + 4} height={2 * ry + 4} fill={SKIN} className="mascot-lid-blink" />
          </g>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={OUT} strokeWidth="3.5" />
          {top > 0.02 || set.tilt ? <path d={lidEdge} fill="none" stroke={OUT} strokeWidth="4.5" strokeLinecap="round" clipPath={`url(#${clip})`} /> : null}
          {set.bottom > 0 && <path d={`M${cx - rx} ${yB + 3} Q${cx} ${yB - 4} ${cx + rx} ${yB + 3}`} fill="none" stroke={OUT} strokeWidth="2.5" clipPath={`url(#${clip})`} />}
        </>
      )}
      <path d={`M${bx0} ${bOut} Q${(bx0 + bx1) / 2} ${(bOut + bIn) / 2 - 7} ${bx1} ${bIn}`} fill="none" stroke={OUT} strokeWidth="6" strokeLinecap="round" />
    </g>
  );
}

// ---------- mouth ----------
type MouthSet = { lY: number; rY: number; mid: number; open: number; squeeze: number; clench?: boolean };
const MOUTH: Record<Emotion, MouthSet> = {
  IDLE: { lY: -6, rY: 0, mid: 0, open: 0, squeeze: 0 },
  NEUTRAL_TALK: { lY: -4, rY: 0, mid: 0, open: 1, squeeze: 0 },
  HYPE_EXCITED: { lY: -14, rY: -12, mid: 12, open: 13, squeeze: 6 },
  ANGRY_RAGE: { lY: 8, rY: 8, mid: -12, open: 5, squeeze: 14, clench: true },
  LAUGH_SARCASM: { lY: -16, rY: -12, mid: 14, open: 15, squeeze: 0 },
  SHOCK_SCARED: { lY: 4, rY: 4, mid: -2, open: 18, squeeze: 56 },
  LOVE: { lY: -10, rY: -6, mid: 8, open: 0, squeeze: 10 },
  SAD: { lY: 12, rY: 10, mid: -14, open: 0, squeeze: 24 },
  CONFUSED: { lY: 6, rY: -8, mid: 0, open: 1, squeeze: 16 },
  GLITCH_TRANSITION: { lY: 0, rY: 0, mid: 0, open: 0, squeeze: 0 },
};

type Pt = { x: number; y: number };
const qp = (a: Pt, c: Pt, b: Pt, t: number): Pt => ({
  x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t ** 2 * b.x,
  y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t ** 2 * b.y,
});

function Mouth({ m, flap, uid }: { m: MouthSet; flap: number; uid: string }) {
  const open = m.open + flap;
  const L = { x: 122 + m.squeeze, y: 250 + m.lY };
  const R = { x: 340 - m.squeeze, y: 238 + m.rY };
  const C = { x: 234, y: 280 + m.mid };
  const L2 = { x: L.x + 3, y: L.y + 2 };
  const R2 = { x: R.x + 4, y: R.y + 3 };
  const C2 = { x: 234, y: C.y + 4 + 2 * open };
  const cavity = `M${L.x} ${L.y} Q${C.x} ${C.y} ${R.x} ${R.y} L${R2.x} ${R2.y} Q${C2.x} ${C2.y} ${L2.x} ${L2.y} Z`;
  const clip = `${uid}-mouth`;
  const lowMid = qp(L2, C2, R2, 0.5);
  const fangs = [0.4, 0.58, 0.9].map((t) => qp(L2, C2, R2, t));
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <path d={cavity} />
        </clipPath>
      </defs>
      {/* jowl shadow under the protruding jaw */}
      <path
        d={`M${L2.x - 6} ${L2.y + 6} Q${C2.x} ${C2.y + 12} ${R2.x + 6} ${R2.y + 8} L${R2.x - 20} 330 L${L2.x + 10} 330 Z`}
        fill={SKIN_SH}
        opacity=".5"
        clipPath={`url(#${uid}-head)`}
      />
      <path d={cavity} fill="#2a1216" />
      <g clipPath={`url(#${clip})`}>
        <ellipse cx={lowMid.x} cy={lowMid.y + 2} rx={44} ry={Math.max(4, open * 0.6)} fill="#a6434b" />
        <path d={`M${L.x} ${L.y} Q${C.x} ${C.y} ${R.x} ${R.y}`} fill="none" stroke={TOOTH} strokeWidth={m.clench ? 18 : 9} />
        {m.clench &&
          [0.2, 0.32, 0.44, 0.56, 0.68, 0.8].map((t) => {
            const a = qp(L, C, R, t);
            return <line key={t} x1={a.x} y1={a.y - 4} x2={a.x} y2={a.y + 14} stroke={OUT} strokeWidth="2" />;
          })}
      </g>
      {/* protruding lower lip with fangs */}
      <path d={`M${L2.x} ${L2.y} Q${C2.x} ${C2.y} ${R2.x + 8} ${R2.y - 1}`} fill="none" stroke={OUT} strokeWidth="13" strokeLinecap="round" />
      <path d={`M${L2.x + 2} ${L2.y} Q${C2.x} ${C2.y - 1} ${R2.x + 7} ${R2.y - 2}`} fill="none" stroke={SKIN_LIT} strokeWidth="6" strokeLinecap="round" />
      {fangs.map((f, i) => (
        <path key={i} d={`M${f.x - 5} ${f.y - 3} L${f.x + (i === 2 ? 2 : 0)} ${f.y - (i === 1 ? 17 : 13)} L${f.x + 5} ${f.y - 3} Z`} fill={TOOTH} stroke={OUT} strokeWidth="2.5" strokeLinejoin="round" />
      ))}
      <path d={`M${L.x} ${L.y} Q${C.x} ${C.y} ${R.x} ${R.y}`} fill="none" stroke={OUT} strokeWidth="4.5" strokeLinecap="round" />
      {/* smile / frown curl at the left corner */}
      <path d={m.lY <= 0 ? `M${L.x} ${L.y} q-10 -2 -12 -13` : `M${L.x} ${L.y} q-8 3 -11 12`} fill="none" stroke={OUT} strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}

// ---------- arms ----------
function HandShape({ kind }: { kind: Hand }) {
  const s = { fill: SKIN, stroke: OUT, strokeWidth: 4, strokeLinejoin: "round" as const };
  switch (kind) {
    case "fist":
      return (
        <g>
          <rect x="-18" y="116" width="36" height="34" rx="12" {...s} />
          <path d="M-8 140 v8 M2 141 v8 M11 139 v7" stroke={OUT} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M14 122 q8 8 2 18" fill="none" stroke={OUT} strokeWidth="3" strokeLinecap="round" />
          <path d="M-14 124 q-2 12 4 22" fill="none" stroke={SKIN_SH} strokeWidth="5" strokeLinecap="round" opacity=".8" />
        </g>
      );
    case "point":
      return (
        <g>
          <rect x="-6" y="138" width="13" height="44" rx="6.5" {...s} />
          <path d="M-2 172 q3.5 4 7 0" fill="none" stroke={OUT} strokeWidth="2" />
          <rect x="-18" y="116" width="36" height="32" rx="12" {...s} />
          <path d="M-12 142 v6 M-3 143 v5" stroke={OUT} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M16 124 q9 10 -1 22" fill={SKIN} stroke={OUT} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M-14 124 q-2 10 3 20" fill="none" stroke={SKIN_SH} strokeWidth="5" strokeLinecap="round" opacity=".8" />
        </g>
      );
    case "palm":
      return (
        <g>
          {[-26, -9, 8, 24].map((a, i) => (
            <rect key={a} x="-5" y="136" width="11" height={i === 0 || i === 3 ? 26 : 32} rx="5.5" transform={`rotate(${a} 0 136)`} {...s} />
          ))}
          <rect x="-5" y="118" width="11" height="26" rx="5.5" transform="rotate(-70 0 126)" {...s} />
          <ellipse cx="0" cy="134" rx="18" ry="17" {...s} />
          <path d="M-8 132 q8 8 16 0" fill="none" stroke={OUT} strokeWidth="2" opacity=".6" />
        </g>
      );
    default:
      return (
        <g>
          <path d="M-17 118 C-21 138 -14 158 0 160 C14 158 20 140 16 118 Z" {...s} />
          <path d="M-6 150 v8 M4 150 v8" stroke={OUT} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M15 124 q8 8 3 18" fill={SKIN} stroke={OUT} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M-13 124 q-3 14 3 28" fill="none" stroke={SKIN_SH} strokeWidth="5" strokeLinecap="round" opacity=".8" />
        </g>
      );
  }
}

function Arm({ hand, lit }: { hand: Hand; lit: boolean }) {
  return (
    <g>
      <path d="M-22 -6 Q0 -22 21 -6 C25 36 23 78 19 114 L-19 114 C-25 78 -27 36 -22 -6 Z" fill={SUIT} stroke={OUT} strokeWidth="4" strokeLinejoin="round" />
      <path d="M-14 4 C-18 40 -16 80 -12 108" fill="none" stroke={SUIT_SH} strokeWidth="9" strokeLinecap="round" opacity=".75" />
      {lit && <path d="M17 2 C20 40 20 78 16 106" fill="none" stroke={SUIT_LIT} strokeWidth="3.5" strokeLinecap="round" />}
      <path d="M-6 70 q6 6 12 2" fill="none" stroke={OUT} strokeWidth="2" opacity=".6" />
      <rect x="-19" y="108" width="38" height="12" rx="3" fill={SHIRT} stroke={OUT} strokeWidth="3" />
      <HandShape kind={hand} />
    </g>
  );
}

// ---------- body ----------
function Body() {
  return (
    <g>
      {/* jacket */}
      <path d="M18 480 C24 420 38 372 78 350 C104 336 128 318 150 304 L236 304 C262 316 296 330 322 344 C362 366 374 420 380 480 Z" fill={SUIT} stroke={OUT} strokeWidth="5" strokeLinejoin="round" />
      <path d="M22 480 C28 424 44 380 80 358 C96 400 104 440 108 480 Z" fill={SUIT_SH} opacity=".7" />
      <path d="M326 350 C360 372 372 420 376 478" fill="none" stroke={SUIT_LIT} strokeWidth="5" strokeLinecap="round" />
      {/* shirt + tie */}
      <path d="M146 304 L240 304 L220 400 L194 440 L166 400 Z" fill={SHIRT} stroke={OUT} strokeWidth="3.5" />
      <path d="M150 312 L170 400 L194 440 L180 380 Z" fill={SHIRT_SH} opacity=".6" />
      <path d="M186 344 L204 344 L210 360 L216 450 L196 470 L180 450 L184 360 Z" fill={TIE} stroke={OUT} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M184 330 L206 330 L204 348 L186 348 Z" fill={TIE} stroke={OUT} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M200 350 L206 440" stroke="#6b5646" strokeWidth="3" opacity=".7" />
      <path d="M150 304 L194 330 L172 362 Z" fill={SHIRT} stroke={OUT} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M238 304 L196 330 L224 362 Z" fill={SHIRT} stroke={OUT} strokeWidth="3.5" strokeLinejoin="round" />
      {/* vest */}
      <path d="M150 384 L196 452 L238 384 L262 480 L130 480 Z" fill={VEST} stroke={OUT} strokeWidth="3.5" strokeLinejoin="round" />
      <circle cx="198" cy="464" r="4" fill={SUIT_SH} stroke={OUT} strokeWidth="2" />
      {/* lapels */}
      <path d="M146 306 L124 352 L146 364 L132 380 L176 480 L118 480 C112 420 104 380 104 344 Z" fill={SUIT} stroke={OUT} strokeWidth="4" strokeLinejoin="round" />
      <path d="M242 306 L266 352 L244 364 L258 380 L218 480 L290 480 C294 420 296 380 290 340 Z" fill={SUIT_LIT} stroke={OUT} strokeWidth="4" strokeLinejoin="round" />
      <path d="M252 372 L230 470" stroke={SUIT} strokeWidth="6" opacity=".55" />
      {/* PRESS badge */}
      <g transform="translate(262 400) rotate(-7)">
        <rect x="-4" y="-12" width="8" height="14" rx="2" fill="#9c958c" stroke={OUT} strokeWidth="2.5" />
        <rect x="-30" y="0" width="60" height="36" rx="3" fill="#dcc79c" stroke={OUT} strokeWidth="3.5" />
        <rect x="-26" y="26" width="52" height="6" fill="#c8b087" />
        <text x="0" y="23" textAnchor="middle" fontSize="16" fontWeight="900" fill="#2a1e18" fontFamily="var(--font-inter), sans-serif" letterSpacing=".5">
          PRESS
        </text>
      </g>
    </g>
  );
}

// ---------- head ----------
function Head({ emotion, flap, uid, glow, flare }: { emotion: Emotion; flap: number; uid: string; glow: string; flare: number }) {
  const eyes = EYES[emotion] ?? EYES.IDLE;
  const brows = BROWS[emotion] ?? BROWS.IDLE;
  const clip = `${uid}-head`;
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <path d={HEAD} />
        </clipPath>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0" stopColor={glow} stopOpacity=".75" />
          <stop offset=".45" stopColor={glow} stopOpacity=".28" />
          <stop offset="1" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-mic`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe3a6" />
          <stop offset="1" stopColor="#e8862d" />
        </linearGradient>
      </defs>
      {/* fins (behind the head) */}
      {/* webbed fins with rays (behind the head) */}
      <path
        d="M116 156 Q80 128 84 88 Q98 100 106 80 Q118 94 130 72 Q140 92 154 80 Q158 102 172 118 Z"
        fill={SKIN_SH}
        stroke={OUT}
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
      <path d="M124 146 Q96 118 88 92 M132 138 Q112 108 108 84 M142 130 Q132 100 130 76 M154 124 Q152 102 154 84" fill="none" stroke={SPOT} strokeWidth="3" strokeLinecap="round" />
      <path d="M94 222 Q56 194 40 210 Q52 220 34 234 Q52 242 40 258 Q58 258 56 276 Q80 266 96 254 Z" fill={SKIN_SH} stroke={OUT} strokeWidth="4.5" strokeLinejoin="round" />
      <path d="M92 232 Q64 214 44 212 M92 240 Q62 236 40 236 M94 248 Q70 254 46 258" fill="none" stroke={SPOT} strokeWidth="3" strokeLinecap="round" />
      {/* skin with cel shading */}
      <g clipPath={`url(#${clip})`}>
        <path d={HEAD} fill={SKIN_LIT} />
        <path d={HEAD} fill={SKIN} transform="translate(-12 6)" />
        <path d="M60 150 C96 170 104 230 120 262 C134 292 170 316 220 330 L60 340 Z" fill={SKIN_SH} opacity=".9" />
        <ellipse cx="214" cy="140" rx="46" ry="14" fill={SKIN_LIT} opacity=".45" />
        {emotion === "ANGRY_RAGE" && <path d={HEAD} fill="#ff2a2a" opacity=".2" />}
        {emotion === "SAD" && <path d={HEAD} fill="#5f8cff" opacity=".14" />}
        {emotion === "SHOCK_SCARED" && <path d={HEAD} fill="#e8f0ff" opacity=".16" />}
      </g>
      {[
        [126, 160, 5],
        [114, 178, 4],
        [142, 142, 3.5],
        [104, 200, 3],
      ].map(([x, y, r]) => (
        <circle key={x} cx={x} cy={y} r={r} fill={SPOT} />
      ))}
      <path d={HEAD} fill="none" stroke={OUT} strokeWidth="5.5" strokeLinejoin="round" />
      <path d="M160 314 Q220 328 282 308" fill="none" stroke={OUT} strokeWidth="2.5" opacity=".45" />
      <path d="M118 232 Q128 248 124 262" fill="none" stroke={OUT} strokeWidth="2.5" opacity=".5" />
      {/* eyes + brows */}
      <Eye cx={160} cy={192} rx={27} ry={24} inner={1} set={eyes} uid={uid} idx={0} brow={brows.dy[0]} browTilt={brows.tilt} />
      <Eye cx={264} cy={184} rx={22} ry={21} inner={-1} set={eyes} uid={uid} idx={1} brow={brows.dy[1]} browTilt={brows.tilt} />
      {/* nostrils */}
      <ellipse cx="231" cy="226" rx="3" ry="4.5" fill={OUT} transform="rotate(-15 231 226)" />
      <ellipse cx="248" cy="222" rx="3" ry="4.5" fill={OUT} transform="rotate(-15 248 222)" />
      <Mouth m={MOUTH[emotion] ?? MOUTH.IDLE} flap={flap} uid={uid} />
      {/* emotion extras */}
      {(emotion === "LOVE" || emotion === "LAUGH_SARCASM") && (
        <g opacity=".55">
          <ellipse cx="140" cy="236" rx="16" ry="8" fill="#ff5f8f" />
          <ellipse cx="290" cy="222" rx="13" ry="7" fill="#ff5f8f" />
        </g>
      )}
      {emotion === "ANGRY_RAGE" && (
        <g stroke="#ff3030" strokeWidth="4.5" strokeLinecap="round" fill="none" className="mascot-heartbeat">
          <path d="M282 132 q6 6 0 12 M296 132 q-6 6 0 12 M283 128 q6 -6 12 0 M283 148 q6 6 12 0" />
        </g>
      )}
      {emotion === "SAD" && <path d="M178 214 q6 10 0 15 q-6 -5 0 -15 Z" fill="#8fd0ff" stroke={OUT} strokeWidth="1.5" className="mascot-tear" />}
      {(emotion === "SHOCK_SCARED" || emotion === "CONFUSED") && <path d="M306 148 q9 14 0 20 q-9 -6 0 -20 Z" fill="#a9dcff" stroke={OUT} strokeWidth="2" />}
      {/* lure: stalk from the forehead to the glowing microphone */}
      <g className="mascot-lure" style={{ transformOrigin: "232px 118px" }}>
        <circle cx="384" cy="146" r="78" fill={`url(#${uid}-glow)`} style={{ transform: `scale(${flare})`, transformOrigin: "384px 146px", transition: "transform 90ms ease-out" }} />
        <path d="M230 122 C232 70 266 26 318 28 C360 30 386 66 384 106" fill="none" stroke={OUT} strokeWidth="11" strokeLinecap="round" />
        <path d="M230 120 C232 70 266 26 318 28 C360 30 386 66 384 104" fill="none" stroke={SKIN} strokeWidth="5.5" strokeLinecap="round" />
        <path d="M262 50 C280 36 300 32 320 32" fill="none" stroke={SKIN_LIT} strokeWidth="2.5" strokeLinecap="round" />
        <rect x="377" y="100" width="14" height="14" rx="3" fill="#c7782f" stroke={OUT} strokeWidth="3" />
        <rect x="364" y="112" width="40" height="64" rx="20" fill={`url(#${uid}-mic)`} stroke={OUT} strokeWidth="4" />
        {[124, 133, 142, 151, 160].map((y) => (
          <line key={y} x1="370" y1={y} x2="398" y2={y} stroke="#b05a1c" strokeWidth="2.2" strokeLinecap="round" />
        ))}
        <rect x="362" y="140" width="44" height="8" rx="3" fill="#d27a2a" stroke={OUT} strokeWidth="2.5" />
        <rect x="364" y="112" width="40" height="64" rx="20" fill={glow} opacity=".22" style={{ mixBlendMode: "screen" }} />
        <ellipse cx="374" cy="126" rx="4" ry="8" fill="#fff" opacity=".7" />
      </g>
    </g>
  );
}

/** Mouth flap while talking: a cheap, lively pseudo-lipsync (~15 fps), wider on loud syllables. */
function useFlap(active: boolean, pulse: number) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      if (now - last > 66) {
        last = now;
        setT(now);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  if (!active) return 0;
  const amp = 8 + Math.min(8, pulse * 4);
  return Math.abs(Math.sin(t / 75)) * (0.55 + 0.45 * Math.abs(Math.sin(t / 190 + 1))) * amp;
}

export function MascotFigure({ emotion, variant = 0, pulse = 0, className }: { emotion: Emotion; variant?: number; pulse?: number; className?: string }) {
  const poses = POSES[emotion] ?? POSES.IDLE;
  const p = poses[variant % poses.length];
  const ease = "transform 180ms cubic-bezier(.2,.8,.2,1)";
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const flap = useFlap(emotion !== "IDLE", pulse);
  const flare = 1 + Math.min(0.35, pulse * 0.12);
  return (
    <svg viewBox="0 0 440 480" className={clsx("mascot-fig overflow-visible", `mascot-${emotion.toLowerCase()}`, className)} role="img" aria-label="Mr. Static">
      <g style={{ transform: `translateY(${p.y}px) scale(${p.scale}) rotate(${p.lean}deg)`, transformOrigin: "200px 480px", transition: ease }}>
        <g className="mascot-breathe">
          <Body />
          <g style={{ transform: `translate(70px, 370px) rotate(${p.armL}deg)`, transition: ease }}>
            <Arm hand={p.hL} lit={false} />
          </g>
          <g style={{ transform: `translate(316px, 366px) rotate(${p.armR}deg) scaleX(-1)`, transition: ease }}>
            <Arm hand={p.hR} lit />
          </g>
          <g style={{ transform: `rotate(${p.head}deg)`, transformOrigin: "200px 318px", transition: ease }}>
            <Head emotion={emotion} flap={flap} uid={uid} glow={LURE[emotion]} flare={flare} />
          </g>
        </g>
      </g>
    </svg>
  );
}
