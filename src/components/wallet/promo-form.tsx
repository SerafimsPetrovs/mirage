"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, TicketPercent } from "lucide-react";
import { btn, inputCls } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { redeemPromoAction } from "@/app/actions/promo";

export function PromoForm({ initial = "" }: { initial?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [code, setCode] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    start(async () => {
      const r = await redeemPromoAction(code);
      if (!r.ok) return setErr(t.promo.errors[r.error]);
      setCode("");
      toast(fmt(r.kind === "COINS" ? t.promo.gotCoins : t.promo.gotVip, { n: r.value }), r.kind === "COINS" ? "coin" : "ok");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="rounded-3xl bg-surface p-4 ring-1 ring-line md:p-5">
      <label htmlFor="promo" className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <TicketPercent size={18} className="text-accent" /> {t.promo.title}
      </label>
      <div className="flex max-w-xl gap-2">
        <input
          id="promo"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setErr(null);
          }}
          placeholder={t.promo.placeholder}
          autoComplete="off"
          spellCheck={false}
          maxLength={40}
          aria-invalid={!!err}
          aria-describedby="promo-err"
          className={inputCls + " font-mono uppercase tracking-wider placeholder:font-sans placeholder:normal-case placeholder:tracking-normal"}
        />
        <button type="submit" disabled={pending || !code.trim()} className={btn("primary", "md", "h-12 shrink-0")}>
          {pending && <Loader2 size={16} className="animate-spin" />} {t.promo.apply}
        </button>
      </div>
      <p id="promo-err" className="mt-2 min-h-5 text-sm text-red-300" role="alert">
        {err}
      </p>
    </form>
  );
}
