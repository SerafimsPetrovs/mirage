"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { CheckCircle2, Clock3, Hammer, Loader2, RefreshCw, Send, XCircle } from "lucide-react";
import { btn } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { renderTrackAction, setStyleAction } from "@/app/actions/music";
import { MUSIC_STYLES, type MusicStyle } from "@/lib/music-rules";

type Status = "DRAFT" | "REVIEW" | "QUEUED" | "RENDERING" | "READY" | "FAILED" | "REJECTED";

/** Status, style switch, "build" button with live progress and the finished preview. */
export function TrackPanel({
  id,
  status: initialStatus,
  progress: initialProgress,
  error,
  style: initialStyle,
  order,
  admin,
  clipApproved,
  vertical,
  version,
}: {
  id: string;
  status: Status;
  progress: number;
  error: string | null;
  style: MusicStyle;
  order: boolean;
  admin: boolean;
  clipApproved: boolean;
  vertical: boolean;
  version: number;
}) {
  const { t } = useI18n();
  const m = t.music;
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [progress, setProgress] = useState(initialProgress);
  const [style, setStyle] = useState<MusicStyle>(initialStyle);
  const busy = status === "QUEUED" || status === "RENDERING";
  const editable = ["DRAFT", "FAILED", "READY"].includes(status) && (!order || admin || status === "DRAFT");

  useEffect(() => {
    if (!busy) return;
    const iv = setInterval(async () => {
      const r = await fetch(`/api/music/${id}`, { cache: "no-store" }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
      if (!r) return;
      setProgress(r.progress);
      if (r.status !== status) {
        setStatus(r.status);
        if (r.status === "READY" || r.status === "FAILED") router.refresh();
      }
    }, 2500);
    return () => clearInterval(iv);
  }, [busy, id, status, router]);

  const build = () =>
    start(async () => {
      const r = await renderTrackAction(id);
      if (r.ok) {
        setStatus(r.status);
        setProgress(0);
      } else toast((m.errors as Record<string, string>)[r.error] ?? t.common.error, "error");
    });

  const pick = (s: MusicStyle) => {
    setStyle(s);
    start(async () => {
      const r = await setStyleAction(id, s);
      if (!r.ok) toast(t.common.error, "error");
    });
  };

  const badge = {
    DRAFT: "bg-white/10 text-muted",
    REVIEW: "bg-coin/15 text-coin",
    QUEUED: "bg-white/10 text-text",
    RENDERING: "bg-accent/15 text-accent",
    READY: "bg-ok/15 text-ok",
    FAILED: "bg-red-500/15 text-red-300",
    REJECTED: "bg-red-500/15 text-red-300",
  }[status];

  return (
    <section className="rounded-3xl bg-surface p-5 ring-1 ring-line md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className={clsx("rounded-full px-3 py-1 text-xs font-semibold", badge)}>{m.statuses[status]}</span>
        {editable && (
          <label className="flex items-center gap-2 text-sm text-muted">
            {m.style}
            <select value={style} onChange={(e) => pick(e.target.value as MusicStyle)} className="h-9 rounded-xl bg-surface-2 px-2 text-sm text-text ring-1 ring-line">
              {MUSIC_STYLES.map((s) => (
                <option key={s} value={s}>{m.styles[s]}</option>
              ))}
            </select>
          </label>
        )}
        {editable && (
          <button type="button" onClick={build} disabled={pending} className={btn("primary", "md", "ml-auto")}>
            {pending ? <Loader2 size={17} className="animate-spin" /> : order && !admin && status === "DRAFT" ? <Send size={17} /> : status === "READY" ? <RefreshCw size={17} /> : <Hammer size={17} />}
            {order && !admin && status === "DRAFT" ? m.sendReview : status === "READY" ? m.rerender : m.render}
          </button>
        )}
      </div>

      {busy && (
        <div className="mt-5">
          <p className="flex items-center gap-2 text-sm"><Loader2 size={16} className="animate-spin text-accent" /> {fmt(m.progress, { n: progress })}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${Math.max(3, progress)}%` }} />
          </div>
        </div>
      )}
      {status === "REVIEW" && <p className="mt-4 flex items-center gap-2 text-sm text-muted"><Clock3 size={16} /> {m.reviewText}</p>}
      {status === "FAILED" && <p className="mt-4 flex items-center gap-2 text-sm text-red-300"><XCircle size={16} /> {fmt(m.failedText, { error: error ?? "?" })}</p>}
      {status === "REJECTED" && <p className="mt-4 flex items-center gap-2 text-sm text-red-300"><XCircle size={16} /> {m.rejectedText}{error ? ` (${error})` : ""}</p>}
      {status === "READY" && (
        <div className="mt-5">
          <p className="mb-3 flex items-center gap-2 text-sm text-ok"><CheckCircle2 size={16} /> {clipApproved ? m.readyText : m.readyPending}</p>
          <video
            key={version}
            src={`/api/music/${id}/video?v=${version}`}
            controls
            playsInline
            preload="metadata"
            className={clsx("rounded-2xl bg-black ring-1 ring-line", vertical ? "mx-auto aspect-[9/16] max-h-[70vh]" : "aspect-video w-full")}
          />
        </div>
      )}
    </section>
  );
}
