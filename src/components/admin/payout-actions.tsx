"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Banknote, X } from "lucide-react";
import { btn, inputCls } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { fmt, formatNumber } from "@/i18n/shared";
import { PAYOUT_MIN_COINS } from "@/lib/payout-rules";
import { adminPayoutAction } from "@/app/actions/payouts";

/** Approve → mark paid, or reject with a reason (coins go back to the creator). */
export function PayoutAdminActions({ id, status, details }: { id: string; status: string; details: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  const run = (to: "APPROVED" | "PAID" | "REJECTED") =>
    start(async () => {
      const r = await adminPayoutAction(id, to, to === "REJECTED" ? note : undefined);
      if (r.ok) {
        toast(t.common.saved);
        setRejecting(false);
        router.refresh();
      } else toast(fmt(t.payouts.errors[r.error], { min: formatNumber(PAYOUT_MIN_COINS, locale) }), "error");
    });

  if (rejecting)
    return (
      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.payouts.rejectReason} maxLength={300} className={inputCls + " h-10 sm:w-72"} autoFocus />
        <button disabled={pending || !note.trim()} onClick={() => run("REJECTED")} className={btn("danger", "sm", "h-10")}>
          {t.payouts.confirmReject}
        </button>
        <button onClick={() => setRejecting(false)} className={btn("ghost", "sm", "h-10")}>{t.common.cancel}</button>
      </div>
    );

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => navigator.clipboard?.writeText(details).then(() => toast(t.series.copied))}
        className={btn("ghost", "sm")}
        aria-label={t.payouts.copy}
        title={t.payouts.copy}
      >
        <Copy size={15} />
      </button>
      {status === "PENDING" && (
        <button disabled={pending} onClick={() => run("APPROVED")} className={btn("glass", "sm")}>
          <Check size={15} /> {t.payouts.approve}
        </button>
      )}
      <button disabled={pending} onClick={() => run("PAID")} className={btn("coin", "sm")}>
        <Banknote size={15} /> {t.payouts.markPaid}
      </button>
      <button disabled={pending} onClick={() => setRejecting(true)} className={btn("danger", "sm")}>
        <X size={15} /> {t.payouts.reject}
      </button>
    </div>
  );
}
