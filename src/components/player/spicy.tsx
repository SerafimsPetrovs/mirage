"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Coins, Dices, Flame, Lock, MessageCircleHeart, Play, ShieldAlert } from "lucide-react";
import { btn } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { CoinAmount } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { buySceneAction, buySkinAction, confirmAdultAction, spinSkinAction, type ExtraResult } from "@/app/actions/extras";
import { ROULETTE_PRICE } from "@/lib/spicy";
import { Sheet } from "./sheet";

export type SkinItem = { id: string; name: string; emoji: string; rarity: string; price: number; owned: boolean };
export type SceneItem = { id: string; title: string; price: number; owned: boolean; triggerAt: number | null; durationSec: number };
export type CharacterItem = { id: string; name: string; tagline: string; avatar: string | null; hue: number };
export type SpicyData = { skins: SkinItem[]; scene: SceneItem | null; characters: CharacterItem[] };

const RARITY_CLS: Record<string, string> = {
  common: "bg-white/10 text-white/80",
  rare: "bg-[#3ec5ff]/20 text-[#8fdcff]",
  epic: "bg-[#c084fc]/25 text-[#e3c4ff]",
};

/**
 * Runs a paid 18+ action; on "age" asks the viewer to confirm 18+ once, then retries.
 * Handles "auth" (login) and "insufficient" (toast + wallet link) uniformly.
 */
export function useSpicyRunner(onBalance: (b: number) => void) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [ageOpen, setAgeOpen] = useState(false);
  const retry = useRef<null | (() => void)>(null);
  const [pending, start] = useTransition();

  const run = useCallback(
    <T,>(fn: () => Promise<ExtraResult<T>>, onOk: (r: { ok: true; balance: number } & T) => void, onFail?: () => void) => {
      const go = () =>
        start(async () => {
          const r = await fn();
          if (r.ok) {
            onBalance(r.balance);
            onOk(r);
            return;
          }
          onFail?.();
          if (r.error === "age") {
            retry.current = go;
            setAgeOpen(true);
          } else if (r.error === "auth") router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
          else if (r.error === "insufficient") toast(t.spicy.notEnough, "error");
          else if (r.error === "nothing") toast(t.spicy.allOwned);
          else if (r.error === "llm") toast(t.chat.errorLlm, "error");
          else if (r.error === "rate") toast(t.chat.rateLimited, "error");
          else toast(t.spicy.blocked, "error");
        });
      go();
    },
    [onBalance, router, t, toast],
  );

  const gate = (
    <Modal open={ageOpen} onClose={() => setAgeOpen(false)} label={t.spicy.ageTitle}>
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 font-display text-lg font-bold text-accent-2">18+</div>
        <h2 className="font-display text-lg font-semibold">{t.spicy.ageTitle}</h2>
        <p className="mt-2 text-sm text-muted">{t.spicy.ageText}</p>
        <div className="mt-6 space-y-2.5">
          <button
            className={btn("primary", "lg", "w-full")}
            onClick={async () => {
              const r = await confirmAdultAction();
              setAgeOpen(false);
              if (r.ok) retry.current?.();
            }}
          >
            <ShieldAlert size={18} /> {t.spicy.ageConfirm}
          </button>
          <button className={btn("ghost", "lg", "w-full")} onClick={() => setAgeOpen(false)}>
            {t.spicy.ageDecline}
          </button>
        </div>
      </div>
    </Modal>
  );
  return { run, gate, pending };
}

