"use client";
import { useEffect, useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { btn } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";

export function InviteLink({ code, bonus }: { code: string; bonus: number }) {
  const { t } = useI18n();
  const toast = useToast();
  const path = `/r/${code}`;
  const [url, setUrl] = useState(path);
  // Full URL needs the browser origin (works behind any domain / proxy).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setUrl(`${location.origin}${path}`), [path]);
  const text = fmt(t.invite.shareText, { n: bonus });

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-muted">{t.invite.yourLink}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <code className="flex h-12 min-w-0 flex-1 items-center truncate rounded-2xl bg-surface-2 px-4 font-mono text-[15px] ring-1 ring-line">{url}</code>
        <div className="flex gap-2">
          <button
            onClick={() => navigator.clipboard?.writeText(url).then(() => toast(t.invite.copied))}
            className={btn("glass", "md", "h-12 flex-1 sm:flex-none")}
          >
            <Copy size={18} /> {t.invite.copy}
          </button>
          <button
            onClick={async () => {
              if (navigator.share) {
                try {
                  await navigator.share({ title: "MIRAGE", text, url });
                  return;
                } catch {
                  /* cancelled */
                }
              }
              await navigator.clipboard?.writeText(`${text} ${url}`);
              toast(t.invite.copied);
            }}
            className={btn("primary", "md", "h-12 flex-1 sm:flex-none")}
          >
            <Share2 size={18} /> {t.invite.share}
          </button>
        </div>
      </div>
    </div>
  );
}
