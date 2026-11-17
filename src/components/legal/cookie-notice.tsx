"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Cookie } from "lucide-react";
import { btn } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";

const KEY = "mirage_cookie_notice";

/**
 * Information notice, not a consent wall: MIRAGE sets only strictly necessary cookies (session, language,
 * referral, guest preview counter), which need no consent under ePrivacy. Shown once per device; nothing is
 * pre-ticked and nothing is blocked. If analytics or ad cookies are ever added this must become a real
 * opt-in banner with "Reject" as prominent as "Accept".
 */
export function CookieNotice() {
  const { t } = useI18n();
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser-only storage after hydration
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      /* storage blocked: stay hidden rather than nag on every page */
    }
  }, []);

  if (!show) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setShow(false);
  };

  return (
    <div
      role="region"
      aria-label={t.gdpr.cookies}
      className="fixed inset-x-3 bottom-[calc(var(--tabbar-h,0px)+12px)] z-[60] mx-auto flex max-w-xl flex-col gap-3 rounded-2xl border border-line bg-surface/95 p-4 text-sm shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center md:bottom-4"
    >
      <Cookie size={20} className="hidden shrink-0 text-coin sm:block" aria-hidden />
      <p className="flex-1 leading-relaxed text-white/85">
        {t.gdpr.cookieText}{" "}
        <Link href="/legal/cookies" className="text-text underline">
          {t.gdpr.cookieMore}
        </Link>
      </p>
      <button onClick={close} className={btn("primary", "sm", "shrink-0")}>
        {t.gdpr.cookieOk}
      </button>
    </div>
  );
}
