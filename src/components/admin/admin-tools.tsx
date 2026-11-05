"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown, Loader2, LogOut, Trash2 } from "lucide-react";
import { btn, inputCls, labelCls } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import {
  adjustCoinsAction,
  deleteEpisodeAction,
  deleteSeriesAction,
  fulfillOrderAction,
  setChartRankAction,
  setEpisodePriceAction,
  setGenCreditsAction,
  setVipAction,
  updateSeriesAdminAction,
  userToolAction,
  type AdminResult,
} from "@/app/actions/admin-tools";

function useAdmin() {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<AdminResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(t.adm.errors[r.error as keyof typeof t.adm.errors] ?? t.common.error, "error");
      toast(t.adm.done);
      after?.();
      router.refresh();
    });
  return { t, pending, run, router };
}

const box = "rounded-3xl bg-surface p-5 ring-1 ring-line";

export function CoinsForm({ userId }: { userId: string }) {
  const { t, pending, run } = useAdmin();
  const [amount, setAmount] = useState("");
  const [bucket, setBucket] = useState<"paid" | "bonus">("bonus");
  const [note, setNote] = useState("");
  return (
    <form
      className={box}
      onSubmit={(e) => {
        e.preventDefault();
        run(() => adjustCoinsAction(userId, Number(amount), bucket, note), () => {
          setAmount("");
          setNote("");
        });
      }}
    >
      <h3 className="mb-3 font-display text-lg font-semibold">{t.adm.coinsTitle}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="adm-amount">{t.adm.amount}</label>
          <input id="adm-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100 / -50" className={inputCls} required />
        </div>
        <div>
          <label className={labelCls} htmlFor="adm-bucket">{t.adm.bucket}</label>
          <select id="adm-bucket" value={bucket} onChange={(e) => setBucket(e.target.value as "paid" | "bonus")} className={inputCls}>
            <option value="bonus">{t.adm.bucketBonus}</option>
            <option value="paid">{t.adm.bucketPaid}</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="adm-note">{t.adm.note}</label>
          <input id="adm-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className={inputCls} />
        </div>
      </div>
      <button disabled={pending || !Number(amount)} className={btn("coin", "md", "mt-4")}>
        {pending && <Loader2 size={16} className="animate-spin" />} {t.adm.apply}
      </button>
    </form>
  );
}

export function VipForm({ userId, active }: { userId: string; active: boolean }) {
  const { t, pending, run } = useAdmin();
  const [days, setDays] = useState("30");
  return (
    <div className={box}>
      <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
        <Crown size={18} className="text-vip" /> {t.adm.vipTitle}
      </h3>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-28">
          <label className={labelCls} htmlFor="adm-vip">{t.adm.vipDays}</label>
          <input id="adm-vip" type="number" min={1} max={3650} value={days} onChange={(e) => setDays(e.target.value)} className={inputCls} />
        </div>
        <button disabled={pending} onClick={() => run(() => setVipAction(userId, Number(days)))} className={btn("vip", "md")}>
          {t.adm.vipGive}
        </button>
        {active && (
          <button disabled={pending} onClick={() => run(() => setVipAction(userId, 0))} className={btn("danger", "md")}>
            {t.adm.vipRevoke}
          </button>
        )}
      </div>
    </div>
  );
}

export function CreditsForm({ userId, credits }: { userId: string; credits: number }) {
  const { t, pending, run } = useAdmin();
  const [v, setV] = useState(String(credits));
  return (
    <div className={box}>
      <h3 className="mb-3 font-display text-lg font-semibold">{t.adm.creditsTitle}</h3>
      <div className="flex items-end gap-2">
        <input type="number" min={0} value={v} onChange={(e) => setV(e.target.value)} aria-label={t.adm.creditsTitle} className={inputCls + " w-36"} />
        <button disabled={pending} onClick={() => run(() => setGenCreditsAction(userId, Number(v)))} className={btn("glass", "md")}>
          {t.adm.set}
        </button>
      </div>
    </div>
  );
}

export function UserTools({ userId }: { userId: string }) {
  const { t, pending, run } = useAdmin();
  return (
    <div className={box}>
      <h3 className="mb-3 font-display text-lg font-semibold">{t.adm.tools}</h3>
      <div className="flex flex-wrap gap-2">
        <button disabled={pending} onClick={() => run(() => userToolAction(userId, "logout"))} className={btn("glass", "sm")}>
          <LogOut size={15} /> {t.adm.logout}
        </button>
        <button disabled={pending} onClick={() => run(() => userToolAction(userId, "resetPin"))} className={btn("glass", "sm")}>
          {t.adm.resetPin}
        </button>
        <button disabled={pending} onClick={() => run(() => userToolAction(userId, "resetAdult"))} className={btn("glass", "sm")}>
          {t.adm.resetAdult}
        </button>
      </div>
    </div>
  );
}

