"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";

/**
 * A playful delivery progress: "cooking → on the way → at the door". We don't know the real order status
 * (delivery apps have no consumer API), so it runs on the ETA the orderer typed and says so — it's a timer
 * dressed up, not tracking.
 */
export function FoodProgress({ setAt, etaAt, arrivedAt, clock, compact = false }: { setAt: number; etaAt: number; arrivedAt: number | null; clock: () => number; compact?: boolean }) {
  const { t } = useI18n();
  const f = t.party.food;
  const [now, setNow] = useState(() => clock());
  useEffect(() => {
    const id = window.setInterval(() => setNow(clock()), 1000);
    return () => clearInterval(id);
  }, [clock]);
  const total = Math.max(60_000, etaAt - setAt);
  const p = arrivedAt ? 1 : Math.min(0.98, Math.max(0, (now - setAt) / total));
  const stage = arrivedAt ? 3 : p < 0.35 ? 0 : p < 0.85 ? 1 : 2;
  const stages = [
    { icon: "👨‍🍳", label: f.stageCook },
    { icon: "🛵", label: f.stageRide },
    { icon: "🚪", label: f.stageDoor },
    { icon: "🍕", label: f.arrived },
  ];
  const left = Math.max(0, Math.ceil((etaAt - now) / 60_000));
  return (
    <div className={clsx("rounded-2xl bg-white/[.04] ring-1 ring-line", compact ? "p-3" : "p-4")}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold">
          {stages[stage].icon} {stages[stage].label}
        </span>
        {!arrivedAt && <span className="tabular-nums text-muted">{left ? fmt(f.etaMin, { n: left }) : f.arrivingSoon}</span>}
      </div>
      {/* the road: kitchen → scooter → door */}
      <div className="relative mt-3 h-8" aria-hidden>
        <div className="absolute inset-x-3 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10" />
        <div className="absolute left-3 top-1/2 h-1 -translate-y-1/2 rounded-full bg-coin transition-[width] duration-1000" style={{ width: `calc((100% - 24px) * ${p})` }} />
        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-lg">🍳</span>
        <span className="absolute right-0 top-1/2 -translate-y-1/2 text-lg">🏠</span>
        {stage >= 1 && stage < 3 && (
          <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-xl transition-[left] duration-1000 motion-safe:animate-[float-glow_1.2s_ease-in-out_infinite]" style={{ left: `calc(12px + (100% - 24px) * ${p})` }}>
            🛵
          </span>
        )}
        {stage === 0 && <span className="absolute left-8 top-0 text-sm motion-safe:animate-pulse">💨</span>}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[11px]">
        {stages.map((s, i) => (
          <span key={i} className={clsx(i <= stage ? "text-text" : "text-muted/70")}>{s.label}</span>
        ))}
      </div>
      {!compact && <p className="mt-2 text-[11px] text-muted">{f.progressNote}</p>}
    </div>
  );
}
