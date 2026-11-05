"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Copy, Film, Gift, Loader2, RefreshCw, Send, Sparkles, X } from "lucide-react";
import { btn, inputCls, labelCls, textareaCls } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { promptsFromScript } from "@/lib/show-rules";
import {
  closePollAction,
  generateClipsAction,
  giftCameoAction,
  moderateCameoAction,
  publishScriptAction,
  saveScriptAction,
  writeScriptAction,
  type ShowResult,
} from "@/app/actions/show";

function useRun() {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = <T,>(fn: () => Promise<ShowResult<T>>, okText?: string, onOk?: (r: T) => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        toast(t.show.errors[r.error as keyof typeof t.show.errors] ?? t.common.error, "error");
        return;
      }
      if (okText) toast(okText);
      onOk?.(r as unknown as T);
      router.refresh();
    });
  return { pending, run, t, toast, router };
}

export function ClosePollButton({ pollId }: { pollId: string }) {
  const { pending, run, t } = useRun();
  return (
    <button disabled={pending} onClick={() => run(() => closePollAction(pollId))} className={btn("glass", "sm", "mt-4")}>
      {t.show.closePoll}
    </button>
  );
}

export function CameoActions({ id }: { id: string }) {
  const { pending, run, t } = useRun();
  return (
    <div className="flex gap-1.5">
      <button disabled={pending} onClick={() => run(() => moderateCameoAction(id, "approve"))} className={btn("primary", "sm")}>
        <Check size={15} /> {t.show.approve}
      </button>
      <button disabled={pending} onClick={() => run(() => moderateCameoAction(id, "reject"))} className={btn("danger", "sm")} title={t.show.reject}>
        <X size={15} />
      </button>
    </div>
  );
}

export function GiftCameoForm({ seriesId, userId = null, name: initial = "", compact }: { seriesId: string; userId?: string | null; name?: string; compact?: boolean }) {
  const { pending, run, t } = useRun();
  const [name, setName] = useState(initial);
  if (compact)
    return (
      <button disabled={pending} onClick={() => run(() => giftCameoAction(seriesId, name, userId))} className={btn("ghost", "sm", "h-8 px-2")} title={t.show.gift}>
        <Gift size={15} className="text-accent" />
      </button>
    );
  return (
    <form
      className="mt-4 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => giftCameoAction(seriesId, name, userId), undefined, () => setName(""));
      }}
    >
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.show.giftName} maxLength={24} className={inputCls + " h-10"} />
      <button disabled={pending || name.trim().length < 2} className={btn("glass", "sm", "h-10 shrink-0")}>
        <Gift size={15} /> {t.show.gift}
      </button>
    </form>
  );
}

export function WriteScriptButton({ seriesId, number }: { seriesId: string; number: number }) {
  const { pending, run, t } = useRun();
  return (
    <button disabled={pending} onClick={() => run(() => writeScriptAction(seriesId))} className={btn("vip", "lg")}>
      {pending ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />} {pending ? t.show.writing : fmt(t.show.write, { n: number })}
    </button>
  );
}

type Script = { id: string; number: number; title: string; content: string; pollQuestion: string; optionA: string; optionB: string; caption: string };
type Job = { id: string; prompt: string; status: string; provider: string; error: string | null; createdAt: string };

