"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Apple, Check, Download, Globe, Monitor } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { useToast } from "@/components/ui/toast";
import { btn } from "@/components/ui/button";
import { CoinAmount } from "@/components/ui/misc";
import { buyAppAction } from "@/app/actions/apps";

/** Buy (once, for coins) or download the installer for Windows / macOS, or open the web version. */
export function AppGetButtons({ slug, price, owned, loggedIn, coins, win, mac, web }: { slug: string; price: number; owned: boolean; loggedIn: boolean; coins: number; win: boolean; mac: boolean; web: string | null }) {
  const { t } = useI18n();
  const a = t.v3.apps;
  const toast = useToast();
  const router = useRouter();
  const [has, setHas] = useState(owned);
  const [pending, start] = useTransition();
  const nothing = !win && !mac && !web;

  if (nothing)
    return (
      <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-line">
        <div className="font-semibold">{a.soon}</div>
        <p className="text-sm text-muted">{a.soonHint}</p>
      </div>
    );

  if (!has) {
    if (!loggedIn)
      return (
        <a href={"/login?next=" + encodeURIComponent("/apps/" + slug)} className={btn("primary", "lg")}>
          {a.loginToGet}
        </a>
      );
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await buyAppAction(slug);
              if (r.ok) {
                setHas(true);
                toast(a.bought, "ok");
                router.refresh();
              } else toast(r.error === "INSUFFICIENT" ? a.insufficient : r.error === "KIDS" ? a.familyBlocked : t.common.error, "error");
            })
          }
          className={btn("primary", "lg")}
        >
          <Download size={18} /> {fmt(a.buy, { n: price })}
        </button>
        <span className="text-sm text-muted">
          <CoinAmount value={coins} size={14} />
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {price > 0 && (
        <p className="flex items-center gap-2 text-sm font-semibold text-ok">
          <Check size={16} /> {a.owned}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {win && (
          <a href={"/api/apps/" + slug + "/download?os=win"} className={btn("primary", "lg")}>
            <Monitor size={18} /> {a.downloadWin}
          </a>
        )}
        {mac && (
          <a href={"/api/apps/" + slug + "/download?os=mac"} className={btn(win ? "glass" : "primary", "lg")}>
            <Apple size={18} /> {a.downloadMac}
          </a>
        )}
        {web && (
          <a href={web} target="_blank" rel="noopener noreferrer" className={btn("glass", "lg")}>
            <Globe size={18} /> {a.openWeb}
          </a>
        )}
      </div>
    </div>
  );
}
