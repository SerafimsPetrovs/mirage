"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const TIMEOUT_MS = 1200;

/**
 * Poster card → series hero morph via the browser View Transitions API.
 * The same series can appear in several rows and transition names must be
 * unique, so only the tapped poster gets a name, right before navigating.
 * The transition's "new" snapshot is taken once the series page has rendered
 * its [data-vt-target] element (or after a short timeout → plain crossfade).
 * Polls with setTimeout: rendering (and rAF) is suppressed during the update callback.
 */
export function PosterMorph() {
  const router = useRouter();
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const link = (e.target as HTMLElement)?.closest<HTMLAnchorElement>("a[href]");
      const img = link?.querySelector<HTMLImageElement>("img[data-vt]");
      if (!link || !img) return;
      const name = img.dataset.vt!;
      const href = link.getAttribute("href")!;
      // Capture phase: take over before next/link's own navigation handler.
      e.preventDefault();
      e.stopPropagation();

      img.style.viewTransitionName = name;
      img.style.setProperty("view-transition-class", "morph");
      document.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            const started = performance.now();
            const check = () => {
              const target = document.querySelector<HTMLElement>(`[data-vt-target="${CSS.escape(name)}"]`);
              if (target) {
                target.style.viewTransitionName = name;
                target.style.setProperty("view-transition-class", "morph");
                return resolve();
              }
              if (performance.now() - started > TIMEOUT_MS) return resolve();
              setTimeout(check, 16);
            };
            router.push(href);
            setTimeout(check, 16);
          }),
      ).finished.finally(() => {
        document.querySelectorAll<HTMLElement>(`[data-vt-target="${CSS.escape(name)}"]`).forEach((el) => (el.style.viewTransitionName = ""));
      });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);
  return null;
}
