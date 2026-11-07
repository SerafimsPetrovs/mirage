"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Plus, Share2, Star } from "lucide-react";
import { btn } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ShareSheet, shareUrl } from "@/components/ui/share-sheet";
import { fmt } from "@/i18n/shared";
import { useI18n } from "@/i18n/client";
import { rateAction, toggleListAction } from "@/app/actions/library";

export function ListButton({ seriesId, initial, compact }: { seriesId: string; initial: boolean; compact?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [inList, setInList] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      aria-pressed={inList}
      onClick={() =>
        start(async () => {
          setInList((v) => !v);
          const res = await toggleListAction(seriesId);
          if (!res.ok) {
            setInList(initial);
            if (res.error === "auth") router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
          }
        })
      }
      className={btn("glass", compact ? "icon" : "lg")}
      aria-label={inList ? t.series.inList : t.series.addToList}
    >
      {inList ? <Check size={20} className="text-ok" /> : <Plus size={20} />}
      {!compact && (inList ? t.series.inList : t.series.addToList)}
    </button>
  );
}

/** Opens the share sheet; for signed-in viewers the link carries their invite code (/r/CODE?to=…). */
export function ShareButton({ title, slug, refCode, withLabel }: { title: string; slug: string; refCode?: string | null; withLabel?: boolean }) {
  const { t, locale } = useI18n();
  const [url, setUrl] = useState<string | null>(null);
  return (
    <>
      <button
        className={withLabel ? btn("glass", "lg") : btn("glass", "icon", "h-13 w-13")}
        aria-label={t.series.share}
        onClick={() => setUrl(shareUrl(`/series/${slug}`, refCode))}
      >
        <Share2 size={20} />
        {withLabel && t.series.share}
      </button>
      <ShareSheet
        open={!!url}
        onClose={() => setUrl(null)}
        url={url ?? ""}
        title={title}
        text={fmt(t.share.seriesText, { title })}
        image={`/api/og/${slug}?l=${locale}`}
      />
    </>
  );
}

export function RatingStars({ seriesId, initial, loggedIn }: { seriesId: string; initial: number; loggedIn: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(initial);
  const [hover, setHover] = useState(0);
  const [, start] = useTransition();
  return (
    <div>
      <p className="mb-2 text-sm text-muted">{t.series.rate}</p>
      <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            aria-label={`${n}/5`}
            onMouseEnter={() => setHover(n)}
            onClick={() => {
              if (!loggedIn) return router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
              setValue(n);
              start(async () => {
                const r = await rateAction(seriesId, n);
                if (r.ok) toast(t.common.saved);
              });
            }}
            className="p-0.5 transition hover:scale-110"
          >
            <Star size={26} strokeWidth={1.5} className={clsx((hover || value) >= n ? "fill-coin text-coin" : "text-muted/50")} />
          </button>
        ))}
      </div>
    </div>
  );
}
