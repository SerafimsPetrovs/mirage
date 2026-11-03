import clsx from "clsx";
import { Coins, Crown, Sparkles } from "lucide-react";

export function Avatar({ name, hue, size = 36, className }: { name: string; hue: number; size?: number; className?: string }) {
  return (
    <span
      className={clsx("inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-white", className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, hsl(${hue} 80% 58%), hsl(${(hue + 50) % 360} 75% 38%))`,
      }}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

export function CoinAmount({ value, className, size = 16 }: { value: number | string; className?: string; size?: number }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 font-semibold tabular-nums text-coin", className)}>
      <Coins size={size} strokeWidth={2} />
      {value}
    </span>
  );
}

export function AiChip({ label, className }: { label: string; className?: string }) {
  return (
    <span className={clsx("glass inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide text-text/90", className)}>
      <Sparkles size={11} className="text-vip" />
      {label}
    </span>
  );
}

export function VipBadge({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full bg-vip/15 px-2 py-0.5 text-[11px] font-bold text-vip", className)}>
      <Crown size={11} />
      VIP
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx("font-display text-[22px] font-bold tracking-[0.08em]", className)}>
      <span className="text-mirage">MIRAGE</span>
    </span>
  );
}

export function SectionTitle({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4 px-4 md:mb-4 md:px-10">
      <div>
        <h2 className="font-display text-lg font-semibold md:text-[22px]">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-muted">{icon}</div>
      <p className="font-display text-base font-semibold">{title}</p>
      {text && <p className="mt-1.5 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
