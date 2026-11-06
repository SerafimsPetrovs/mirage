"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Flag } from "lucide-react";
import clsx from "clsx";
import { Modal } from "@/components/ui/modal";
import { btn } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { reportAction } from "@/app/actions/reports";

const REASONS = ["spam", "abuse", "sexual", "minors", "violence", "copyright", "other"] as const;

/**
 * Flag button + dialog. `variant="icon"` = round glass button (series page),
 * `"text"` = tiny link (under a comment).
 */
export function ReportButton({
  targetType,
  targetId,
  loggedIn,
  variant = "icon",
  className,
}: {
  targetType: "SERIES" | "COMMENT" | "CHARACTER";
  targetId: string;
  loggedIn: boolean;
  variant?: "icon" | "iconSm" | "text";
  className?: string;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null);
  const [details, setDetails] = useState("");
  const [pending, start] = useTransition();

  const openDialog = () => {
    if (!loggedIn) {
      toast(t.report.errors.auth);
      return;
    }
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    start(async () => {
      const r = await reportAction({ targetType, targetId, reason, details });
      if (r.ok) {
        toast(t.report.sent);
        setOpen(false);
        setReason(null);
        setDetails("");
        return;
      }
      const errs = t.report.errors;
      toast(r.error in errs ? errs[r.error as keyof typeof errs] : errs.generic);
      if (r.error === "duplicate" || r.error === "own") setOpen(false);
    });
  };

  return (
    <>
      {variant !== "text" ? (
        <button className={clsx(btn("glass", "icon", variant === "icon" ? "h-13 w-13" : undefined), className)} aria-label={t.report.button} title={t.report.button} onClick={openDialog}>
          <Flag size={19} />
        </button>
      ) : (
        <button className={clsx("text-xs text-muted hover:text-text", className)} onClick={openDialog}>
          {t.report.button}
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} label={t.report.title} className="max-w-md">
        <form onSubmit={submit}>
          <h2 className="pr-8 font-display text-xl font-bold">{t.report.title}</h2>
          <p className="mt-1 text-sm text-muted">{t.report.subtitle}</p>
          <fieldset className="mt-4 space-y-1.5">
            {REASONS.map((r) => (
              <label
                key={r}
                className={clsx(
                  "flex cursor-pointer items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[15px] ring-1 transition",
                  reason === r ? "bg-accent/12 ring-accent/60" : "bg-surface-2 ring-line hover:ring-white/20",
                )}
              >
                <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[var(--color-accent)]" />
                {t.report.reasons[r]}
              </label>
            ))}
          </fieldset>
          {reason === "copyright" && (
            <p className="mt-3 text-xs text-muted">
              {t.report.copyrightHint}{" "}
              <Link href="/legal/copyright" className="text-text underline">
                {t.report.copyrightLink}
              </Link>
              .
            </p>
          )}
          <label className="mt-4 block text-sm text-muted">
            {t.report.details}
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={1000}
              rows={3}
              className="mt-1.5 w-full resize-none rounded-2xl bg-surface-2 px-4 py-3 text-[15px] text-text outline-none ring-1 ring-line focus:ring-accent/60"
            />
          </label>
          <button type="submit" disabled={!reason || pending} className={btn("primary", "md", "mt-4 w-full")}>
            {t.report.send}
          </button>
        </form>
      </Modal>
    </>
  );
}
