"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Fingerprint, Loader2, SearchCheck, ShieldCheck, UserX } from "lucide-react";
import { btn, inputCls, labelCls } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { Uploader } from "@/components/studio/uploader";
import { detectLeakAction, protectAllAction } from "@/app/actions/watermark";

export function ProtectAllButton({ pending: left }: { pending: number }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending || left === 0}
      onClick={() =>
        start(async () => {
          await protectAllAction();
          toast(t.wm.started);
          router.refresh();
        })
      }
      className={btn("primary", "md")}
    >
      {pending ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />} {fmt(t.wm.protectAll, { n: left })}
    </button>
  );
}

type Result = Awaited<ReturnType<typeof detectLeakAction>>;

export function LeakDetector() {
  const { t } = useI18n();
  const w = t.wm;
  const [episode, setEpisode] = useState("");
  const [leak, setLeak] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="wm-ep" className={labelCls}>{w.episode}</label>
        <input id="wm-ep" value={episode} onChange={(e) => setEpisode(e.target.value)} placeholder="https://…/watch/cmw3g0clp004mtivwxns90cvb" className={inputCls} />
        <p className="mt-1 text-xs text-muted">{w.episodeHint}</p>
      </div>
      <div className="max-w-xs">
        <Uploader kind="video" accept="video/mp4,video/webm,video/quicktime" label={w.leakFile} aspect="aspect-video" onDone={(ref) => setLeak(ref)} />
      </div>
      <button
        disabled={pending || !episode.trim() || !leak}
        onClick={() =>
          start(async () => {
            setResult(null);
            setResult(await detectLeakAction(episode, leak!));
          })
        }
        className={btn("primary", "md")}
      >
        {pending ? <Loader2 size={17} className="animate-spin" /> : <SearchCheck size={17} />} {pending ? w.analyzing : w.detect}
      </button>

      {result && (
        <div className={clsx("rounded-2xl p-4 ring-1", result.ok ? "bg-ok/10 ring-ok/40" : "bg-surface-2 ring-line")}>
          {result.ok ? (
            <div className="flex items-start gap-3">
              <Fingerprint size={22} className="mt-0.5 shrink-0 text-ok" />
              <div className="text-sm">
                <p className="font-semibold text-ok">{w.found}</p>
                {result.user ? (
                  <p className="mt-1">
                    <b>{result.user.name}</b> · {result.user.email} · <a className="underline" href={`/admin/users/${result.user.id}`}>{w.openUser}</a>
                  </p>
                ) : (
                  <p className="mt-1">{w.guest}</p>
                )}
                <p className="mt-1 text-xs text-muted">{fmt(w.details, { code: result.code, c: Math.round(result.confidence * 100), s: result.segments })}</p>
              </div>
            </div>
          ) : (
            <p className="flex items-start gap-3 text-sm text-muted">
              <UserX size={20} className="shrink-0" /> {w.errors[result.reason]}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
