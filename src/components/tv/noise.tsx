"use client";
import { useEffect, useRef } from "react";
import clsx from "clsx";

/**
 * Analog "snow": random grey pixels redrawn every frame on a tiny canvas scaled up (cheap on any device).
 * Respects reduced motion (draws one still frame).
 */
export function Noise({ className, opacity = 1, tint }: { className?: string; opacity?: number; tint?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const w = (c.width = 160);
    const h = (c.height = 90);
    const img = ctx.createImageData(w, h);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let frame = 0;
    const draw = () => {
      // Every other frame is enough for the effect and halves the work.
      if (frame++ % 2 === 0) {
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          const v = (Math.random() * 255) | 0;
          d[i] = d[i + 1] = d[i + 2] = v;
          d[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
      }
      if (!still) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className={clsx("pointer-events-none absolute inset-0 overflow-hidden", className)} style={{ opacity }} aria-hidden>
      <canvas ref={ref} className="h-full w-full [image-rendering:pixelated]" />
      {tint && <div className="absolute inset-0 mix-blend-color" style={{ background: tint }} />}
    </div>
  );
}
