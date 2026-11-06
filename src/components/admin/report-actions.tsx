"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, EyeOff, MessageSquareOff, X } from "lucide-react";
import { btn } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { resolveReportsAction } from "@/app/actions/reports";

type Action = "dismiss" | "hide" | "unpublish" | "ban";

export function ReportActions({ targetType, targetId, actions }: { targetType: string; targetId: string; actions: Action[] }) {
  const { t } = useI18n();
  const a = t.report.admin;
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (action: Action) => {
    if (action === "ban" && !window.confirm(a.confirmBan)) return;
    start(async () => {
      const r = await resolveReportsAction(targetType, targetId, action);
      toast(r.ok ? a.done : r.error === "badAction" ? a.badAction : r.error === "notFound" ? a.missing : t.report.errors.generic);
      router.refresh();
    });
  };
  const meta: Record<Action, { label: string; icon: React.ReactNode; variant: "glass" | "danger" }> = {
    dismiss: { label: a.dismiss, icon: <X size={15} />, variant: "glass" },
    hide: { label: a.hide, icon: <MessageSquareOff size={15} />, variant: "danger" },
    unpublish: { label: a.unpublish, icon: <EyeOff size={15} />, variant: "danger" },
    ban: { label: a.ban, icon: <Ban size={15} />, variant: "danger" },
  };
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((k) => (
        <button key={k} disabled={pending} onClick={() => run(k)} className={btn(meta[k].variant, "sm")}>
          {meta[k].icon} {meta[k].label}
        </button>
      ))}
    </div>
  );
}
