"use client";
import { useActionState, useEffect, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, Clapperboard, Gift, ShieldCheck } from "lucide-react";
import { btn, inputCls, labelCls, textareaCls } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { MascotCameo } from "@/components/mascot/mascot-cameo";
import { applyCreatorAction, updateProfileAction } from "@/app/actions/profile";
import type { FormState } from "@/app/actions/auth";

const HUES = [0, 25, 45, 120, 165, 200, 230, 260, 290, 330];

export function ProfileForm({ name, bio, hue }: { name: string; bio: string; hue: number }) {
  const { t } = useI18n();
  const toast = useToast();
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfileAction, undefined);
  const [h, setH] = useState(hue);
  const [n, setN] = useState(name);
  useEffect(() => {
    if (state?.ok) toast(t.common.saved);
    else if (state?.error) toast(state.error, "error");
  }, [state, toast, t.common.saved]);
  return (
    <form action={action} className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar name={n || "?"} hue={h} size={56} />
        <div>
          <p className={labelCls}>{t.me.avatarColor}</p>
          <div className="flex flex-wrap gap-1.5">
            {HUES.map((x) => (
              <button
                type="button"
                key={x}
                aria-label={`hue ${x}`}
                onClick={() => setH(x)}
                className={clsx("h-7 w-7 rounded-full ring-2 transition", h === x ? "ring-white" : "ring-transparent hover:ring-white/40")}
                style={{ background: `linear-gradient(135deg, hsl(${x} 80% 58%), hsl(${(x + 50) % 360} 75% 38%))` }}
              />
            ))}
          </div>
        </div>
      </div>
      <input type="hidden" name="avatarHue" value={h} />
      <div>
        <label htmlFor="pname" className={labelCls}>{t.auth.name}</label>
        <input id="pname" name="name" value={n} onChange={(e) => setN(e.target.value)} maxLength={40} required className={inputCls} />
      </div>
      <div>
        <label htmlFor="pbio" className={labelCls}>{t.me.bio}</label>
        <textarea id="pbio" name="bio" defaultValue={bio} maxLength={300} rows={3} className={textareaCls} />
      </div>
      <button disabled={pending} className={btn("glass", "md")}>{t.common.save}</button>
    </form>
  );
}

export function CreatorApplyForm({ status }: { status: "PENDING" | "REJECTED" | null }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(applyCreatorAction, undefined);
  const sent = status === "PENDING" || state?.ok;
  const a = t.me.apply2;
  // Collapsed by default (the profile was a wall of text); opened by a #creator link or after a rejection.
  const [open, setOpen] = useState(status === "REJECTED");
  useEffect(() => {
    if (window.location.hash === "#creator") {
      const id = window.setTimeout(() => setOpen(true), 0);
      return () => clearTimeout(id);
    }
  }, []);
  return (
    <div
      id="creator"
      className="scroll-mt-24 rounded-3xl p-5 ring-1 ring-line md:p-6"
      style={{ background: "radial-gradient(100% 140% at 100% 0%, rgba(255,46,99,.2), transparent 55%), var(--surface)" }}
    >
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1 self-center">
          <div className="mb-2 flex items-center gap-2 font-display text-lg font-semibold">
            <Clapperboard size={20} className="text-accent-2" /> {t.me.becomeCreator}
          </div>
          <p className="text-sm text-muted">{t.me.becomeCreatorText}</p>
        </div>
        <MascotCameo kind="want-you" className="-my-2 w-[120px] shrink-0 md:w-[170px]" />
      </div>
      {!sent && (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={btn(open ? "ghost" : "primary", "md", "mt-4")}>
          {open ? a.close : a.open} <ChevronDown size={18} className={clsx("transition-transform", open && "rotate-180")} />
        </button>
      )}
      {(open || sent) && (
        <>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-surface-2/60 p-4 ring-1 ring-line">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Gift size={16} className="text-coin" /> {a.getTitle}</p>
          <ul className="space-y-1.5 text-sm text-muted">
            {a.get.map((x) => <li key={x} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-ok" />{x}</li>)}
          </ul>
        </div>
        <div className="rounded-2xl bg-surface-2/60 p-4 ring-1 ring-line">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16} className="text-vip" /> {a.needTitle}</p>
          <ul className="space-y-1.5 text-sm text-muted">
            {a.need.map((x) => <li key={x} className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-vip" />{x}</li>)}
          </ul>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted">{a.how}</p>

      {sent ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-coin/10 px-4 py-3">
          <MascotCameo kind="cheer" className="-my-3 w-[96px] shrink-0" />
          <p className="text-sm font-medium text-coin">{t.me.applicationPending}</p>
        </div>
      ) : (
        <form action={action} className="mt-5 space-y-4">
          {status === "REJECTED" && <p className="text-sm text-red-300">{t.me.applicationRejected}</p>}
          <div>
            <label htmlFor="app-msg" className={labelCls}>{a.messageLabel}</label>
            <textarea id="app-msg" name="message" required minLength={30} maxLength={1000} rows={4} placeholder={a.messagePh} className={textareaCls} />
            <p className="mt-1 text-xs text-muted">{a.messageHint}</p>
          </div>
          <div>
            <label htmlFor="app-portfolio" className={labelCls}>{a.portfolioLabel}</label>
            <input id="app-portfolio" name="portfolio" type="url" placeholder="https://youtube.com/@your-channel" className={inputCls} />
            <p className="mt-1 text-xs text-muted">{a.portfolioHint}</p>
          </div>
          <label className="flex items-start gap-3 text-sm text-muted">
            <input type="checkbox" name="agree" required className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" />
            <span>
              {a.agree}{" "}
              <a href="/legal/terms" target="_blank" className="text-text underline underline-offset-2">{a.terms}</a>
            </span>
          </label>
          {state?.error && <p className="text-sm text-red-300">{state.error}</p>}
          <button disabled={pending} className={btn("primary", "md")}>{t.me.apply}</button>
        </form>
      )}
        </>
      )}
    </div>
  );
}
