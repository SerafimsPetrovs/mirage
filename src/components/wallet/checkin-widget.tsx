"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Gift } from "lucide-react";
import { CHECKIN_REWARDS } from "@/lib/rewards";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { btn } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { checkInAction } from "@/app/actions/wallet";

type State = { doneToday: boolean; streak: number; nextReward: number | null };

export function CheckInWidget({ state, compact }: { state: State; compact?: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [local, setLocal] = useState(state);
  // Position within the 7-day cycle: completed days in current cycle
  const doneInCycle = local.doneToday ? ((local.streak - 1) % 7) + 1 : local.streak % 7;

  const claim = () =>
    start(async () => {
      const res = await checkInAction();
      if (res.ok && res.reward) {
        toast(fmt(t.checkin.got, { n: res.reward }), "coin");
        setLocal({ doneToday: true, streak: res.streak!, nextReward: null });
        router.refresh();
      }
    });

  return (
    <div
      className={clsx("rounded-3xl p-4 ring-1 ring-line md:p-5", compact ? "md:flex md:items-center md:gap-8" : "")}
      style={{ background: "radial-gradient(90% 160% at 0% 0%, rgba(255,200,61,.16), transparent 55%), var(--surface)" }}
    >
      <div className="mb-4 flex items-center gap-3 md:mb-0 md:min-w-[220px]">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-coin/15 text-coin">
          <Gift size={22} />
        </span>
        <div>
          <p className="font-display text-[15px] font-semibold">{t.checkin.title}</p>
          <p className="text-xs text-muted">{t.checkin.sub}</p>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-7 gap-1.5 md:gap-2">
        {CHECKIN_REWARDS.map((r, i) => {
          const done = i < doneInCycle;
          const today = !local.doneToday && i === doneInCycle;
          return (
            <div
              key={i}
              className={clsx(
                "flex flex-col items-center rounded-xl py-2 text-center ring-1 transition",
                done ? "bg-coin/15 ring-coin/30" : today ? "bg-white/8 ring-white/30" : "bg-surface-2 ring-line",
                i === 6 && !done && "ring-coin/40",
              )}
            >
              <span className="text-[10px] text-muted">{fmt(t.checkin.day, { n: i + 1 })}</span>
              {done ? <Check size={16} className="my-0.5 text-coin" /> : <span className={clsx("text-sm font-bold tabular-nums", i === 6 ? "text-coin" : "")}>+{r}</span>}
            </div>
          );
        })}
      </div>
      <div className="mt-4 md:mt-0">
        {local.doneToday ? (
          <span className={btn("glass", "md", "w-full pointer-events-none text-muted md:w-auto")}>
            <Check size={18} /> {t.checkin.claimed}
          </span>
        ) : (
          <button onClick={claim} disabled={pending} className={btn("coin", "md", "w-full md:w-auto")}>
            <Gift size={18} /> {fmt(t.checkin.claim, { n: local.nextReward ?? CHECKIN_REWARDS[doneInCycle] })}
          </button>
        )}
      </div>
    </div>
  );
}
