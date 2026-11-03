"use client";
import { useEffect, useRef } from "react";
import clsx from "clsx";

/**
 * "Ambient mode": samples the current video frame into a tiny canvas a few
 * times per second; CSS blur + scale turn it into a soft glow that follows
 * the colors of the scene. Same-origin video, so the canvas is never tainted.
 */
export function Ambient({ videoRef, className }: { videoRef: React.RefObject<HTMLVideoElement | null>; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < (reduce ? 2000 : 150)) return;
      last = now;
      const v = videoRef.current;
      if (!v || v.readyState < 2 || document.hidden) return;
      try {
        // Blend with the previous frame so the glow drifts instead of flickering.
        ctx.globalAlpha = canvas.dataset.ready ? 0.25 : 1;
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        canvas.dataset.ready = "1";
      } catch {
        /* not ready / cross-origin */
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [videoRef]);

  return (
    <canvas
      ref={canvasRef}
      width={32}
      height={32}
      aria-hidden
      className={clsx(
        "pointer-events-none absolute opacity-0 blur-[60px] saturate-150 transition-opacity duration-1000 data-[ready=1]:opacity-70",
        className,
      )}
    />
  );
}
