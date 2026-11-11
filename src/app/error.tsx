"use client";
import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { btn } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { MascotCameo } from "@/components/mascot/mascot-cameo";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => console.error(error), [error]);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <MascotCameo kind="oops" className="mb-2 w-[260px] md:w-[320px]" />
      <h1 className="font-display text-2xl font-semibold">{t.common.error}</h1>
      <p className="mt-2 text-sm text-muted">{error.digest}</p>
      <button onClick={reset} className={btn("glass", "lg", "mt-6")}>
        <RefreshCw size={18} /> OK
      </button>
    </div>
  );
}
