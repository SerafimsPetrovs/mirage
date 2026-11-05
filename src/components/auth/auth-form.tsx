"use client";
import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, Gift } from "lucide-react";
import { btn, inputCls, labelCls } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { loginAction, registerAction, type FormState } from "@/app/actions/auth";

export function AuthForm({ mode, next, promo = "" }: { mode: "login" | "register"; next: string; promo?: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "login" ? loginAction : registerAction, undefined);
  const q = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className="glass animate-fade-up w-full max-w-[420px] rounded-[28px] p-6 shadow-2xl md:p-8">
      <h1 className="font-display text-2xl font-bold">{mode === "login" ? t.auth.loginTitle : t.auth.registerTitle}</h1>
      <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
        {mode === "register" && <Gift size={15} className="text-coin" />}
        {mode === "login" ? t.auth.loginSub : t.auth.registerSub}
      </p>

      <form action={action} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        {mode === "register" && (
          <div>
            <label htmlFor="name" className={labelCls}>{t.auth.name}</label>
            <input id="name" name="name" required maxLength={40} autoComplete="name" defaultValue={state?.values?.name} className={inputCls} />
          </div>
        )}
        <div>
          <label htmlFor="email" className={labelCls}>{t.auth.email}</label>
          <input id="email" name="email" type="email" required autoComplete="email" defaultValue={state?.values?.email} className={inputCls} />
        </div>
        <div>
          <label htmlFor="password" className={labelCls}>{t.auth.password}</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={mode === "register" ? 6 : undefined}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className={inputCls}
          />
        </div>
        {mode === "login" && (
          <p className="-mt-2 text-right text-sm">
            <Link href="/forgot-password" className="text-muted hover:text-text">{t.auth.forgot}</Link>
          </p>
        )}
        {mode === "register" && (
          <details open={!!promo} className="group rounded-2xl bg-surface-2/60 px-4 py-3 ring-1 ring-line">
            <summary className="cursor-pointer select-none text-sm font-medium text-muted marker:text-muted group-open:text-text">{t.promo.title}</summary>
            <input
              name="promo"
              defaultValue={state?.values?.promo ?? promo}
              maxLength={40}
              autoComplete="off"
              spellCheck={false}
              placeholder={t.promo.placeholder}
              aria-label={t.promo.placeholder}
              className={inputCls + " mt-3 font-mono uppercase placeholder:font-sans placeholder:normal-case"}
            />
          </details>
        )}
        {state?.error && (
          <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
            <AlertCircle size={16} /> {state.error}
          </p>
        )}
        <button disabled={pending} className={btn("primary", "lg", "w-full")}>
          {pending ? t.common.loading : mode === "login" ? t.auth.submitLogin : t.auth.submitRegister}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {mode === "login" ? t.auth.noAccount : t.auth.haveAccount}{" "}
        <Link href={(mode === "login" ? "/register" : "/login") + q} className="font-semibold text-text hover:text-accent-2">
          {mode === "login" ? t.nav.register : t.nav.login}
        </Link>
      </p>

      {mode === "login" && (
        <div className="mt-6 rounded-2xl border border-dashed border-line p-3 text-xs text-muted">
          <p className="mb-1 font-semibold text-text/80">{t.auth.demo}</p>
          viewer@mirage.tv · creator@mirage.tv · admin@mirage.tv — <span className="font-mono">mirage123</span>
        </div>
      )}
    </div>
  );
}
