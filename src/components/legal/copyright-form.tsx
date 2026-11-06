"use client";
import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { btn, inputCls, textareaCls } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { copyrightNoticeAction } from "@/app/actions/reports";

export function CopyrightForm() {
  const { t } = useI18n();
  const f = t.legal.form;
  const [v, setV] = useState({ url: "", name: "", email: "", details: "", confirm: false });
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    start(async () => {
      const r = await copyrightNoticeAction(v);
      if (r.ok) setSent(true);
      else setError(r.error === "tooMany" ? f.tooMany : f.invalid);
    });
  };

  if (sent) {
    return (
      <div className="mt-10 flex items-center gap-3 rounded-3xl bg-surface p-6 ring-1 ring-line">
        <CheckCircle2 className="shrink-0 text-ok" />
        <p>{f.sent}</p>
      </div>
    );
  }

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <form onSubmit={submit} className="mt-10 space-y-4 rounded-3xl bg-surface p-6 ring-1 ring-line">
      <h2 className="font-display text-xl font-semibold">{f.title}</h2>
      <p className="text-sm text-muted">{f.intro}</p>
      <label className="block text-sm text-muted">
        {f.url}
        <input value={v.url} onChange={set("url")} required maxLength={300} placeholder={f.urlHint} className={`${inputCls} mt-1.5`} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-muted">
          {f.name}
          <input value={v.name} onChange={set("name")} required minLength={2} maxLength={120} className={`${inputCls} mt-1.5`} />
        </label>
        <label className="block text-sm text-muted">
          {f.email}
          <input type="email" value={v.email} onChange={set("email")} required maxLength={200} className={`${inputCls} mt-1.5`} />
        </label>
      </div>
      <label className="block text-sm text-muted">
        {f.details}
        <textarea value={v.details} onChange={set("details")} required minLength={20} maxLength={1000} rows={5} className={`${textareaCls} mt-1.5`} />
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={v.confirm} onChange={(e) => setV((s) => ({ ...s, confirm: e.target.checked }))} className="mt-1 accent-[var(--color-accent)]" />
        <span>{f.confirm}</span>
      </label>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <button disabled={pending || !v.confirm} className={btn("primary", "md")}>
        {f.send}
      </button>
    </form>
  );
}
