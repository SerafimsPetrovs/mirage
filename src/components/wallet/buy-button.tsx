"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { btn } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { safePath } from "@/lib/url";
import { purchaseAction } from "@/app/actions/wallet";

export function BuyButton({
  sku,
  label,
  variant = "coin",
  successText,
  next,
  className,
}: {
  sku: string;
  label: string;
  variant?: "coin" | "vip" | "primary" | "glass";
  successText: string;
  next?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      className={btn(variant, "md", className)}
      onClick={() =>
        start(async () => {
          const r = await purchaseAction(sku);
          if (r.error === "auth") return router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
          if (!r.ok) return toast(t.common.error, "error");
          if (r.redirectUrl) return void (location.href = r.redirectUrl);
          toast(successText, variant === "vip" ? "ok" : "coin");
          if (next && safePath(next, "") ) router.push(safePath(next));
          else router.refresh();
        })
      }
    >
      {pending ? t.common.loading : label}
    </button>
  );
}
