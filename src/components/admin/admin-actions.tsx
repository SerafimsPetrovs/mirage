"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, Coins, Eye, EyeOff, Star, X } from "lucide-react";
import { btn, inputCls } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import {
  grantCoinsAction, moderateSeriesAction, reviewApplicationAction, setCommentHiddenAction, setSeriesFlagsAction, setUserBannedAction, setUserRoleAction,
} from "@/app/actions/admin";

function useAct() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      try {
        await fn();
        toast(t.common.saved);
        router.refresh();
      } catch {
        toast(t.common.error, "error");
      }
    });
  return { pending, run, t };
}

export function ModerationButtons({ seriesId }: { seriesId: string }) {
  const { pending, run, t } = useAct();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  if (rejecting)
    return (
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.admin.rejectReason} className={inputCls} autoFocus />
        <button disabled={pending} onClick={() => run(() => moderateSeriesAction(seriesId, "reject", reason))} className={btn("danger", "md")}>
          {t.admin.reject}
        </button>
        <button onClick={() => setRejecting(false)} className={btn("ghost", "md")}>{t.common.cancel}</button>
      </div>
    );
  return (
    <div className="flex gap-2">
      <button disabled={pending} onClick={() => run(() => moderateSeriesAction(seriesId, "approve"))} className={btn("primary", "md")}>
        <Check size={18} /> {t.admin.approve}
      </button>
      <button onClick={() => setRejecting(true)} className={btn("danger", "md")}>
        <X size={18} /> {t.admin.reject}
      </button>
    </div>
  );
}

export function SeriesFlags({ seriesId, featured, status }: { seriesId: string; featured: boolean; status: string }) {
  const { pending, run, t } = useAct();
  return (
    <div className="flex flex-wrap gap-2">
      <button disabled={pending} onClick={() => run(() => setSeriesFlagsAction(seriesId, { featured: !featured }))} className={btn(featured ? "coin" : "glass", "sm")}>
        <Star size={15} className={featured ? "fill-black" : ""} /> {featured ? t.admin.unfeature : t.admin.feature}
      </button>
      {status === "PUBLISHED" ? (
        <button disabled={pending} onClick={() => run(() => setSeriesFlagsAction(seriesId, { status: "DRAFT", featured: false }))} className={btn("danger", "sm")}>
          <EyeOff size={15} /> {t.admin.unpublish}
        </button>
      ) : (
        <button disabled={pending} onClick={() => run(() => setSeriesFlagsAction(seriesId, { status: "PUBLISHED" }))} className={btn("glass", "sm")}>
          <Eye size={15} /> {t.admin.publish}
        </button>
      )}
    </div>
  );
}

export function UserControls({ userId, role, banned, self }: { userId: string; role: string; banned: boolean; self: boolean }) {
  const { pending, run, t } = useAct();
  const [amount, setAmount] = useState("100");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={t.admin.role}
        disabled={pending || self}
        defaultValue={role}
        onChange={(e) => run(() => setUserRoleAction(userId, e.target.value as "VIEWER" | "CREATOR" | "ADMIN"))}
        className="h-9 rounded-xl bg-surface-2 px-2 text-sm ring-1 ring-line"
      >
        <option value="VIEWER">VIEWER</option>
        <option value="CREATOR">CREATOR</option>
        <option value="ADMIN">ADMIN</option>
      </select>
      <input
        aria-label={t.admin.grant}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        type="number"
        className="h-9 w-20 rounded-xl bg-surface-2 px-2 text-sm ring-1 ring-line"
      />
      <button disabled={pending} onClick={() => run(() => grantCoinsAction(userId, Number(amount)))} className={btn("glass", "sm")} title={t.admin.grant}>
        <Coins size={15} className="text-coin" />
      </button>
      {!self && (
        <button disabled={pending} onClick={() => run(() => setUserBannedAction(userId, !banned))} className={btn(banned ? "glass" : "danger", "sm")}>
          <Ban size={15} /> {banned ? t.admin.unban : t.admin.ban}
        </button>
      )}
    </div>
  );
}

export function ApplicationButtons({ appId }: { appId: string }) {
  const { pending, run, t } = useAct();
  return (
    <div className="flex gap-2">
      <button disabled={pending} onClick={() => run(() => reviewApplicationAction(appId, true))} className={btn("primary", "sm")}>
        <Check size={15} /> {t.admin.approve}
      </button>
      <button disabled={pending} onClick={() => run(() => reviewApplicationAction(appId, false))} className={btn("danger", "sm")}>
        <X size={15} /> {t.admin.reject}
      </button>
    </div>
  );
}

export function CommentToggle({ commentId, hidden }: { commentId: string; hidden: boolean }) {
  const { pending, run, t } = useAct();
  return (
    <button disabled={pending} onClick={() => run(() => setCommentHiddenAction(commentId, !hidden))} className={btn(hidden ? "glass" : "danger", "sm")}>
      {hidden ? <Eye size={15} /> : <EyeOff size={15} />} {hidden ? t.admin.show : t.admin.hide}
    </button>
  );
}
