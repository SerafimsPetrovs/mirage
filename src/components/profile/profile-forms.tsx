"use client";
import { useActionState, useEffect, useState } from "react";
import clsx from "clsx";
import { Clapperboard } from "lucide-react";
import { btn, inputCls, labelCls, textareaCls } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
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
  return (
    <div
      className="rounded-3xl p-5 ring-1 ring-line md:p-6"
      style={{ background: "radial-gradient(100% 140% at 100% 0%, rgba(255,46,99,.2), transparent 55%), var(--surface)" }}
    >
      <div className="mb-2 flex items-center gap-2 font-display text-lg font-semibold">
        <Clapperboard size={20} className="text-accent-2" /> {t.me.becomeCreator}
      </div>
      <p className="text-sm text-muted">{t.me.becomeCreatorText}</p>
      {sent ? (
        <p className="mt-4 rounded-2xl bg-coin/10 px-4 py-3 text-sm font-medium text-coin">{t.me.applicationPending}</p>
      ) : (
        <form action={action} className="mt-4 space-y-3">
          {status === "REJECTED" && <p className="text-sm text-red-300">{t.me.applicationRejected}</p>}
          <textarea name="message" required minLength={10} maxLength={1000} rows={3} placeholder={t.me.applicationMessage} className={textareaCls} />
          <input name="portfolio" type="url" placeholder={t.me.portfolio} className={inputCls} />
          {state?.error && <p className="text-sm text-red-300">{state.error}</p>}
          <button disabled={pending} className={btn("primary", "md")}>{t.me.apply}</button>
        </form>
      )}
    </div>
  );
}
