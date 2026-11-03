import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "glass" | "vip" | "coin" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-2 shadow-[0_8px_30px_-8px_rgba(255,46,99,.6)]",
  secondary: "bg-white text-black hover:bg-white/85",
  ghost: "text-text hover:bg-white/8",
  glass: "glass text-text hover:bg-white/12",
  vip: "bg-mirage text-white shadow-[0_8px_30px_-8px_rgba(124,92,255,.7)] hover:brightness-110",
  coin: "bg-coin text-black hover:brightness-105 shadow-[0_8px_30px_-10px_rgba(255,200,61,.7)]",
  danger: "bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/30",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5 rounded-xl",
  md: "h-11 px-5 text-[15px] gap-2 rounded-2xl",
  lg: "h-13 px-7 text-base gap-2.5 rounded-2xl",
  icon: "h-10 w-10 rounded-full justify-center",
};

export function btn(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return clsx(
    "inline-flex items-center justify-center font-semibold whitespace-nowrap select-none transition-all duration-200 ease-out active:scale-[.97] disabled:opacity-50 disabled:pointer-events-none",
    variants[variant],
    sizes[size],
    extra,
  );
}

export const inputCls =
  "w-full h-12 rounded-2xl bg-surface-2 border border-line px-4 text-[15px] text-text placeholder:text-muted/70 outline-none transition focus:border-accent/60 focus:bg-surface-3";

export const textareaCls =
  "w-full rounded-2xl bg-surface-2 border border-line px-4 py-3 text-[15px] text-text placeholder:text-muted/70 outline-none transition focus:border-accent/60 focus:bg-surface-3 resize-y";

export const labelCls = "block text-sm font-medium text-muted mb-1.5";

export const cardCls = "rounded-3xl bg-surface border border-line";
