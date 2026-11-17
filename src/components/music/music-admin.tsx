"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { btn, inputCls } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { moderateTrackAction } from "@/app/actions/music";

/** Moderator's decision on a viewer's music order: listen, read the lyrics, approve (→ build) or reject (coins back). */
export function MusicReviewCard({ id, title, artist, lyrics, from }: { id: string; title: string; artist: string; lyrics: string; from: string }) {
  const { t } = useI18n();
  const m = t.music;
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reason, setReason] = useState("");
  const decide = (d: "approve" | "reject") =>
    start(async () => {
      const r = await moderateTrackAction(id, d, reason);
      if (!r.ok) return toast(t.common.error, "error");
      toast(t.adm.done);
      router.refresh();
    });
  return (
    <div className="rounded-3xl bg-surface p-5 ring-1 ring-coin/30">
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted">
        {artist || "—"} · {from}
      </p>
      <audio src={`/api/music/${id}/audio`} controls preload="none" className="mt-3 w-full" />
      {lyrics && <pre className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-surface-2 p-3 font-sans text-sm text-muted">{lyrics}</pre>}
      <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder={m.rejectReason} aria-label={m.rejectReason} className={inputCls + " mt-3"} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={pending} onClick={() => decide("approve")} className={btn("primary", "md")}>
          <Check size={17} /> {m.approve}
        </button>
        <button disabled={pending} onClick={() => decide("reject")} className={btn("ghost", "md", "text-red-300 ring-1 ring-red-400/40")}>
          <X size={17} /> {m.reject}
        </button>
      </div>
    </div>
  );
}
