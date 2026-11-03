"use client";
import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Film, Play, Plus, Send, Trash2, Vote } from "lucide-react";
import { btn, inputCls, labelCls, textareaCls } from "@/components/ui/button";
import { CoinAmount, EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { addEpisodeAction, createPollAction, deleteEpisodeAction, deleteSeriesAction, submitSeriesAction } from "@/app/actions/studio";
import type { FormState } from "@/app/actions/auth";
import { Uploader } from "./uploader";

type Ep = { id: string; number: number; title: string; durationSec: number; coinPrice: number | null; views: number };

export function EpisodeManager({ seriesId, episodes, defaultPrice }: { seriesId: string; episodes: Ep[]; defaultPrice: number }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(episodes.length === 0);
  const [video, setVideo] = useState("");
  const [duration, setDuration] = useState("");
  const [form, setForm] = useState({ titleRu: "", titleEn: "", coinPrice: "", url: "" });

  const probeDuration = (file: File) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      if (isFinite(v.duration)) setDuration(String(Math.round(v.duration)));
      URL.revokeObjectURL(v.src);
    };
    v.src = URL.createObjectURL(file);
  };

  const submit = () =>
    start(async () => {
      const r = await addEpisodeAction(seriesId, {
        titleRu: form.titleRu,
        titleEn: form.titleEn,
        videoUrl: video || form.url,
        durationSec: duration || "90",
        coinPrice: form.coinPrice,
      });
      if (r?.ok) {
        toast(t.common.saved);
        setVideo("");
        setDuration("");
        setForm({ titleRu: "", titleEn: "", coinPrice: "", url: "" });
        router.refresh();
      } else toast(r?.error ?? t.common.error, "error");
    });

  return (
    <div className="space-y-4">
      {episodes.length === 0 ? (
        <EmptyState icon={<Film size={24} />} title={t.studio.noEpisodes} />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-2xl ring-1 ring-line">
          {episodes.map((e) => (
            <div key={e.id} className="flex items-center gap-3 bg-surface-2/50 px-4 py-3">
              <span className="w-8 font-display font-semibold tabular-nums text-muted">{e.number}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{e.title || `${t.common.episode} ${e.number}`}</p>
                <p className="text-xs text-muted">
                  {Math.floor(e.durationSec / 60)}:{String(e.durationSec % 60).padStart(2, "0")} · {e.views} {t.common.views}
                </p>
              </div>
              <CoinAmount value={e.coinPrice ?? defaultPrice} size={14} className="text-sm" />
              <Link href={`/watch/${e.id}`} aria-label="Play" className={btn("ghost", "icon")}>
                <Play size={16} />
              </Link>
              <button
                aria-label={t.common.delete}
                className={btn("ghost", "icon", "text-red-300")}
                onClick={() => confirm(t.studio.deleteConfirm) && start(async () => { await deleteEpisodeAction(e.id); router.refresh(); })}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {open ? (
        <div className="space-y-4 rounded-2xl bg-surface-2/50 p-4 ring-1 ring-line">
          <Uploader kind="video" accept="video/mp4,video/webm,video/quicktime" label={t.studio.videoFile} onDone={setVideo} onFile={probeDuration} />
          <div>
            <label className={labelCls}>{t.studio.videoUrl}</label>
            <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" className={inputCls} disabled={!!video} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>{t.studio.episodeTitleRu}</label>
              <input value={form.titleRu} onChange={(e) => setForm({ ...form, titleRu: e.target.value })} maxLength={120} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t.studio.episodeTitleEn}</label>
              <input value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} maxLength={120} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t.studio.duration}</label>
              <input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t.studio.price}</label>
              <input type="number" min={1} max={500} placeholder={String(defaultPrice)} value={form.coinPrice} onChange={(e) => setForm({ ...form, coinPrice: e.target.value })} className={inputCls} />
            </div>
          </div>
          <button onClick={submit} disabled={pending || !(video || form.url)} className={btn("primary", "md")}>
            <Plus size={18} /> {t.studio.addEpisode}
          </button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className={btn("glass", "md")}>
          <Plus size={18} /> {t.studio.addEpisode}
        </button>
      )}
    </div>
  );
}

export function SubmitForReview({ seriesId, status, hasEpisodes }: { seriesId: string; status: string; hasEpisodes: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  if (status !== "DRAFT" && status !== "REJECTED") return null;
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (!hasEpisodes) return toast(t.studio.needEpisodes, "error");
          const r = await submitSeriesAction(seriesId);
          if (r?.ok) {
            toast(t.studio.submitted);
            router.refresh();
          } else toast(t.studio.needEpisodes, "error");
        })
      }
      className={btn("primary", "md")}
    >
      <Send size={18} /> {t.studio.submit}
    </button>
  );
}

export function DeleteSeries({ seriesId }: { seriesId: string }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => confirm(t.studio.deleteConfirm) && start(() => deleteSeriesAction(seriesId))} className={btn("danger", "md")}>
      <Trash2 size={18} /> {t.common.delete}
    </button>
  );
}

export function PollForm({ seriesId, polls }: { seriesId: string; polls: { id: string; question: string; votes: number; closesAt: string }[] }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [state, action, pending] = useActionState<FormState, FormData>(createPollAction.bind(null, seriesId), undefined);
  useEffect(() => {
    if (state?.ok) toast(t.common.saved);
    if (state?.error) toast(state.error, "error");
  }, [state, toast, t.common.saved]);
  return (
    <div className="space-y-4">
      {polls.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-surface-2/50 px-4 py-3 ring-1 ring-line">
          <Vote size={18} className="text-vip" />
          <p className="min-w-0 flex-1 truncate font-medium">{p.question}</p>
          <span className="text-sm text-muted">{p.votes}</span>
          <span className="text-xs text-muted">{new Date(p.closesAt).toLocaleDateString(locale)}</span>
        </div>
      ))}
      <form action={action} className="space-y-3 rounded-2xl bg-surface-2/50 p-4 ring-1 ring-line">
        <p className="font-semibold">{t.studio.newPoll}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="questionRu" required placeholder={t.studio.question} className={inputCls} />
          <input name="questionEn" placeholder={t.studio.questionEn} className={inputCls} />
        </div>
        <textarea name="options" required rows={3} placeholder={t.studio.options + "\nДа | Yes\nНет | No"} className={textareaCls} />
        <div className="flex items-end gap-3">
          <div className="w-32">
            <label className={labelCls}>{t.studio.days}</label>
            <input name="days" type="number" min={1} max={30} defaultValue={3} className={inputCls} />
          </div>
          <button disabled={pending} className={btn("glass", "md")}>{t.studio.create}</button>
        </div>
      </form>
    </div>
  );
}
