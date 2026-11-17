"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Scissors, Share2 } from "lucide-react";
import { btn } from "@/components/ui/button";
import { ShareSheet } from "@/components/ui/share-sheet";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { createMomentAction } from "@/app/actions/tv";

/** The moment page: waits while the clip is being cut, then plays it with a share button. */
export function MomentView({ id, status, title, image }: { id: string; status: string; title: string; image: string | null }) {
  const { t } = useI18n();
  const m = t.moments;
  const router = useRouter();
  const [share, setShare] = useState(false);
  const [url, setUrl] = useState("");
  useEffect(() => {
    const id2 = window.setTimeout(() => setUrl(window.location.href), 0);
    return () => clearTimeout(id2);
  }, []);
  useEffect(() => {
    if (status !== "QUEUED") return;
    const iv = window.setInterval(async () => {
      const r = await fetch(`/api/moment/${id}?status=1`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      if (r && r.status !== "QUEUED") router.refresh();
    }, 1500);
    return () => clearInterval(iv);
  }, [id, status, router]);

  if (status === "QUEUED") {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-3xl bg-surface ring-1 ring-line">
        <p className="flex items-center gap-2 text-muted">
          <Loader2 size={20} className="animate-spin text-accent" /> {m.cutting}
        </p>
      </div>
    );
  }
  if (status !== "READY") return <p className="rounded-3xl bg-surface p-8 text-center text-red-300 ring-1 ring-line">{m.failed}</p>;
  return (
    <>
      <video src={`/api/moment/${id}`} poster={image ?? undefined} controls autoPlay playsInline loop className="aspect-video w-full rounded-3xl bg-black ring-1 ring-line" />
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setShare(true)} className={btn("primary", "md")}>
          <Share2 size={17} /> {m.share}
        </button>
      </div>
      <ShareSheet open={share} onClose={() => setShare(false)} url={url} text={`${m.shareText}: ${title}`} image={image ?? undefined} title={title} />
    </>
  );
}

/** "Clip it" button on the live player: cuts the last 20 s at the viewer's (possibly rewound) clock. */
export function MomentButton({ slug, clock, className }: { slug: string; clock: () => number; className?: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      title={t.moments.hint}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const r = await createMomentAction(slug, clock());
        setPending(false);
        if (r.ok) window.open(`/m/${r.id}`, "_blank", "noopener");
        else toast(r.error === "STATE" ? t.moments.notVideo : r.error === "AUTH" ? t.party.errors.AUTH : t.moments.failed, "error");
      }}
      className={className}
    >
      {pending ? <Loader2 size={16} className="animate-spin" /> : <Scissors size={16} className="text-accent" />} {t.moments.button}
    </button>
  );
}
