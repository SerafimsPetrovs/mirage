"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Coins, Gem, Lock, Trophy } from "lucide-react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { useToast } from "@/components/ui/toast";
import { btn } from "@/components/ui/button";
import { buyBuddyItemAction, claimAchievementAction, saveBuddyLookAction } from "@/app/actions/buddy";
import type { AchievementState } from "@/lib/achievements";
import { BUDDIES, DEFAULT_BUDDY, OUTFITS, buddyDef, itemDef, owns, type BuddyId, type BuddyMood, type Currency, type Outfit, type OutfitSlot } from "@/lib/buddy-catalog";
import { BuddyFigure } from "./buddy-figure";

type Initial = { look: { buddy: string; outfit: Outfit }; owned: string[]; gold: number; coins: number } | null;

const MOODS: [BuddyMood, string][] = [
  ["happy", "🙂"],
  ["laugh", "😂"],
  ["love", "😍"],
  ["shock", "😮"],
  ["scared", "😱"],
  ["hype", "🤩"],
  ["bored", "😑"],
  ["sleep", "😴"],
];

/** Buddy fitting room: pick a character, try outfit pieces on, buy with gold (earned) or coins, wear. */
export function BuddyShop({ initial, kids, achievements }: { initial: Initial; kids: boolean; achievements: AchievementState[] | null }) {
  const { t } = useI18n();
  const b = t.buddy;
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const guest = !initial;
  const [owned, setOwned] = useState(() => new Set(initial?.owned ?? []));
  const [wallet, setWallet] = useState({ gold: initial?.gold ?? 0, coins: initial?.coins ?? 0 });
  const [saved, setSaved] = useState<{ buddy: BuddyId; outfit: Outfit }>(() => ({ buddy: buddyDef(initial?.look.buddy ?? DEFAULT_BUDDY).id, outfit: initial?.look.outfit ?? {} }));
  const [look, setLook] = useState(saved);
  const [mood, setMood] = useState<BuddyMood>("happy");
  const [achs, setAchs] = useState(achievements ?? []);

  const claim = (id: string) =>
    start(async () => {
      const r = await claimAchievementAction(id);
      if (!r.ok) return toast(t.common.error, "error");
      setAchs((list) => list.map((a) => (a.id === id ? { ...a, claimed: true } : a)));
      if (r.item) {
        setOwned((o) => new Set(o).add(r.item!));
        const slot = OUTFITS.find((o) => o.id === r.item)?.slot;
        if (slot) setLook((l) => ({ ...l, outfit: { ...l.outfit, [slot]: r.item } }));
      }
      if (r.gold) setWallet((w) => ({ ...w, gold: w.gold + r.gold! }));
      setMood("hype");
      toast(r.gold ? `${b.ach.got} ${fmt(b.ach.gold, { n: r.gold })}` : b.ach.got, "coin");
      router.refresh();
    });

  const unowned = useMemo(() => [look.buddy, ...Object.values(look.outfit)].filter((id): id is string => !!id && !owns(owned, id)), [look, owned]);
  const changed = look.buddy !== saved.buddy || JSON.stringify(look.outfit) !== JSON.stringify(saved.outfit);

  const toggle = (slot: OutfitSlot, id: string) => setLook((l) => ({ ...l, outfit: { ...l.outfit, [slot]: l.outfit[slot] === id ? undefined : id } }));
  const clean = (o: Outfit) => Object.fromEntries(Object.entries(o).filter(([, v]) => !!v)) as Outfit;

  const save = (next = look) =>
    start(async () => {
      const r = await saveBuddyLookAction({ buddy: next.buddy, outfit: clean(next.outfit) });
      if (!r.ok) return toast(t.common.error, "error");
      setSaved({ buddy: next.buddy, outfit: clean(next.outfit) });
      toast(b.saved);
      router.refresh();
    });

  const buy = (id: string) =>
    start(async () => {
      const item = itemDef(id);
      if (!item) return;
      const r = await buyBuddyItemAction(id);
      if (!r.ok) {
        if (r.error === "funds") return toast(`${b.funds}: ${item.price} ${item.cur === "gold" ? b.gold : b.coins}`, "error");
        if (r.error === "kids") return toast(b.kids, "error");
        return toast(t.common.error, "error");
      }
      const nextOwned = new Set(owned).add(id);
      setOwned(nextOwned);
      if (r.charged) setWallet((w) => (item.cur === "gold" ? { ...w, gold: w.gold - r.charged! } : { ...w, coins: w.coins - r.charged! }));
      toast(b.bought, "coin");
      // everything tried on is now owned → put it on right away
      if ([look.buddy, ...Object.values(look.outfit)].every((x) => !x || owns(nextOwned, x))) {
        const res = await saveBuddyLookAction({ buddy: look.buddy, outfit: clean(look.outfit) });
        if (res.ok) setSaved({ buddy: look.buddy, outfit: clean(look.outfit) });
      }
      router.refresh();
    });

  const def = buddyDef(look.buddy);
  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      {/* fitting room */}
      <div className="min-w-0 lg:sticky lg:top-[calc(var(--header-h)+16px)] lg:self-start">
        <div
          className="relative overflow-hidden rounded-[28px] p-5 ring-1 ring-line"
          style={{ background: `radial-gradient(70% 60% at 50% 40%, ${def.color}33, transparent 70%), linear-gradient(180deg, #15131f, #0b0b12)` }}
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
            <span>{b.preview}</span>
            {!guest && (
              <span className="flex items-center gap-3 normal-case tracking-normal">
                <span className="inline-flex items-center gap-1 text-amber-300">
                  <Gem size={14} /> {wallet.gold}
                </span>
                <span className="inline-flex items-center gap-1 text-coin">
                  <Coins size={14} /> {wallet.coins}
                </span>
              </span>
            )}
          </div>
          <div className="mx-auto mt-2 w-[200px] md:w-[240px]">
            <div key={look.buddy + mood} className={clsx("buddy-pop", mood === "hype" ? "buddy-dance" : mood === "scared" ? "buddy-shake" : "buddy-bob")}>
              <div>
                <BuddyFigure id={look.buddy} mood={mood} outfit={look.outfit} className="w-full drop-shadow-[0_14px_24px_rgba(0,0,0,.6)]" />
              </div>
            </div>
          </div>
          <h2 className="mt-1 text-center font-display text-2xl font-bold">{b.names[look.buddy]}</h2>
          <p className="mx-auto mt-1 max-w-xs text-center text-sm text-muted">{b.about[look.buddy]}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-0.5 sm:gap-1.5">
            {MOODS.map(([m, e]) => (
              <button key={m} type="button" onClick={() => setMood(m)} aria-label={m} className={clsx("h-8 w-8 rounded-full text-base transition sm:h-9 sm:w-9 sm:text-lg", mood === m ? "bg-white/15 ring-1 ring-white/30" : "hover:bg-white/8")}>
                {e}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {guest ? (
              <Link href="/login?next=/me/buddy" className={btn("primary", "md", "w-full")}>
                {b.loginToCustomize}
              </Link>
            ) : (
              <>
                {unowned.map((id) => {
                  const item = itemDef(id)!;
                  if (item.cur === "reward")
                    return (
                      <p key={id} className="flex items-center justify-center gap-2 rounded-2xl bg-white/[.05] px-3 py-2.5 text-sm text-muted">
                        <Trophy size={16} className="text-amber-300" /> {b.outfitNames[id]} · {b.rewardOnly}
                      </p>
                    );
                  const name = (BUDDIES.some((x) => x.id === id) ? b.names[id as BuddyId] : b.outfitNames[id]) ?? id;
                  return (
                    <button key={id} type="button" disabled={pending || kids} onClick={() => buy(id)} className={btn(item.cur === "gold" ? "glass" : "coin", "md", "h-auto min-h-11 w-full whitespace-normal py-2 text-center")}>
                      {name} · {fmt(b.buyFor, { price: item.price })} <CurIcon cur={item.cur} />
                    </button>
                  );
                })}
                {unowned.length === 0 && changed && (
                  <button type="button" disabled={pending} onClick={() => save()} className={btn("primary", "md", "w-full")}>
                    <Check size={18} /> {b.wear}
                  </button>
                )}
                {kids && <p className="text-center text-xs text-muted">{b.kids}</p>}
              </>
            )}
          </div>
        </div>
        <p className="mt-3 flex items-start gap-2 px-1 text-xs leading-relaxed text-muted">
          <Gem size={14} className="mt-0.5 shrink-0 text-amber-300" /> {b.goldHint}
        </p>
      </div>

      {/* catalog */}
      <div className="min-w-0">
        <h2 className="font-display text-xl font-bold">{b.characters}</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {BUDDIES.map((x) => {
            const active = look.buddy === x.id;
            const have = owns(owned, x.id);
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => setLook((l) => ({ ...l, buddy: x.id }))}
                className={clsx("group relative rounded-3xl p-3 text-left ring-1 transition", active ? "bg-white/[.07] ring-2 ring-white/40" : "bg-surface ring-line hover:bg-white/[.04]")}
              >
                <div className="mx-auto w-[96px] transition-transform duration-200 group-hover:-translate-y-1">
                  <BuddyFigure id={x.id} mood={active ? "happy" : "idle"} className="w-full" />
                </div>
                <div className="mt-1 font-semibold">{b.names[x.id]}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-muted">{b.about[x.id]}</div>
                <Status cur={x.cur} price={x.price} have={have} on={saved.buddy === x.id} labels={b} />
              </button>
            );
          })}
        </div>

        <h2 className="mt-8 font-display text-xl font-bold">{b.outfits}</h2>
        {(["hat", "face", "neck"] as OutfitSlot[]).map((slot) => (
          <div key={slot} className="mt-4">
            <h3 className="text-sm font-semibold text-muted">{b.slots[slot]}</h3>
            <div className="mt-2 grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
              {OUTFITS.filter((o) => o.slot === slot).map((o) => {
                const active = look.outfit[slot] === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggle(slot, o.id)}
                    aria-pressed={active}
                    className={clsx("rounded-2xl p-2 text-center ring-1 transition", active ? "bg-white/[.08] ring-2 ring-white/40" : "bg-surface ring-line hover:bg-white/[.04]")}
                  >
                    <BuddyFigure id={look.buddy} outfit={{ [slot]: o.id }} className="mx-auto w-[64px]" />
                    <div className="mt-1 truncate text-xs font-semibold">{b.outfitNames[o.id]}</div>
                    <Status cur={o.cur} price={o.price} have={owns(owned, o.id)} on={saved.outfit[slot] === o.id} labels={b} small />
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {achs.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-bold">{b.ach.title}</h2>
            <p className="mt-1 text-sm text-muted">{b.ach.sub}</p>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {achs.map((a) => {
                const item = "item" in a.reward ? a.reward.item : null;
                return (
                  <div key={a.id} className={clsx("flex min-w-0 items-center gap-3 rounded-2xl p-3 ring-1", a.done && !a.claimed ? "bg-amber-300/[.07] ring-amber-300/40" : "bg-surface ring-line")}>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[.06] text-2xl">{a.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{b.ach.names[a.id]}</div>
                      <div className="truncate text-xs text-muted">{b.ach.goals[a.id]}</div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-amber-300" style={{ width: `${(a.progress / a.goal) * 100}%` }} />
                        </div>
                        <span className="text-[11px] tabular-nums text-muted">
                          {a.progress}/{a.goal}
                        </span>
                      </div>
                    </div>
                    <div className="flex w-[72px] shrink-0 flex-col items-center gap-1">
                      {item ? (
                        <BuddyFigure id={look.buddy} outfit={{ [OUTFITS.find((o) => o.id === item)!.slot]: item }} className="w-[44px]" />
                      ) : (
                        <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-300">
                          <Gem size={14} /> {"gold" in a.reward ? a.reward.gold : 0}
                        </span>
                      )}
                      {a.claimed ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7dffb2]">
                          <Check size={12} /> {b.ach.claimed}
                        </span>
                      ) : a.done ? (
                        <button type="button" disabled={pending} onClick={() => claim(a.id)} className={btn("coin", "sm", "h-7 px-2.5 text-xs")}>
                          {b.ach.claim}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function CurIcon({ cur }: { cur: Currency }) {
  if (cur === "gold") return <Gem size={15} className="text-amber-300" />;
  if (cur === "coins") return <Coins size={15} />;
  return null;
}

function Status({ cur, price, have, on, labels, small }: { cur: Currency; price: number; have: boolean; on: boolean; labels: { wearing: string; owned: string; free: string; rewardShort: string }; small?: boolean }) {
  const cls = clsx("mt-1.5 inline-flex items-center gap-1 font-semibold", small ? "text-[11px]" : "text-xs");
  if (on) return <span className={clsx(cls, "text-[#7dffb2]")}><Check size={12} /> {labels.wearing}</span>;
  if (have) return <span className={clsx(cls, "text-text/80")}>{cur === "free" ? labels.free : labels.owned}</span>;
  if (cur === "reward") return <span className={clsx(cls, "text-amber-300")}><Trophy size={11} /> {labels.rewardShort}</span>;
  return (
    <span className={clsx(cls, cur === "gold" ? "text-amber-300" : "text-coin")}>
      <Lock size={11} /> {price} <CurIcon cur={cur} />
    </span>
  );
}
