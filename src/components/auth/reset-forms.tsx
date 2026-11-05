"use client";
import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, ArrowLeft, MailCheck } from "lucide-react";
import { btn, inputCls, labelCls } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { forgotPasswordAction, resetPasswordAction, type FormState } from "@/app/actions/auth";

const card = "glass animate-fade-up w-full max-w-[420px] rounded-[28px] p-6 shadow-2xl md:p-8";

function ErrorLine({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
      <AlertCircle size={16} className="shrink-0" /> {text}
    </p>
  );
}

function BackToLogin() {
  const { t } = useI18n();
  return (
    <p className="mt-6 text-center text-sm">
      <Link href="/login" className="inline-flex items-center gap-1.5 font-semibold text-muted hover:text-text">
        <ArrowLeft size={15} /> {t.auth.backToLogin}
      </Link>
    </p>
  );
}

export function ForgotPasswordForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(forgotPasswordAction, undefined);
  return (
    <div className={card}>
      <h1 className="font-display text-2xl font-bold">{t.auth.forgotTitle}</h1>
      <p className="mt-1.5 text-sm text-muted">{t.auth.forgotSub}</p>
      {state?.ok ? (
        <div className="mt-6 flex gap-3 rounded-2xl bg-ok/10 p-4 text-sm ring-1 ring-ok/30" role="status">
          <MailCheck size={20} className="shrink-0 text-ok" />
          <p>{state.message}</p>
        </div>
      ) : (
        <form action={action} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className={labelCls}>{t.auth.email}</label>
            <input id="email" name="email" type="email" required autoComplete="email" defaultValue={state?.values?.email} className={inputCls} />
          </div>
          <ErrorLine text={state?.error} />
          <button disabled={pending} className={btn("primary", "lg", "w-full")}>
            {pending ? t.common.loading : t.auth.sendLink}
          </button>
        </form>
      )}
      <BackToLogin />
    </div>
  );
}

export function ResetPasswordForm({ token, valid }: { token: string; valid: boolean }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(resetPasswordAction, undefined);
  if (!valid)
    return (
      <div className={card}>
        <h1 className="font-display text-2xl font-bold">{t.auth.resetTitle}</h1>
        <div className="mt-6">
          <ErrorLine text={t.auth.badLink} />
        </div>
        <Link href="/forgot-password" className={btn("primary", "lg", "mt-5 w-full")}>
          {t.auth.requestNew}
        </Link>
        <BackToLogin />
      </div>
    );
  return (
    <div className={card}>
      <h1 className="font-display text-2xl font-bold">{t.auth.resetTitle}</h1>
      <p className="mt-1.5 text-sm text-muted">{t.auth.resetSub}</p>
      <form action={action} className="mt-6 space-y-4">
        <input type="hidden" name="token" value={token} />
        <div>
          <label htmlFor="password" className={labelCls}>{t.auth.newPassword}</label>
          <input id="password" name="password" type="password" required minLength={6} autoComplete="new-password" className={inputCls} />
        </div>
        <div>
          <label htmlFor="password2" className={labelCls}>{t.auth.repeatPassword}</label>
          <input id="password2" name="password2" type="password" required minLength={6} autoComplete="new-password" className={inputCls} />
        </div>
        <ErrorLine text={state?.error} />
        <button disabled={pending} className={btn("primary", "lg", "w-full")}>
          {pending ? t.common.loading : t.auth.savePassword}
        </button>
      </form>
      <BackToLogin />
    </div>
  );
}
