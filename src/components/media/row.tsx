"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";

/** Horizontal scroller with desktop arrow buttons and edge fades. */
export function Row({ children, className, gap = "gap-3 md:gap-4" }: { children: React.ReactNode; className?: string; gap?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: "smooth" });

  return (
    <div className={clsx("group/row relative", className)}>
      <div ref={ref} className={clsx("no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-px-4 px-4 pb-2 md:scroll-px-10 md:px-10", gap)}>
        {children}
      </div>
      {!edges.start && (
        <button
          aria-label="Prev"
          onClick={() => scroll(-1)}
          className="glass absolute left-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full opacity-0 transition group-hover/row:opacity-100 md:flex"
        >
          <ChevronLeft size={22} />
        </button>
      )}
      {!edges.end && (
        <button
          aria-label="Next"
          onClick={() => scroll(1)}
          className="glass absolute right-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full opacity-0 transition group-hover/row:opacity-100 md:flex"
        >
          <ChevronRight size={22} />
        </button>
      )}
    </div>
  );
}

export function RowItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("snap-start", className)}>{children}</div>;
}
