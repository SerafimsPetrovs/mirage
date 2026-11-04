"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Loader2, Send, X } from "lucide-react";
import { btn, inputCls, labelCls } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { fmt, formatMoney, formatNumber } from "@/i18n/shared";
import { PAYOUT_CURRENCY, PAYOUT_METHODS, PAYOUT_MIN_COINS, payoutCents, type PayoutMethod } from "@/lib/payout-rules";
import { cancelPayoutAction, requestPayoutAction, type PayoutResult } from "@/app/actions/payouts";

function useErrorText() {
  const { t, locale } = useI18n();
  return (r: PayoutResult) => (r.ok ? null : fmt(t.payouts.errors[r.error], { min: formatNumber(PAYOUT_MIN_COINS, locale) }));
}

export function PayoutForm({ available }: { available: number }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const errorText = useErrorText();
  const [pending, start] = useTransition();
  const [coins, setCoins] = useState(available);
  const [method, setMethod] = useState<PayoutMethod>("IBAN");
  const [details, setDetails] = useState("");
  const [holder, setHolder] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const valid = Number.isInteger(coins) && coins >= PAYOUT_MIN_COINS && coins <= available && details.trim() && holder.trim().length >= 3;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await requestPayoutAction({ coins, method, details, holderName: holder });
      if (r.ok) {
        toast(t.payouts.sent);
        router.refresh();
      } else setErr(errorText(r));
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={labelCls} htmlFor="po-coins">{t.payouts.amount}</label>
        <div className="flex gap-2">
          <input
            id="po-coins"
            type="number"
            inputMode="numeric"
            min={PAYOUT_MIN_COINS}
            max={available}
            step={1}
            value={Number.isNaN(coins) ? "" : coins}
            onChange={(e) => {
              setCoins(e.target.valueAsNumber);
              setErr(null);
            }}
            className={clsx(inputCls, "tabular-nums")}
          />
          <button type="button" onClick={() => setCoins(available)} className={btn("glass", "md", "shrink-0")}>
            {t.payouts.max}
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">
          {t.payouts.youGet}:{" "}
          <span className="font-semibold text-coin tabular-nums">{formatMoney(payoutCents(Number.isFinite(coins) ? Math.max(0, coins) : 0) / 100, PAYOUT_CURRENCY, locale)}</span>
        </p>
      </div>

      <fieldset>
        <legend className={labelCls}>{t.payouts.method}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PAYOUT_METHODS.map((m) => (
            <label
              key={m}
              className={clsx(
                "flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-sm ring-1 transition",
                method === m ? "bg-white/8 ring-accent/60" : "bg-surface-2 ring-line hover:ring-white/20",
              )}
            >
              <input type="radio" name="method" value={m} checked={method === m} onChange={() => { setMethod(m); setDetails(""); setErr(null); }} className="accent-[var(--accent)]" />
              {t.payouts.methods[m]}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className={labelCls} htmlFor="po-details">{method === "IBAN" ? t.payouts.detailsIBAN : t.payouts.detailsPAYPAL}</label>
        <input
          id="po-details"
          value={details}
          onChange={(e) => { setDetails(e.target.value); setErr(null); }}
          type={method === "PAYPAL" ? "email" : "text"}
          autoComplete={method === "PAYPAL" ? "email" : "off"}
          placeholder={method === "IBAN" ? "DE89 3704 0044 0532 0130 00" : "name@example.com"}
          className={clsx(inputCls, method === "IBAN" && "font-mono uppercase")}
          required
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="po-holder">{t.payouts.holder}</label>
        <input id="po-holder" value={holder} onChange={(e) => { setHolder(e.target.value); setErr(null); }} autoComplete="name" className={inputCls} required maxLength={100} />
      </div>

      <p className="min-h-5 text-sm text-red-300" role="alert">{err}</p>
      <button type="submit" disabled={pending || !valid} className={btn("coin", "lg", "w-full")}>
        {pending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} {t.payouts.submit}
      </button>
    </form>
  );
}

export function CancelPayoutButton({ id }: { id: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const errorText = useErrorText();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await cancelPayoutAction(id);
          if (r.ok) router.refresh();
          else toast(errorText(r) ?? "", "error");
        })
      }
      className={btn("ghost", "sm")}
    >
      <X size={15} /> {t.payouts.cancel}
    </button>
  );
}
