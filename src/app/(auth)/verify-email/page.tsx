import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { verifyEmail } from "@/lib/email-verify";
import { btn } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.verifyOkTitle, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/** Opened from the confirmation email. The token is single-use; a second visit shows the "doesn't work" state. */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const { t } = await getI18n();
  const ok = !!(await verifyEmail(String(token)));
  return (
    <div className="glass animate-fade-up w-full max-w-[420px] rounded-[28px] p-6 text-center shadow-2xl md:p-8">
      {ok ? <CheckCircle2 size={44} className="mx-auto text-ok" /> : <XCircle size={44} className="mx-auto text-red-300" />}
      <h1 className="mt-4 font-display text-2xl font-bold">{ok ? t.auth.verifyOkTitle : t.auth.verifyBadTitle}</h1>
      <p className="mt-2 text-sm text-muted">{ok ? t.auth.verifyOkText : t.auth.verifyBadText}</p>
      <Link href={ok ? "/" : "/me"} className={btn("primary", "lg", "mt-6 w-full")}>
        {ok ? t.nav.home : t.nav.profile}
      </Link>
    </div>
  );
}
