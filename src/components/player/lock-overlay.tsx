"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Coins, Crown, Gem, Lock, LogIn, Tv } from "lucide-react";
import { btn } from "@/components/ui/button";
import { CoinAmount } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { unlockEpisodeAction } from "@/app/actions/wallet";
import { unlockWithGoldAction } from "@/app/actions/predictions";
import { goldPrice } from "@/lib/gold-rules";
import { GoldAmount } from "@/components/series/prediction-card";
import type { AdState } from "@/lib/ads";
import { RewardedAd } from "./rewarded-ad";

type Props = {
  episodeId: string;
  number: number;
  reason: "login" | "locked";
  price: number;
  balance: number;
  gold: number;
  ads?: AdState | null;
};

export function LockOverlay({ episodeId, number, reason, price, balance, gold, ads }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [short, setShort] = useState(balance < price);
  const back = encodeURIComponent(`/watch/${episodeId}`);
  const [watching, setWatching] = useState(false);

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

  const goldCost = goldPrice(price);
  const unlockGold = () =>
    start(async () => {
      const r = await unlockWithGoldAction(episodeId);
      if (r.ok) {
        toast(t.gold.unlocked, "coin");
        router.refresh();
      } else if (r.error === "gold") toast(fmt(t.gold.notEnough, { n: goldCost }), "error");
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
            <p className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted">
              <span>{t.wallet.balance}: <CoinAmount value={balance} size={14} /></span>
              <span className="inline-flex items-center gap-1">{t.gold.name}: <GoldAmount value={gold} size={14} /></span>
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
              <button
                onClick={unlockGold}
                disabled={pending || gold < goldCost}
                title={gold < goldCost ? fmt(t.gold.notEnough, { n: goldCost }) : undefined}
                className={btn("glass", "lg", "w-full text-amber-300 disabled:opacity-50")}
              >
                <Gem size={18} /> {fmt(t.gold.openFor, { n: goldCost })}
              </button>
              {gold < goldCost && (
                <Link href="/me/wallet#gold" className="block text-xs text-muted underline-offset-2 hover:underline">
                  {fmt(t.gold.notEnough, { n: goldCost })} · {t.pred.howToEarn}
                </Link>
              )}
              <Link href={`/vip?next=${back}`} className={btn("vip", "lg", "w-full")}>
                <Crown size={18} /> {t.player.getVip}
              </Link>
              {ads && (
                <div className="pt-1">
                  <button
                    onClick={() => setWatching(true)}
                    disabled={ads.leftToday === 0}
                    className={btn("glass", "lg", "w-full")}
                    title={ads.leftToday === 0 ? t.ads.limit : fmt(t.ads.watchHint, { need: ads.needed })}
                  >
                    <Tv size={18} /> {fmt(t.ads.watch, { done: ads.watched, need: ads.needed })}
                  </button>
                  <p className="mt-1.5 text-xs text-muted">{ads.leftToday === 0 ? t.ads.limit : fmt(t.ads.watchHint, { need: ads.needed - ads.watched })}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {watching && ads && <RewardedAd episodeId={episodeId} watched={ads.watched} needed={ads.needed} onClose={() => { setWatching(false); router.refresh(); }} />}
    </div>
  );
}
