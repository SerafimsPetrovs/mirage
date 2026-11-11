"use client";
import clsx from "clsx";
import type { Emotion } from "@/lib/mascot";
import { MascotFigure, type Pose } from "./mascot-figure";

/**
 * Mr. Static as a still illustration around the site (recruiting posters, 404, errors).
 * Same vector puppet as on air, frozen in a preset pose; he still blinks, breathes and his lure sways.
 */
const PRESETS = {
  /** "Mr. Static wants YOU": arm reaching at the viewer, finger aimed at the camera. */
  "want-you": { emotion: "IDLE", pose: { head: -4, lean: 2, armL: 135, armR: -4, y: 0, scale: 1, hL: "you", hR: "relaxed", lenL: 0.4 }, viewBox: "-40 10 480 470" },
  /** Lost: shrugging with both palms up. */
  shrug: { emotion: "CONFUSED", pose: { head: -10, lean: 0, armL: 62, armR: -62, y: 0, scale: 1, hL: "palm", hR: "palm" } },
  /** Something broke. */
  oops: { emotion: "SHOCK_SCARED", pose: { head: 6, lean: -4, armL: 118, armR: -118, y: 4, scale: 0.96, hL: "palm", hR: "palm" } },
  /** Nothing here yet: a little sad, arms down. */
  lonely: { emotion: "SAD", pose: { head: 8, lean: 3, armL: -2, armR: 2, y: 6, scale: 0.97, hL: "relaxed", hR: "relaxed" }, viewBox: "-20 10 480 470" },
  /** Celebrating (e.g. application sent). */
  cheer: { emotion: "HYPE_EXCITED", pose: { head: -6, lean: -2, armL: 150, armR: -40, y: -6, scale: 1.04, hL: "fist", hR: "relaxed" } },
} satisfies Record<string, { emotion: Emotion; pose: Pose; viewBox?: string }>;

export type MascotCameoKind = keyof typeof PRESETS;

export function MascotCameo({ kind, className }: { kind: MascotCameoKind; className?: string }) {
  const p: { emotion: Emotion; pose: Pose; viewBox?: string } = PRESETS[kind];
  // the bust is cut at the waist: fade it out instead of a hard edge
  return (
    <MascotFigure
      emotion={p.emotion}
      pose={p.pose}
      still
      viewBox={p.viewBox ?? "-110 -20 660 500"}
      className={clsx("select-none [mask-image:linear-gradient(to_bottom,#000_72%,transparent_96%)]", className)}
    />
  );
}
