"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Loader2 } from "lucide-react";
import { btn } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { setAdultContentAction } from "@/app/actions/extras";

/**
 * Shown instead of an 18+ series page until the viewer switches 18+ content on.
 * The backdrop stays heavily blurred so nothing explicit is visible by accident.
 */
export function AdultWall({ title, poster, reason, next }: { title: string; poster: string; reason: "auth" | "kids" | "age"; next: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);

  const confirm = () =>
    start(async () => {
      const r = await setAdultContentAction(true);
      if (r.ok) router.refresh();
      else setFailed(true);
    });

  return (
    <section className="relative flex min-h-[calc(100dvh-var(--header-h))] items-center justify-center overflow-hidden px-4 pt-[var(--header-h)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={poster} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-bg/60" />
      <div className="animate-fade-up relative w-full max-w-md rounded-[32px] border border-line bg-surface/90 p-7 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 font-display text-xl font-bold text-accent ring-1 ring-accent/40">
          18+
        </div>
        <p className="text-sm text-muted">{title}</p>
        <h1 className="mt-1 font-display text-2xl font-bold">{t.adult.wallTitle}</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/75">{t.adult.wallText}</p>
        {reason === "auth" ? (
          <>
            <p className="mt-4 text-sm text-muted">{t.adult.wallGuest}</p>
            <Link href={`/login?next=${encodeURIComponent(next)}`} className={btn("primary", "lg", "mt-5 w-full")}>
              {t.auth.submitLogin}
            </Link>
          </>
        ) : (
          <>
            <button onClick={confirm} disabled={pending} className={btn("primary", "lg", "mt-6 w-full")}>
              {pending && <Loader2 size={18} className="animate-spin" />} {t.adult.confirm}
            </button>
            <p className="mt-3 text-xs leading-relaxed text-muted" role={failed ? "alert" : undefined}>
              {failed ? t.common.error : t.adult.declaration}
            </p>
          </>
        )}
        <Link href="/" className={btn("ghost", "md", "mt-3 w-full")}>
          <EyeOff size={18} /> {t.adult.home}
        </Link>
      </div>
    </section>
  );
}
