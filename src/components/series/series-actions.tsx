"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Plus, Share2, Star } from "lucide-react";
import { btn } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
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

/** Shares the page; for signed-in viewers the link carries their invite code (/r/CODE?to=…). */
export function ShareButton({ title, refCode }: { title: string; refCode?: string | null }) {
  const { t } = useI18n();
  const toast = useToast();
  return (
    <button
      className={btn("glass", "icon", "h-13 w-13")}
      aria-label={t.series.share}
      onClick={async () => {
        const path = location.pathname;
        const url = refCode ? `${location.origin}/r/${refCode}?to=${encodeURIComponent(path)}` : `${location.origin}${path}`;
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
            return;
          } catch {
            /* user cancelled */
          }
        }
        await navigator.clipboard?.writeText(url);
        toast(t.series.copied);
      }}
    >
      <Share2 size={20} />
    </button>
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