/** Outfit picker with a mini roulette. Wearing switches the stream at the current second. */
export function SkinsSheet({
  open,
  onClose,
  episodeId,
  skins,
  setSkins,
  current,
  onWear,
  balance,
  runner,
}: {
  open: boolean;
  onClose: () => void;
  episodeId: string;
  skins: SkinItem[];
  setSkins: (s: SkinItem[]) => void;
  current: string | null;
  onWear: (id: string | null) => void;
  balance: number;
  runner: ReturnType<typeof useSpicyRunner>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [reel, setReel] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const allOwned = skins.every((s) => s.owned);

  const spin = () => {
    setSpinning(true);
    let i = 0;
    const id = setInterval(() => setReel(skins[i++ % skins.length].emoji), 90);
    runner.run(
      () => spinSkinAction(episodeId),
      (r) => {
        setTimeout(() => {
          clearInterval(id);
          const won = skins.find((s) => s.id === r.skinId)!;
          setReel(won.emoji);
          setSpinning(false);
          setSkins(skins.map((s) => (s.id === won.id ? { ...s, owned: true } : s)));
          toast(fmt(t.spicy.won, { name: won.name }), "coin");
          onWear(won.id);
        }, 1400);
      },
      () => {
        clearInterval(id);
        setSpinning(false);
        setReel(null);
      },
    );
  };

  const buy = (s: SkinItem) =>
    runner.run(
      () => buySkinAction(s.id),
      () => {
        setSkins(skins.map((x) => (x.id === s.id ? { ...x, owned: true } : x)));
        toast(t.spicy.unlocked, "coin");
        onWear(s.id);
      },
    );

  return (
    <Sheet open={open} onClose={onClose} title={t.spicy.skinsTitle}>
      <p className="-mt-1 mb-4 text-sm text-muted">{t.spicy.skinsSub}</p>

      <div
        className="mb-5 overflow-hidden rounded-3xl p-4 ring-1 ring-white/10"
        style={{ background: "radial-gradient(90% 140% at 100% 0%, rgba(255,46,99,.35), transparent 60%), radial-gradient(80% 120% at 0% 100%, rgba(124,92,255,.35), transparent 60%), var(--surface-2)" }}
      >
        <div className="flex items-center gap-4">
          <div className={clsx("flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-black/30 text-4xl ring-1 ring-white/15", spinning && "animate-pulse")} aria-live="polite">
            {reel ?? "🎰"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
              <CoinAmount value={balance} size={12} />
            </p>
            <button onClick={spin} disabled={spinning || allOwned || runner.pending} className={btn("primary", "md", "mt-2 w-full")}>
              <Dices size={18} /> {spinning ? t.spicy.spinning : fmt(t.spicy.spin, { price: ROULETTE_PRICE })}
            </button>
            {allOwned && <p className="mt-1.5 text-xs text-muted">{t.spicy.allOwned}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SkinCard emoji="✨" name={t.spicy.original} active={current === null} action={current === null ? t.spicy.wearing : t.spicy.wear} onClick={() => onWear(null)} />
        {skins.map((s) => (
          <SkinCard
            key={s.id}
            emoji={s.emoji}
            name={s.name}
            rarity={t.spicy.rarity[s.rarity as keyof typeof t.spicy.rarity] ?? s.rarity}
            rarityKey={s.rarity}
            active={current === s.id}
            locked={!s.owned}
            action={!s.owned ? fmt(t.spicy.buyFor, { price: s.price }) : current === s.id ? t.spicy.wearing : t.spicy.wear}
            onClick={() => (s.owned ? onWear(s.id) : buy(s))}
            disabled={runner.pending || spinning}
          />
        ))}
      </div>
    </Sheet>
  );
}

function SkinCard({ emoji, name, rarity, rarityKey, active, locked, action, onClick, disabled }: {
  emoji: string; name: string; rarity?: string; rarityKey?: string; active: boolean; locked?: boolean; action: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={clsx(
        "group relative flex flex-col items-center rounded-3xl bg-surface-2 p-4 text-center ring-1 transition active:scale-[.98] disabled:opacity-60",
        active ? "ring-2 ring-accent" : "ring-line hover:ring-white/25",
      )}
    >
      {locked && <Lock size={14} className="absolute right-3 top-3 text-white/50" />}
      {active && <Check size={16} className="absolute right-3 top-3 text-accent" />}
      <span className="text-4xl" aria-hidden>{emoji}</span>
      <span className="mt-2 line-clamp-1 text-sm font-semibold">{name}</span>
      {rarity && <span className={clsx("mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", RARITY_CLS[rarityKey ?? "common"])}>{rarity}</span>}
      <span className={clsx("mt-3 inline-flex items-center gap-1 text-xs font-semibold", locked ? "text-coin" : active ? "text-accent-2" : "text-white/80")}>
        {locked && <Coins size={13} />}
        {action}
      </span>
    </button>
  );
}

/** Glowing "deleted scene" offer + its own mini player. */
export function SceneOffer({
  scene,
  setScene,
  visible,
  runner,
  onOpenChange,
  className,
}: {
  scene: SceneItem;
  setScene: (s: SceneItem) => void;
  visible: boolean;
  runner: ReturnType<typeof useSpicyRunner>;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const buy = () =>
    runner.run(
      () => buySceneAction(scene.id),
      () => {
        setScene({ ...scene, owned: true });
        toast(t.spicy.unlocked, "coin");
      },
    );

  return (
    <>
      {visible && (
        <button
          onClick={() => setOpen(true)}
          className={clsx(
            "animate-fade-up inline-flex items-center gap-2 rounded-full bg-[linear-gradient(100deg,#ff2e63,#ff7a3d)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_40px_-8px_rgba(255,60,80,.8)] ring-1 ring-white/25 transition active:scale-95",
            className,
          )}
        >
          <Flame size={17} className="fill-white/30" />
          <span>{t.spicy.sceneOffer}</span>
          {!scene.owned && (
            <span className="rounded-full bg-black/25 px-2 py-0.5 text-xs">
              <Coins size={11} className="-mt-0.5 mr-0.5 inline" />
              {scene.price}
            </span>
          )}
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} label={t.spicy.sceneTitle} className="max-w-md">
        {scene.owned ? (
          <div>
            <p className="mb-3 pr-8 font-display font-semibold">🔥 {scene.title}</p>
            <video src={`/api/scene/${scene.id}`} controls autoPlay playsInline className="aspect-[9/16] max-h-[70dvh] w-full rounded-2xl bg-black object-contain" />
          </div>
        ) : (
          <div className="text-center">
            <div className="relative mx-auto mb-5 flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl bg-[radial-gradient(80%_100%_at_50%_100%,rgba(255,46,99,.5),transparent),linear-gradient(160deg,#2a0f1f,#120914)]">
              <Flame size={56} className="text-accent drop-shadow-[0_0_24px_rgba(255,46,99,.8)]" />
              <span className="absolute left-3 top-3 rounded-md bg-black/50 px-2 py-0.5 text-xs font-bold">{t.spicy.badge}</span>
            </div>
            <h2 className="font-display text-lg font-semibold">{t.spicy.sceneTitle}</h2>
            <p className="mt-1 text-sm font-medium text-white/85">{scene.title}</p>
            <p className="mt-2 text-sm text-muted">{t.spicy.sceneText}</p>
            <button onClick={buy} disabled={runner.pending} className={btn("coin", "lg", "mt-6 w-full")}>
              <Coins size={18} /> {fmt(t.spicy.sceneBuy, { price: scene.price })}
            </button>
            <Link href="/me/wallet" className="mt-3 inline-block text-sm text-muted hover:text-text">{t.spicy.topUp}</Link>
          </div>
        )}
        {scene.owned && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
            <Play size={12} /> {t.spicy.sceneWatch}
          </p>
        )}
      </Modal>
    </>
  );
}

/** "Characters online" strip — avatars with a green dot, linking to the DM chat. */
export function CharacterStrip({ characters, className, compact }: { characters: CharacterItem[]; className?: string; compact?: boolean }) {
  const { t } = useI18n();
  if (!characters.length) return null;
  return (
    <div className={className}>
      {!compact && (
        <div className="mb-3 flex items-center gap-2">
          <MessageCircleHeart size={18} className="text-accent-2" />
          <h3 className="font-display text-base font-semibold">{t.chat.online}</h3>
          <span className="rounded-md border border-white/20 px-1.5 text-[10px] font-bold text-white/70">{t.spicy.badge}</span>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {characters.map((c) => (
          <Link key={c.id} href={`/chat/${c.id}`} className="group flex items-center gap-3 rounded-2xl bg-surface-2/70 p-2.5 pr-3 ring-1 ring-line transition hover:ring-white/25">
            <CharacterAvatar c={c} size={48} online />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{c.name}</p>
              <p className="truncate text-xs text-muted">{c.tagline}</p>
            </div>
            <span className={btn("primary", "sm", "shrink-0")}>{t.chat.write}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function CharacterAvatar({ c, size = 44, online }: { c: { name: string; avatar: string | null; hue: number }; size?: number; online?: boolean }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {c.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.avatar} alt="" className="h-full w-full rounded-full object-cover ring-2 ring-white/15" />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center rounded-full font-display font-bold text-white ring-2 ring-white/15"
          style={{ background: `linear-gradient(135deg, hsl(${c.hue} 80% 60%), hsl(${(c.hue + 40) % 360} 70% 35%))`, fontSize: size * 0.4 }}
        >
          {c.name.charAt(0)}
        </span>
      )}
      {online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-ok ring-2 ring-surface" />}
    </span>
  );
}

