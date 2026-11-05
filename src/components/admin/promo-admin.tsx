"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Plus, Power } from "lucide-react";
import clsx from "clsx";
import { btn, inputCls, labelCls } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { createPromoAction, togglePromoAction } from "@/app/actions/promo";

export function PromoCreateForm() {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<"COINS" | "VIP_DAYS">("COINS");
  const [err, setErr] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    start(async () => {
      const r = await createPromoAction(data);
      if (!r.ok) return setErr(r.error === "duplicate" ? t.promo.duplicate : r.error === "badCode" ? t.promo.badCode : t.common.error);
      setErr(null);
      form.reset();
      setKind("COINS");
      toast(`${t.promo.created}: ${r.code}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="rounded-3xl bg-surface p-5 ring-1 ring-line md:p-6">
      <h2 className="mb-4 font-display text-lg font-semibold">{t.promo.create}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className={labelCls} htmlFor="pc-code">{t.promo.code}</label>
          <input id="pc-code" name="code" maxLength={32} placeholder={t.promo.codeHint} className={inputCls + " font-mono uppercase placeholder:font-sans placeholder:normal-case"} />
        </div>
        <div>
          <label className={labelCls} htmlFor="pc-kind">{t.promo.kind}</label>
          <select id="pc-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={inputCls}>
            <option value="COINS">{t.promo.kinds.COINS}</option>
            <option value="VIP_DAYS">{t.promo.kinds.VIP_DAYS}</option>
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="pc-value">{t.promo.value}</label>
          <input id="pc-value" name="value" type="number" min={1} max={kind === "VIP_DAYS" ? 365 : 100000} required defaultValue={kind === "VIP_DAYS" ? 7 : 100} key={kind} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="pc-max">{t.promo.maxUses}</label>
          <input id="pc-max" name="maxUses" type="number" min={1} placeholder={t.promo.maxUsesHint} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="pc-exp">{t.promo.expiresDays}</label>
          <input id="pc-exp" name="expiresDays" type="number" min={1} max={3650} placeholder={t.promo.expiresHint} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="pc-note">{t.promo.note}</label>
          <input id="pc-note" name="note" maxLength={200} className={inputCls} />
        </div>
      </div>
      <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" name="newUsersOnly" className="h-4 w-4 accent-[var(--accent)]" /> {t.promo.newUsersOnly}
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={btn("primary", "md")}>
          {pending ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} {t.promo.create}
        </button>
        <p className="text-sm text-red-300" role="alert">{err}</p>
      </div>
    </form>
  );
}

export function PromoRowActions({ id, code, active }: { id: string; code: string; active: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-1.5">
      <button
        onClick={() => navigator.clipboard?.writeText(code).then(() => toast(t.series.copied))}
        className={btn("ghost", "sm")}
        aria-label={t.payouts.copy}
        title={code}
      >
        <Copy size={15} />
      </button>
      <button
        disabled={pending}
        onClick={() => start(async () => { await togglePromoAction(id, !active); router.refresh(); })}
        className={clsx(btn(active ? "danger" : "glass", "sm"))}
      >
        <Power size={15} /> {active ? t.promo.disable : t.promo.enable}
      </button>
    </div>
  );
}
