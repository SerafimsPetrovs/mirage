"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Eye, EyeOff, Gem, Hourglass, Loader2, PenLine, Sparkles, Trophy, X } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { btn, inputCls } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { placeBetAction } from "@/app/actions/predictions";
import { BET_MAX, BET_MIN, CUSTOM_MAX, CUSTOM_MULTIPLIER, MAX_MULTIPLIER, MIN_MULTIPLIER } from "@/lib/gold-rules";
import type { PredictionView } from "@/lib/predictions";

const STAKES = [10, 25, 50, 100];

export function GoldAmount({ value, className, size = 15 }: { value: number | string; className?: string; size?: number }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 font-semibold tabular-nums text-amber-300", className)}>
      <Gem size={size} strokeWidth={2} />
      {value}
    </span>
  );
}

/**
 * "Guess what happens next": pick a ready answer or write your own and stake gold.
 * The split of guesses stays hidden until the creator reveals the answer after the next episode.
 */
export function PredictionCard({ prediction: p, loggedIn, canPlay, gold: gold0, compact }: { prediction: PredictionView; loggedIn: boolean; canPlay: boolean; gold: number; compact?: boolean }) {
  const { t } = useI18n();
  const tp = t.pred;
  const router = useRouter();
  const toast = useToast();
  const [gold, setGold] = useState(gold0);
  const [optionId, setOptionId] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [stake, setStake] = useState(25);
  const [mine, setMine] = useState(p.mine);
  const [pending, start] = useTransition();
  const next = p.episodeNumber + 1;

  const choiceOk = customMode ? custom.trim().length >= 3 : !!optionId;
  const stakeOk = stake >= BET_MIN && stake <= BET_MAX && stake <= gold;

  const submit = () => {
    if (!loggedIn) return router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
    start(async () => {
      const r = await placeBetAction(p.id, customMode ? { customText: custom, stake } : { optionId: optionId!, stake });
      if (!r.ok) return toast(tp.errors[r.error] ?? t.common.error, "error");
      setGold(r.gold);
      setMine({ optionId: customMode ? null : optionId, customText: customMode ? custom.trim() : null, stake, status: "PENDING", payout: 0 });
      toast(fmt(tp.placed, { n: next }));
    });
  };

  const myLabel = mine ? (mine.optionId ? p.options.find((o) => o.id === mine.optionId)?.label : `“${mine.customText}”`) : null;

  return (
    <div
      className={clsx("rounded-3xl ring-1 ring-line", compact ? "p-4" : "p-5 md:p-6")}
      style={{ background: "radial-gradient(100% 140% at 0% 0%, rgba(255,200,61,.16), transparent 55%), var(--surface)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-300">
            <Sparkles size={14} /> {fmt(tp.kicker, { n: next })}
          </p>
          <h3 className="mt-1.5 font-display text-lg font-semibold leading-snug md:text-xl">{p.question}</h3>
        </div>
        {loggedIn && canPlay && <GoldAmount value={gold} className="shrink-0 rounded-full bg-amber-300/10 px-2.5 py-1 text-sm" />}
      </div>

      {p.status === "RESOLVED" ? (
        <Resolved p={p} myLabel={myLabel} mine={mine} />
      ) : mine ? (
        <div className="mt-4 rounded-2xl bg-surface-2/70 p-4 ring-1 ring-line">
          <p className="text-sm text-muted">{tp.yourGuess}</p>
          <p className="mt-0.5 font-semibold">{myLabel}</p>
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted">
            {tp.stake}: <GoldAmount value={mine.stake} />
          </p>
          <p className="mt-3 flex items-start gap-2 text-sm text-muted">
            <Hourglass size={15} className="mt-0.5 shrink-0" /> {p.awaiting ? tp.awaiting : fmt(tp.waitNext, { n: next })}
          </p>
        </div>
      ) : !p.open ? (
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-surface-2/70 p-4 text-sm text-muted ring-1 ring-line">
          <Hourglass size={15} className="mt-0.5 shrink-0" /> {tp.closedNoBet}
        </p>
      ) : !canPlay ? (
        <p className="mt-3 text-sm text-muted">{tp.ownSeries}</p>
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed text-muted">{fmt(tp.explain, { n: next })}</p>

          <div className="mt-4 grid gap-2" role="radiogroup" aria-label={p.question}>
            {p.options.map((o) => {
              const active = !customMode && optionId === o.id;
              return (
                <button
                  key={o.id}
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setCustomMode(false);
                    setOptionId(o.id);
                  }}
                  className={clsx(
                    "flex min-h-12 items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-[15px] ring-1 transition",
                    active ? "bg-amber-300/12 ring-2 ring-amber-300/80" : "bg-surface-2/70 ring-line hover:ring-white/20",
                  )}
                >
                  <span className={clsx("flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-2", active ? "bg-amber-300 text-black ring-amber-300" : "ring-white/25")}>
                    {active && <Check size={13} strokeWidth={3} />}
                  </span>
                  {o.label}
                </button>
              );
            })}
            {p.allowCustom &&
              (customMode ? (
                <div className="rounded-2xl bg-amber-300/8 p-3 ring-2 ring-amber-300/60">
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={custom}
                      onChange={(e) => setCustom(e.target.value)}
                      maxLength={CUSTOM_MAX}
                      placeholder={tp.customPh}
                      aria-label={tp.custom}
                      className={inputCls + " h-11"}
                    />
                    <button aria-label={t.common.cancel} onClick={() => setCustomMode(false)} className={btn("ghost", "icon", "shrink-0")}>
                      <X size={16} />
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-muted">{fmt(tp.customHint, { x: CUSTOM_MULTIPLIER })}</p>
                </div>
              ) : (
                <button onClick={() => setCustomMode(true)} className="flex min-h-12 items-center gap-3 rounded-2xl border border-dashed border-white/20 px-4 py-2.5 text-left text-sm text-muted transition hover:border-white/40 hover:text-text">
                  <PenLine size={17} /> {tp.custom}
                </button>
              ))}
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">{tp.stake}</p>
            <div className="flex flex-wrap gap-2">
              {STAKES.map((s) => (
                <button
                  key={s}
                  aria-pressed={stake === s}
                  onClick={() => setStake(s)}
                  disabled={loggedIn && s > gold}
                  className={clsx("h-10 rounded-full px-4 text-sm font-semibold tabular-nums ring-1 transition disabled:opacity-35", stake === s ? "bg-amber-300 text-black ring-amber-300" : "bg-surface-2 ring-line hover:ring-white/25")}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {customMode
                ? fmt(tp.winCustom, { w: stake * CUSTOM_MULTIPLIER })
                : fmt(tp.winRange, { min: Math.floor(stake * MIN_MULTIPLIER), max: stake * MAX_MULTIPLIER })}
            </p>
          </div>

          <button onClick={submit} disabled={pending || (loggedIn && (!choiceOk || !stakeOk))} className={btn("coin", "lg", "mt-4 w-full")}>
            {pending ? <Loader2 size={18} className="animate-spin" /> : <Gem size={18} />}
            {loggedIn ? fmt(tp.place, { n: stake }) : tp.loginToPlay}
          </button>
          {loggedIn && gold < BET_MIN + 5 && (
            <p className="mt-2 text-center text-xs text-muted">
              {tp.lowGold}{" "}
              <Link href="/me/wallet#gold" className="text-amber-300 underline underline-offset-2">{tp.howToEarn}</Link>
            </p>
          )}
          <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-muted">
            <EyeOff size={13} className="mt-0.5 shrink-0" /> {tp.hidden}
          </p>
        </>
      )}
    </div>
  );
}

function Resolved({ p, myLabel, mine }: { p: PredictionView; myLabel: string | null | undefined; mine: PredictionView["mine"] }) {
  const { t } = useI18n();
  const tp = t.pred;
  return (
    <div className="mt-4 space-y-2">
      {p.options.map((o) => (
        <div key={o.id} className={clsx("relative overflow-hidden rounded-2xl px-4 py-3 ring-1", o.correct ? "ring-2 ring-ok/70" : "ring-line")}>
          <div className={clsx("absolute inset-y-0 left-0", o.correct ? "bg-ok/20" : "bg-white/6")} style={{ width: `${o.share ?? 0}%` }} />
          <div className="relative flex items-center justify-between gap-3 text-[15px]">
            <span className="flex items-center gap-2">
              {o.correct && <Check size={16} className="text-ok" />}
              {o.label}
            </span>
            <span className="tabular-nums text-muted">{o.share ?? 0}%</span>
          </div>
        </div>
      ))}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1"><Eye size={13} /> {fmt(tp.players, { n: p.players ?? 0 })}</span>
        {p.multiplier && <span>{fmt(tp.paidX, { x: p.multiplier })}</span>}
      </p>
      {mine && (
        <div className={clsx("mt-2 flex items-center gap-3 rounded-2xl p-4", mine.status === "WON" ? "bg-ok/12 text-ok" : "bg-surface-2/70 text-muted")}>
          {mine.status === "WON" ? <Trophy size={20} /> : <X size={20} />}
          <div className="text-sm">
            <p className="font-semibold">{mine.status === "WON" ? fmt(tp.won, { n: mine.payout }) : mine.status === "REFUNDED" ? tp.refunded : tp.lost}</p>
            <p className="opacity-80">{fmt(tp.yourWas, { g: myLabel ?? "", n: mine.stake })}</p>
          </div>
        </div>
      )}
    </div>
  );
}
