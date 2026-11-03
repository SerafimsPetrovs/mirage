"use client";
import { useEffect } from "react";
import { X } from "lucide-react";
import clsx from "clsx";

/** Bottom sheet on mobile, right-side panel on desktop. */
export function Sheet({ open, onClose, title, children, className }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; className?: string }) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open, onClose]);
  return (
    <>
      <div
        className={clsx("fixed inset-0 z-[60] bg-black/50 transition-opacity md:bg-black/30", open ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          "fixed z-[61] flex flex-col bg-surface shadow-2xl transition-transform duration-300 ease-out",
          "inset-x-0 bottom-0 max-h-[78dvh] rounded-t-3xl border-t border-line",
          "md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[420px] md:rounded-none md:rounded-l-3xl md:border-l md:border-t-0",
          open ? "translate-x-0 translate-y-0" : "translate-y-full md:translate-x-full md:translate-y-0",
          className,
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/20 md:hidden" />
        <div className="flex items-center justify-between px-5 pb-3 pt-3 md:pt-5">
          <h2 className="font-display text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/8">
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(20px,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </>
  );
}
