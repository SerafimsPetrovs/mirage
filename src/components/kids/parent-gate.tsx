"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Coins, Loader2 } from "lucide-react";
import { btn } from "@/components/ui/button";
import { PinInput } from "@/components/ui/modal";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { kidsAutoUnlockAction, parentUnlockAction } from "@/app/actions/kids";

/**
 * Kids mode replacement for the paywall: coins are never spent in one tap.
 * A parent types the PIN; optionally allows auto-opening this series for the rest of the day.
 */
export function ParentGate({ episodeId, price, autoAllowed }: { episodeId: string; price: number; autoAllowed: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pin, setPin] = useState("");
  const [allow, setAllow] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [auto, setAuto] = useState(autoAllowed);
  const tried = useRef(false);

  // Parent already allowed this cartoon today → open without asking.
  useEffect(() => {
    if (!autoAllowed || tried.current) return;
    tried.current = true;
    kidsAutoUnlockAction(episodeId).then((r) => {
      if (r.ok) router.refresh();
      else {
        setAuto(false);
        if (r.error === "insufficient") setErr(t.kids.noCoins);
      }
    });
  }, [autoAllowed, episodeId, router, t.kids.noCoins]);

  const submit = (value: string) =>
    start(async () => {
      const r = await parentUnlockAction(episodeId, value, allow);
      if (r.ok) return router.refresh();
      setPin("");
      setErr(r.error === "insufficient" ? t.kids.noCoins : r.error === "locked" ? t.kids.lockedPin : t.kids.wrongPin);
    });

  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-gradient-to-t from-[#1d1747] via-[#1d1747]/80 to-[#1d1747]/30 p-4 backdrop-blur-md md:items-center">
      <div className="animate-fade-up w-full max-w-sm rounded-[32px] bg-surface/95 p-6 text-center ring-1 ring-white/15">
        {auto ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 size={32} className="animate-spin text-accent" />
            <p className="font-display font-semibold">{t.kids.autoOpening}</p>
          </div>
        ) : (
          <>
            <div className="mx-auto mb-3 text-5xl" aria-hidden>
              🧸
            </div>
            <h2 className="font-display text-xl font-bold">{t.kids.gateTitle}</h2>
            <p className="mt-2 text-sm text-muted">{t.kids.gateText}</p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-coin">
              <Coins size={15} /> {fmt(t.kids.gatePrice, { price })}
            </p>
            <div className="mt-5" aria-busy={pending}>
              <PinInput
                value={pin}
                onChange={(v) => {
                  setPin(v);
                  setErr(null);
                  if (v.length === 4) submit(v);
                }}
                label={t.kids.exitText}
                error={!!err}
              />
            </div>
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-white/5 p-3 text-left text-sm ring-1 ring-line">
              <input type="checkbox" checked={allow} onChange={(e) => setAllow(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]" />
              <span>{t.kids.allowToday}</span>
            </label>
            <p className="mt-3 min-h-5 text-sm text-red-300" role="alert">
              {err}
            </p>
            <button onClick={() => pin.length === 4 && submit(pin)} disabled={pending || pin.length !== 4} className={btn("primary", "lg", "mt-1 w-full")}>
              {t.kids.open}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
