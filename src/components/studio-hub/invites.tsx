"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Copy, KeyRound } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { useToast } from "@/components/ui/toast";
import { btn, inputCls } from "@/components/ui/button";
import { redeemInviteAction } from "@/app/actions/studio-hub";

export function InviteList({ invites }: { invites: { code: string; usedBy: string | null }[] }) {
  const { t } = useI18n();
  const i = t.v3.studio.invites;
  const toast = useToast();
  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(window.location.origin + "/creators?invite=" + code);
      toast(i.copied, "ok");
    } catch {
      toast(code);
    }
  };
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {invites.map((x) => (
        <li key={x.code} className={clsx("flex items-center justify-between gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line", x.usedBy && "opacity-60")}>
          <div>
            <div className="font-mono text-lg font-bold tracking-[.2em]">{x.code}</div>
            <div className={clsx("text-xs", x.usedBy ? "text-muted" : "text-ok")}>{x.usedBy ? fmt(i.used, { name: x.usedBy }) : i.free}</div>
          </div>
          {!x.usedBy && (
            <button type="button" onClick={() => copy(x.code)} className={btn("glass", "sm")} aria-label={i.copy} title={i.copy}>
              <Copy size={15} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** "Got an invite from a creator?" — entering the code makes a viewer a creator at once. */
export function RedeemInvite({ initial = "" }: { initial?: string }) {
  const { t } = useI18n();
  const i = t.v3.studio.invites;
  const toast = useToast();
  const router = useRouter();
  const [code, setCode] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await redeemInviteAction(code);
      if (r.ok) {
        toast(i.redeemed, "ok");
        router.push("/studio");
        router.refresh();
      } else if (r.error === "auth") router.push("/login?next=" + encodeURIComponent("/creators?invite=" + code));
      else setErr(i.errors[r.error] ?? t.common.error);
    });
  };
  return (
    <form onSubmit={submit} className="rounded-3xl bg-surface p-5 ring-1 ring-line md:p-6">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <KeyRound size={18} className="text-coin" /> {i.redeemTitle}
      </h2>
      <p className="mt-1 text-sm text-muted">{i.redeemText}</p>
      <div className="mt-4 flex gap-2">
        <input
          value={code}
          onChange={(e) => (setCode(e.target.value.toUpperCase()), setErr(null))}
          maxLength={12}
          placeholder={i.redeemPh}
          aria-label={i.redeemPh}
          autoComplete="off"
          spellCheck={false}
          className={inputCls + " font-mono uppercase tracking-[.2em] placeholder:font-sans placeholder:normal-case placeholder:tracking-normal"}
        />
        <button disabled={pending || !code.trim()} className={btn("primary", "md", "shrink-0")}>
          {i.redeem}
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-red-300">{err}</p>}
    </form>
  );
}
