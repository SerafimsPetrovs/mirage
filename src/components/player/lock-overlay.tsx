"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Coins, Crown, Lock, LogIn } from "lucide-react";
import { btn } from "@/components/ui/button";
import { CoinAmount } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { unlockEpisodeAction } from "@/app/actions/wallet";

type Props = {
  episodeId: string;
  number: number;
  reason: "login" | "locked";
  price: number;
  balance: number;
};

export function LockOverlay({ episodeId, number, reason, price, balance }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [short, setShort] = useState(balance < price);
  const back = encodeURIComponent(`/watch/${episodeId}`);

  const unlock = () =>
    start(async () => {
      const r = await unlockEpisodeAction(episodeId);
      if (r.ok) {
        toast(t.player.unlocked, "coin");
        router.refresh();
      } else if (r.error === "insufficient") setShort(true);
      else if (r.error === "auth") router.push(`/login?next=${back}`);
      else toast(t.common.error, "error");
    });

  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-gradient-to-t from-black via-black/70 to-black/30 p-4 backdrop-blur-md md:items-center">
      <div className="animate-fade-up w-full max-w-sm rounded-3xl bg-surface/90 p-6 text-center ring-1 ring-line">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-coin/15 text-coin">
          <Lock size={26} />
        </div>
        {reason === "login" ? (
          <>
            <h2 className="font-display text-lg font-semibold">{t.player.loginTitle}</h2>
            <p className="mt-2 text-sm text-muted">{t.player.loginText}</p>
            <div className="mt-6 space-y-2.5">
              <Link href={`/register?next=${back}`} className={btn("primary", "lg", "w-full")}>
                {t.nav.register}
              </Link>
              <Link href={`/login?next=${back}`} className={btn("glass", "lg", "w-full")}>
                <LogIn size={18} /> {t.nav.login}
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display text-lg font-semibold">{fmt(t.player.lockedTitle, { n: number })}</h2>
            <p className="mt-2 text-sm text-muted">{t.player.lockedText}</p>
            <p className="mt-4 text-sm text-muted">
              {t.wallet.balance}: <CoinAmount value={balance} size={14} />
            </p>
            <div className="mt-5 space-y-2.5">
              {short ? (
                <Link href={`/me/wallet?next=${back}`} className={btn("coin", "lg", "w-full")}>
                  <Coins size={18} /> {t.player.buyCoins}
                </Link>
              ) : (
                <button onClick={unlock} disabled={pending} className={btn("coin", "lg", "w-full")}>
                  <Coins size={18} /> {fmt(t.player.unlockFor, { price })}
                </button>
              )}
              {short && <p className="text-xs text-red-300">{t.player.notEnough}</p>}
              <Link href={`/vip?next=${back}`} className={btn("vip", "lg", "w-full")}>
                <Crown size={18} /> {t.player.getVip}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
