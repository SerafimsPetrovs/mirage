"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import clsx from "clsx";

/** Centered dialog (bottom sheet on small phones). Closes on Escape and backdrop click. */
export function Modal({
  open,
  onClose,
  label,
  children,
  className,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
  className?: string;
  dismissible?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // Keep the latest callbacks without re-running the open effect (which moves focus) on every render.
  const closeRef = useRef(onClose);
  const dismissRef = useRef(dismissible);
  useEffect(() => {
    closeRef.current = onClose;
    dismissRef.current = dismissible;
  });
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && dismissRef.current && closeRef.current();
    document.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("input,button:not([data-close])")?.focus();
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-3 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => dismissible && onClose()} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={clsx(
          "animate-pop relative w-full max-w-sm rounded-[28px] bg-surface p-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-line sm:pb-6",
          className,
        )}
      >
        {dismissible && (
          <button
            data-close
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-white/8 hover:text-text"
          >
            <X size={18} />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** 4-digit PIN entry rendered as big dots; one real input underneath for keyboards and autofill. */
export function PinInput({ value, onChange, label, error, autoFocus }: { value: string; onChange: (v: string) => void; label: string; error?: boolean; autoFocus?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <label className="group relative block cursor-text" onClick={() => ref.current?.focus()}>
      <span className="sr-only">{label}</span>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={4}
        autoFocus={autoFocus}
        className="absolute inset-0 h-full w-full opacity-0"
        aria-invalid={error}
      />
      <span className={clsx("flex justify-center gap-3", error && "animate-[shake_.35s_ease-in-out]")}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={clsx(
              "flex h-14 w-12 items-center justify-center rounded-2xl bg-surface-2 ring-1 transition",
              error ? "ring-red-400/70" : i === value.length ? "ring-line group-focus-within:ring-2 group-focus-within:ring-accent" : "ring-line",
            )}
          >
            {value[i] && <span className="h-3.5 w-3.5 rounded-full bg-text" />}
          </span>
        ))}
      </span>
    </label>
  );
}
