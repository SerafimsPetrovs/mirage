"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown, Loader2, Mic2 } from "lucide-react";
import { btn, inputCls } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { CAMEO_NAME_MAX } from "@/lib/show-rules";
import { buyCameoAction } from "@/app/actions/show";

type Props = {
  seriesId: string;
  loggedIn: boolean;
  defaultName: string;
  data: {
    price: number;
    aired: { id: string; name: string; episode: { id: string; number: number } | null }[];
    mine: { id: string; name: string; status: string }[];
    top: { id: string; name: string; avatarHue: number; coins: number }[];
  };
};

/** "Get into the series": buy a cameo, see who's already in, top supporters. */
export function CameoBlock({ seriesId, loggedIn, defaultName, data }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(defaultName.slice(0, CAMEO_NAME_MAX));
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const buy = () =>
    start(async () => {
      const r = await buyCameoAction(seriesId, name);
      if (!r.ok) {
        if (r.error === "auth") return router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
        if (r.error === "insufficient") return router.push(`/me/wallet?next=${encodeURIComponent(location.pathname)}`);
        return setErr(t.show.errors[r.error as keyof typeof t.show.errors] ?? t.show.errors.unknown);
      }
      toast(t.show.sent, "coin");
      router.refresh();
    });

  return (
    <div className="rounded-3xl p-5 ring-1 ring-accent/30 md:p-6" style={{ background: "radial-gradient(120% 120% at 100% 0%, rgba(124,92,255,.22), transparent 55%), var(--surface)" }}>
      <p className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
        <Mic2 size={13} /> {t.show.badge}
      </p>
      <h2 className="mt-2 font-display text-lg font-semibold">{t.show.title}</h2>
      <p className="mt-1 text-sm text-muted">{t.show.text}</p>

      {loggedIn ? (
        <div className="mt-4">
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErr(null);
              }}
              maxLength={CAMEO_NAME_MAX}
              placeholder={t.show.placeholder}
              aria-label={t.show.placeholder}
              className={inputCls + " h-11"}
            />
          </div>
          <button onClick={buy} disabled={pending || name.trim().length < 2} className={btn("coin", "md", "mt-2 w-full")}>
            {pending && <Loader2 size={16} className="animate-spin" />} {fmt(t.show.buy, { price: data.price })}
          </button>
          {err && <p className="mt-2 text-sm text-red-300" role="alert">{err}</p>}
          {data.mine.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm">
              {data.mine.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2">
                  <span className="truncate font-medium">{m.name}</span>
                  <span className={m.status === "APPROVED" ? "text-ok" : "text-coin"}>{m.status === "APPROVED" ? t.show.approved : t.show.pending}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <Link href={`/login`} className={btn("coin", "md", "mt-4 w-full")}>
          {fmt(t.show.buy, { price: data.price })}
        </Link>
      )}

      <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-muted">{t.show.aired}</p>
      {data.aired.length === 0 ? (
        <p className="text-sm text-muted">{t.show.empty}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {data.aired.map((c) => (
            <Link
              key={c.id}
              href={c.episode ? `/watch/${c.episode.id}` : "#"}
              className="rounded-full bg-white/8 px-2.5 py-1 text-xs ring-1 ring-line hover:ring-white/25"
              title={c.episode ? fmt(t.show.inEpisode, { n: c.episode.number }) : undefined}
            >
              {c.name}
              {c.episode && <span className="text-muted"> · {c.episode.number}</span>}
            </Link>
          ))}
        </div>
      )}

      {data.top.length > 0 && (
        <>
          <p className="mb-2 mt-5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
            <Crown size={13} className="text-coin" /> {t.show.top}
          </p>
          <ol className="space-y-1.5">
            {data.top.map((u, i) => (
              <li key={u.id} className="flex items-center gap-2.5 text-sm">
                <span className="w-4 text-right font-display font-bold text-muted">{i + 1}</span>
                <Avatar name={u.name} hue={u.avatarHue} size={26} />
                <span className="min-w-0 flex-1 truncate">{u.name}</span>
                <span className="text-xs tabular-nums text-coin">{u.coins}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted">{t.show.topHint}</p>
        </>
      )}
    </div>
  );
}