/** Edit the AI draft → generate clips from its PROMPT: lines → pick a clip → publish (opens the next poll). */
export function ScriptEditor({ script, jobs, seriesId }: { script: Script; jobs: Job[]; seriesId: string }) {
  const { pending, run, t, toast, router } = useRun();
  const [s, setS] = useState(script);
  const [jobId, setJobId] = useState(jobs.find((j) => j.status === "DONE")?.id ?? "");
  const prompts = promptsFromScript(s.content);
  const set = (k: keyof Script) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setS((x) => ({ ...x, [k]: e.target.value }));
  const fields = { title: s.title, content: s.content, pollQuestion: s.pollQuestion, optionA: s.optionA, optionB: s.optionB, caption: s.caption };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg font-semibold">{fmt(t.show.script, { n: s.number })}</h3>
        <button disabled={pending} onClick={() => run(() => writeScriptAction(seriesId), undefined, () => location.reload())} className={btn("glass", "sm")}>
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {t.show.rewrite}
        </button>
      </div>
      <div>
        <label className={labelCls} htmlFor="sc-title">{t.show.title2}</label>
        <input id="sc-title" value={s.title} onChange={set("title")} className={inputCls} />
      </div>
      <div>
        <label className={labelCls} htmlFor="sc-content">{t.show.content}</label>
        <textarea id="sc-content" value={s.content} onChange={set("content")} rows={14} className={textareaCls + " font-mono text-[13px] leading-relaxed"} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <label className={labelCls} htmlFor="sc-q">{t.show.question}</label>
          <input id="sc-q" value={s.pollQuestion} onChange={set("pollQuestion")} className={inputCls} />
        </div>
        <div className="sm:col-span-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="sc-a">{t.show.optionA}</label>
            <input id="sc-a" value={s.optionA} onChange={set("optionA")} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="sc-b">{t.show.optionB}</label>
            <input id="sc-b" value={s.optionB} onChange={set("optionB")} className={inputCls} />
          </div>
        </div>
      </div>
      <div>
        <label className={labelCls} htmlFor="sc-cap">{t.show.caption}</label>
        <textarea id="sc-cap" value={s.caption} onChange={set("caption")} rows={3} className={textareaCls} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button disabled={pending} onClick={() => run(() => saveScriptAction(s.id, fields), t.show.saved)} className={btn("glass", "md")}>
          {t.show.save}
        </button>
        <button onClick={() => navigator.clipboard?.writeText(s.caption).then(() => toast(t.series.copied))} className={btn("ghost", "md")}>
          <Copy size={16} /> {t.show.copyCaption}
        </button>
      </div>

      {/* Clips */}
      <div className="rounded-2xl bg-surface-2/60 p-4 ring-1 ring-line">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">{t.show.video}</p>
          <div className="flex gap-2">
            <button
              disabled={pending || prompts.length === 0}
              onClick={() =>
                run(async () => {
                  const saved = await saveScriptAction(s.id, fields);
                  if (!saved.ok) return saved;
                  return generateClipsAction(s.id);
                }, fmt(t.show.genStarted, { n: prompts.length }))
              }
              className={btn("coin", "sm")}
            >
              <Film size={15} /> {fmt(t.show.genClips, { n: prompts.length })}
            </button>
            <button onClick={() => router.refresh()} className={btn("ghost", "sm")} aria-label={t.show.refresh} title={t.show.refresh}>
              <RefreshCw size={15} />
            </button>
          </div>
        </div>
        <p className="mb-2 mt-3 text-xs text-muted">{t.show.pickVideo}</p>
        <ul className="space-y-1.5">
          {jobs.map((j) => (
            <li key={j.id}>
              <label
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm ring-1",
                  j.status === "DONE" ? "cursor-pointer ring-line hover:ring-white/25" : "opacity-60 ring-transparent",
                  jobId === j.id && "bg-accent/10 ring-accent/60",
                )}
              >
                <input type="radio" name="clip" disabled={j.status !== "DONE"} checked={jobId === j.id} onChange={() => setJobId(j.id)} className="accent-[var(--accent)]" />
                {j.status === "DONE" ? (
                  <video src={`/api/studio/generations/${j.id}/video`} muted playsInline preload="metadata" className="h-14 w-9 shrink-0 rounded-md bg-black object-cover" />
                ) : (
                  <span className="flex h-14 w-9 shrink-0 items-center justify-center rounded-md bg-black/40">
                    {j.status === "FAILED" ? <X size={14} className="text-red-300" /> : <Loader2 size={14} className="animate-spin" />}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2">{j.prompt}</span>
                  {j.error && <span className="block truncate text-xs text-red-300">{j.error}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted">{j.provider}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <button
        disabled={pending || !jobId}
        onClick={() =>
          run(async () => {
            const saved = await saveScriptAction(s.id, fields);
            if (!saved.ok) return saved;
            return publishScriptAction(s.id, jobId);
          }, t.show.published)
        }
        className={btn("primary", "lg", "w-full")}
      >
        {pending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} {t.show.publish}
      </button>
    </div>
  );
}
