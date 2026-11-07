"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Gem, Hourglass, Loader2, Plus, Trophy, X } from "lucide-react";
import { btn, inputCls, labelCls } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { cancelPredictionAction, createPredictionAction, resolvePredictionAction } from "@/app/actions/predictions";
import { PREDICTION_OPTIONS_MAX } from "@/lib/gold-rules";

type Item = {
  id: string;
  question: string;
  episodeNumber: number;
  status: string;
  canResolve: boolean;
  pool: number;
  options: { id: string; label: string; correct: boolean; bets: number }[];
  custom: { id: string; text: string; name: string; ok: boolean }[];
};

export function PredictionManager({ episodes, items }: { episodes: { id: string; number: number }[]; items: Item[] }) {
  const { t } = useI18n();
  const ts = t.pred.studio;
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [episodeId, setEpisodeId] = useState(episodes.at(-1)?.id ?? "");
  const [qEn, setQEn] = useState("");
  const [qRu, setQRu] = useState("");
  const [opts, setOpts] = useState([{ en: "", ru: "" }, { en: "", ru: "" }]);
  const [allowCustom, setAllowCustom] = useState(true);

  const create = () =>
    start(async () => {
      const r = await createPredictionAction({ episodeId, questionEn: qEn, questionRu: qRu, options: opts, allowCustom });
      if (!r.ok) return toast(t.pred.errors[r.error] ?? t.common.error, "error");
      toast(ts.created);
      setQEn("");
      setQRu("");
      setOpts([{ en: "", ru: "" }, { en: "", ru: "" }]);
      router.refresh();
    });

  const filled = opts.filter((o) => o.en.trim() || o.ru.trim()).length;

  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-muted">{ts.sub}</p>

      {episodes.length > 0 && (
        <div className="space-y-4 rounded-2xl bg-surface-2/50 p-4 ring-1 ring-line">
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <div>
              <label htmlFor="pr-ep" className={labelCls}>{ts.afterEpisode}</label>
              <select id="pr-ep" value={episodeId} onChange={(e) => setEpisodeId(e.target.value)} className={inputCls}>
                {episodes.map((e) => <option key={e.id} value={e.id}>{fmt(ts.episodeOption, { n: e.number })}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="pr-q" className={labelCls}>{ts.question}</label>
              <input id="pr-q" value={qEn} onChange={(e) => setQEn(e.target.value)} maxLength={200} placeholder={ts.questionPh} className={inputCls} />
            </div>
          </div>
          <div>
            <label htmlFor="pr-qru" className={labelCls}>{ts.questionRu}</label>
            <input id="pr-qru" value={qRu} onChange={(e) => setQRu(e.target.value)} maxLength={200} className={inputCls} />
          </div>
          <div>
            <p className={labelCls}>{ts.options}</p>
            <div className="space-y-2">
              {opts.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <input aria-label={fmt(ts.optionEn, { n: i + 1 })} placeholder={fmt(ts.optionEn, { n: i + 1 })} value={o.en} maxLength={100} onChange={(e) => setOpts((xs) => xs.map((x, k) => (k === i ? { ...x, en: e.target.value } : x)))} className={inputCls} />
                  <input aria-label={`${ts.optionRu} ${i + 1}`} placeholder={ts.optionRu} value={o.ru} maxLength={100} onChange={(e) => setOpts((xs) => xs.map((x, k) => (k === i ? { ...x, ru: e.target.value } : x)))} className={inputCls + " max-w-[40%]"} />
                  <button type="button" aria-label={t.common.delete} disabled={opts.length <= 2} onClick={() => setOpts((xs) => xs.filter((_, k) => k !== i))} className={btn("ghost", "icon", "shrink-0 disabled:opacity-30")}>
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            {opts.length < PREDICTION_OPTIONS_MAX && (
              <button type="button" onClick={() => setOpts((xs) => [...xs, { en: "", ru: "" }])} className={btn("glass", "sm", "mt-2")}>
                <Plus size={15} /> {ts.addOption}
              </button>
            )}
          </div>
          <label className="flex items-start gap-3 text-sm text-muted">
            <input type="checkbox" checked={allowCustom} onChange={(e) => setAllowCustom(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
            {ts.allowCustom}
          </label>
          <button onClick={create} disabled={pending || !(qEn.trim() || qRu.trim()) || filled < 2} className={btn("coin", "md")}>
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Gem size={16} />} {ts.create}
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted">{ts.none}</p>
      ) : (
        <div className="space-y-3">
          {items.map((p) => <PredictionRow key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}

function PredictionRow({ p }: { p: Item }) {
  const { t } = useI18n();
  const ts = t.pred.studio;
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [correct, setCorrect] = useState<string[]>([]);
  const [customOk, setCustomOk] = useState<string[]>([]);
  const statusKey = p.status === "OPEN" ? (p.canResolve ? "WAIT" : "OPEN") : (p.status as "RESOLVED" | "CANCELED");
  const bets = p.options.reduce((a, o) => a + o.bets, 0) + p.custom.length;
  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <div className="rounded-2xl bg-surface-2/50 p-4 ring-1 ring-line">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted">{fmt(ts.episodeOption, { n: p.episodeNumber })}</p>
          <p className="font-semibold">{p.question}</p>
        </div>
        <span className={clsx("rounded-full px-2.5 py-1 text-xs font-semibold", statusKey === "RESOLVED" ? "bg-ok/15 text-ok" : statusKey === "CANCELED" ? "bg-white/8 text-muted" : statusKey === "WAIT" ? "bg-coin/15 text-coin" : "bg-accent/15 text-accent")}>
          {ts.status[statusKey]}
        </span>
      </div>
      <p className="mt-1 flex items-center gap-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1 text-amber-300"><Gem size={12} /> {fmt(ts.pool, { n: p.pool })}</span>
        <span>{fmt(ts.bets, { n: bets })}</span>
      </p>

      {p.status === "OPEN" && !p.canResolve && (
        <p className="mt-3 flex items-start gap-2 text-sm text-muted"><Hourglass size={15} className="mt-0.5 shrink-0" /> {fmt(ts.waitNext, { n: p.episodeNumber + 1 })}</p>
      )}

      {p.status !== "OPEN" || !p.canResolve ? (
        <ul className="mt-3 space-y-1 text-sm">
          {p.options.map((o) => (
            <li key={o.id} className={clsx("flex items-center gap-2", o.correct ? "text-ok" : "text-muted")}>
              {o.correct ? <Trophy size={14} /> : <span className="h-1.5 w-1.5 rounded-full bg-white/30" />} {o.label} <span className="text-xs">· {o.bets}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 space-y-3">
          <div>
            <p className="mb-1.5 text-sm font-medium">{ts.pickCorrect}</p>
            <div className="flex flex-wrap gap-2">
              {p.options.map((o) => (
                <button key={o.id} aria-pressed={correct.includes(o.id)} onClick={() => toggle(correct, setCorrect, o.id)} className={clsx("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1", correct.includes(o.id) ? "bg-ok/15 text-ok ring-ok/60" : "ring-line hover:ring-white/25")}>
                  {correct.includes(o.id) && <Check size={14} />} {o.label} <span className="text-xs text-muted">· {o.bets}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">{ts.customTitle}</p>
            {p.custom.length === 0 ? (
              <p className="text-xs text-muted">{ts.noCustom}</p>
            ) : (
              <ul className="max-h-64 space-y-1.5 overflow-y-auto">
                {p.custom.map((c) => (
                  <li key={c.id}>
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" checked={customOk.includes(c.id)} onChange={() => toggle(customOk, setCustomOk, c.id)} className="mt-0.5 h-4 w-4 accent-[var(--ok)]" />
                      <span>“{c.text}” <span className="text-xs text-muted">— {c.name}</span></span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await resolvePredictionAction(p.id, correct, customOk);
                  if (!r.ok) return toast(t.pred.errors[r.error] ?? t.common.error, "error");
                  toast(fmt(ts.resolved, { w: r.winners, b: r.bets }));
                  router.refresh();
                })
              }
              className={btn("primary", "sm")}
            >
              <Trophy size={15} /> {ts.resolve}
            </button>
          </div>
        </div>
      )}

      {p.status === "OPEN" && (
        <button
          disabled={pending}
          onClick={() =>
            confirm(ts.confirmCancel) &&
            start(async () => {
              const r = await cancelPredictionAction(p.id);
              if (!r.ok) return toast(t.pred.errors[r.error] ?? t.common.error, "error");
              toast(ts.canceled);
              router.refresh();
            })
          }
          className="mt-3 text-xs text-muted underline-offset-2 hover:text-red-300 hover:underline"
        >
          {ts.cancel}
        </button>
      )}
    </div>
  );
}
