"use client";
import { useState, useTransition } from "react";
import { MailWarning } from "lucide-react";
import { btn } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { resendVerificationAction } from "@/app/actions/auth";

/** Shown until the account's email is confirmed. */
export function VerifyEmailBanner({ email, className }: { email: string; className?: string }) {
  const { t } = useI18n();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className={`flex flex-col gap-3 rounded-3xl bg-coin/10 p-4 ring-1 ring-coin/30 sm:flex-row sm:items-center ${className ?? ""}`}>
      <MailWarning className="shrink-0 text-coin" size={22} />
      <p className="flex-1 text-sm">{fmt(t.auth.verifyBanner, { email })}</p>
      {note ? (
        <span className="text-sm text-muted">{note}</span>
      ) : (
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await resendVerificationAction();
              setNote(r.ok ? t.auth.verifySent : t.auth.verifyLimit);
            })
          }
          className={btn("glass", "sm")}
        >
          {t.auth.verifyResend}
        </button>
      )}
    </div>
  );
}