export function ChartRankSelect({ seriesId, rank }: { seriesId: string; rank: number | null }) {
  const { t, pending, run } = useAdmin();
  return (
    <select
      aria-label={t.adm.chart}
      title={t.adm.chartHint}
      disabled={pending}
      value={rank ?? ""}
      onChange={(e) => run(() => setChartRankAction(seriesId, e.target.value ? Number(e.target.value) : null))}
      className="h-9 rounded-xl bg-surface-2 px-2 text-sm ring-1 ring-line"
    >
      <option value="">Top-10: {t.adm.chartNone}</option>
      {Array.from({ length: 10 }, (_, i) => (
        <option key={i + 1} value={i + 1}>
          Top-10: #{i + 1}
        </option>
      ))}
    </select>
  );
}

export function SeriesAdminForm({ seriesId, views, price, free }: { seriesId: string; views: number; price: number; free: number }) {
  const { t, pending, run } = useAdmin();
  const [f, setF] = useState({ views: String(views), defaultCoinPrice: String(price), freeEpisodes: String(free), ownerEmail: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form
      className={box}
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateSeriesAdminAction(seriesId, f), () => setF((x) => ({ ...x, ownerEmail: "" })));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelCls} htmlFor="sa-views">{t.adm.views}</label>
          <input id="sa-views" type="number" min={0} value={f.views} onChange={set("views")} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="sa-price">{t.adm.price}</label>
          <input id="sa-price" type="number" min={1} max={500} value={f.defaultCoinPrice} onChange={set("defaultCoinPrice")} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="sa-free">{t.adm.free}</label>
          <input id="sa-free" type="number" min={0} value={f.freeEpisodes} onChange={set("freeEpisodes")} className={inputCls} />
        </div>
        <div className="sm:col-span-3">
          <label className={labelCls} htmlFor="sa-owner">{t.adm.owner}</label>
          <input id="sa-owner" type="email" value={f.ownerEmail} onChange={set("ownerEmail")} placeholder={t.adm.ownerHint} className={inputCls} />
        </div>
      </div>
      <button disabled={pending} className={btn("primary", "md", "mt-4")}>
        {t.adm.save}
      </button>
    </form>
  );
}

export function EpisodeAdminRow({ id, number, title, price, defaultPrice }: { id: string; number: number; title: string; price: number | null; defaultPrice: number }) {
  const { t, pending, run } = useAdmin();
  const [v, setV] = useState(price === null ? "" : String(price));
  return (
    <li className="flex flex-wrap items-center gap-2 py-2">
      <span className="w-8 text-right font-display font-bold text-muted">{number}</span>
      <span className="min-w-0 flex-1 truncate text-sm">{title}</span>
      <input
        type="number"
        min={0}
        max={500}
        value={v}
        placeholder={`${t.adm.epDefault} (${defaultPrice})`}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const next = v === "" ? null : Number(v);
          if (next !== price) run(() => setEpisodePriceAction(id, next));
        }}
        aria-label={t.adm.epPrice}
        className="h-9 w-36 rounded-xl bg-surface-2 px-3 text-sm ring-1 ring-line"
      />
      <button
        disabled={pending}
        onClick={() => confirm(fmt(t.adm.delEpisode, { n: number })) && run(() => deleteEpisodeAction(id))}
        className={btn("ghost", "sm", "h-9 text-red-300")}
        aria-label={t.adm.del}
        title={t.adm.del}
      >
        <Trash2 size={15} />
      </button>
    </li>
  );
}

export function DeleteSeries({ seriesId, slug }: { seriesId: string; slug: string }) {
  const { t, pending, run, router } = useAdmin();
  const [v, setV] = useState("");
  return (
    <div className="rounded-3xl bg-red-500/5 p-5 ring-1 ring-red-500/30">
      <h3 className="font-display text-lg font-semibold text-red-300">{t.adm.dangerTitle}</h3>
      <p className="mt-1 text-sm text-muted">{fmt(t.adm.dangerText, { slug })}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder={slug} aria-label={slug} className={inputCls + " h-10 max-w-xs"} />
        <button disabled={pending || v !== slug} onClick={() => run(() => deleteSeriesAction(seriesId, v), () => router.push("/admin/series"))} className={btn("danger", "md", "h-10")}>
          <Trash2 size={16} /> {t.adm.deleteSeries}
        </button>
      </div>
    </div>
  );
}

export function FulfillOrderButton({ orderId }: { orderId: string }) {
  const { t, pending, run } = useAdmin();
  return (
    <button disabled={pending} onClick={() => run(() => fulfillOrderAction(orderId))} className={btn("coin", "sm")}>
      {t.adm.fulfill}
    </button>
  );
}
