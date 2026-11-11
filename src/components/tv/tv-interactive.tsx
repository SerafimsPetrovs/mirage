"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Coins, Gamepad2, HelpCircle, ListChecks, Moon, X } from "lucide-react";
import clsx from "clsx";
import { useI18n } from "@/i18n/client";
import { fmt, plural } from "@/i18n/shared";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { answerQuizAction, finishTvGameAction, quizResultAction, reactTvAction, startTvGameAction, superchatTvAction, voteTvPollAction } from "@/app/actions/tv";
import { GAME_GOOD_SCORE, GAME_SEC, REACTIONS, SUPERCHAT_TIERS, TV_CHAT_MAX, superchatTier } from "@/lib/tv-rules";
import { GOLD_EARN } from "@/lib/gold-rules";
import type { TvChannelDTO, TvPinnedDTO, TvPollDTO, TvSlotDTO } from "@/lib/tv-types";
import { useNow, type Clock } from "./tv-stage";

function vid() {
  try {
    return localStorage.getItem("tv-vid") ?? "x";
  } catch {
    return "x";
  }
}

// ───────────── reactions ─────────────

type Floating = { key: string; emoji: string; x: number; dur: number };

/** Emojis float up the right side of the picture; everyone's reactions arrive through the live feed. */
export function useFloating(incoming: { id: string; emoji: string }[]) {
  const [items, setItems] = useState<Floating[]>([]);
  const seen = useRef(new Set<string>());
  const add = useCallback((emoji: string, key = Math.random().toString(36)) => {
    const f = { key, emoji, x: Math.random() * 70, dur: 2.4 + Math.random() * 1.4 };
    setItems((l) => [...l.slice(-30), f]);
    window.setTimeout(() => setItems((l) => l.filter((i) => i.key !== f.key)), f.dur * 1000 + 100);
  }, []);
  useEffect(() => {
    const fresh = incoming.filter((r) => !seen.current.has(r.id));
    fresh.forEach((r, i) => {
      seen.current.add(r.id);
      window.setTimeout(() => add(r.emoji, r.id), i * 120);
    });
  }, [incoming, add]);
  return { items, add };
}

export function ReactionsLayer({ items }: { items: Floating[] }) {
  return (
    <div aria-hidden className="pointer-events-none absolute bottom-24 right-2 z-[9] h-[55%] w-28 overflow-hidden md:right-6 md:w-36">
      {items.map((f) => (
        <span key={f.key} className="tv-float absolute bottom-0 text-3xl md:text-4xl" style={{ left: `${f.x}%`, animationDuration: `${f.dur}s` }}>
          {f.emoji}
        </span>
      ))}
    </div>
  );
}

export function ReactionBar({ slug, onLocal }: { slug: string; onLocal: (emoji: string) => void }) {
  const { t } = useI18n();
  const send = (e: string) => {
    onLocal(e);
    void reactTvAction(slug, e, vid());
  };
  return (
    <div className="flex items-center gap-0.5 rounded-full bg-black/55 p-1 ring-1 ring-white/15 backdrop-blur" role="group" aria-label={t.tv.live2.react}>
      {REACTIONS.map((e) => (
        <button key={e} type="button" onClick={() => send(e)} aria-label={`${t.tv.live2.react} ${e}`} className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition-transform hover:scale-125 active:scale-90">
          {e}
        </button>
      ))}
    </div>
  );
}

// ───────────── pinned super chat ─────────────

export function PinnedBanner({ pinned }: { pinned: TvPinnedDTO | null }) {
  const { t } = useI18n();
  if (!pinned) return null;
  const tier = superchatTier(pinned.paid);
  return (
    <div className="pointer-events-none absolute left-1/2 top-[max(70px,calc(env(safe-area-inset-top)+64px))] z-[19] w-[min(92%,560px)] -translate-x-1/2 animate-pop md:top-6">
      <div className="rounded-2xl px-4 py-2.5 text-black shadow-2xl" style={{ background: tier?.color }}>
        <div className="text-[11px] font-black uppercase tracking-wider opacity-80">
          {fmt(t.tv.live2.thanks, { name: pinned.name })} · {fmt(t.tv.coinsShort, { n: pinned.paid })}
        </div>
        <p className="line-clamp-2 break-words text-[15px] font-semibold md:text-base">{pinned.text}</p>
      </div>
    </div>
  );
}

export function SuperchatSheet({ open, onClose, slug, loggedIn, coins, onCoins }: { open: boolean; onClose: () => void; slug: string; loggedIn: boolean; coins: number; onCoins: (n: number) => void }) {
  const { t } = useI18n();
  const s = t.tv.live2.superchat;
  const toast = useToast();
  const [tier, setTier] = useState<number>(SUPERCHAT_TIERS[0].coins);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const r = await superchatTvAction(slug, text, tier);
    setBusy(false);
    if (r.ok) {
      onCoins(r.balance);
      setText("");
      toast(s.sent, "coin");
      onClose();
    } else if (r.error === "insufficient") toast(t.tv.noCoins, "error");
    else toast((t.tv.chat.errors as Record<string, string>)[r.error] ?? t.common.error, "error");
  };
  return (
    <Modal open={open} onClose={onClose} label={s.title}>
      <div className="mb-1 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-coin/15 text-coin">
        <Coins size={22} />
      </div>
      <h2 className="mt-2 font-display text-2xl font-bold">{s.title}</h2>
      <p className="mt-2 text-[15px] text-muted">{s.text}</p>
      {!loggedIn ? (
        <Link href={`/login?next=${encodeURIComponent(`/tv/${slug}`)}`} className="mt-5 flex h-12 items-center justify-center rounded-2xl bg-white font-semibold text-black">
          {t.tv.loginCta}
        </Link>
      ) : (
        <form onSubmit={submit} className="mt-4">
          <div className="grid grid-cols-3 gap-2">
            {SUPERCHAT_TIERS.map((x) => (
              <button
                key={x.coins}
                type="button"
                onClick={() => setTier(x.coins)}
                className={clsx("rounded-2xl px-2 py-3 text-center text-sm font-semibold ring-2 transition", tier === x.coins ? "text-black" : "bg-surface-2 ring-transparent")}
                style={tier === x.coins ? { background: x.color, ["--tw-ring-color" as string]: x.color } : undefined}
              >
                <div className="text-lg">{x.coins}</div>
                <div className="text-[11px] opacity-80">{fmt(s.min, { n: Math.round(x.pinSec / 60) })}</div>
              </button>
            ))}
          </div>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={TV_CHAT_MAX}
            placeholder={s.placeholder}
            aria-label={s.placeholder}
            className="mt-3 h-12 w-full rounded-2xl border border-line bg-surface-2 px-4 text-[15px] outline-none focus:border-coin/50"
          />
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-sm text-muted">
              <Coins size={15} className="text-coin" /> {fmt(t.tv.coinsShort, { n: coins })}
            </span>
            {coins < tier ? (
              <Link href="/me/wallet" className="inline-flex h-12 items-center rounded-2xl bg-coin px-5 font-semibold text-black">
                {t.tv.topUp}
              </Link>
            ) : (
              <button type="submit" disabled={busy || !text.trim()} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-coin px-5 font-semibold text-black disabled:opacity-50">
                {fmt(s.send, { coins: tier })}
              </button>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}

// ───────────── "What's next?" poll ─────────────

export function PollCard({ poll, clock, loggedIn, onVoted }: { poll: TvPollDTO; clock: Clock; loggedIn: boolean; onVoted: (p: TvPollDTO) => void }) {
  const { t, locale } = useI18n();
  const p = t.tv.live2.poll;
  const toast = useToast();
  const now = useNow(clock);
  const [busy, setBusy] = useState(false);
  // Phones: starts as a small pill so the card doesn't cover the picture (the poll arrives client-side, no SSR mismatch).
  const [collapsed, setCollapsed] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  const left = Math.max(0, Math.ceil((poll.endsAt - now) / 1000));
  const total = poll.options.reduce((a, o) => a + o.votes, 0);
  const done = poll.winner != null;
  const showBars = done || poll.myVote != null;

  const vote = async (i: number) => {
    if (!loggedIn) return toast(p.login, "error");
    if (busy || poll.myVote != null || done) return;
    setBusy(true);
    const r = await voteTvPollAction(poll.id, i);
    setBusy(false);
    if (r.ok) {
      onVoted({ ...poll, myVote: i, options: poll.options.map((o, k) => (k === i ? { ...o, votes: o.votes + 1 } : o)) });
      toast(r.gold ? fmt(p.plusGold, { n: r.gold }) : p.voted, r.gold ? "coin" : "ok");
    } else toast(t.common.error, "error");
  };

  if (collapsed)
    return (
      <button type="button" onClick={() => setCollapsed(false)} className="flex h-10 items-center gap-2 rounded-full bg-black/70 px-3.5 text-sm font-semibold ring-1 ring-[#7dffb2]/40 backdrop-blur">
        <ListChecks size={16} className="text-[#7dffb2]" /> {p.title} {!done && <span className="tv-osd">{left}</span>}
      </button>
    );

  return (
    <div className="w-[min(88vw,320px)] animate-pop rounded-2xl bg-black/80 p-3.5 ring-1 ring-[#7dffb2]/35 backdrop-blur-md">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-bold">
            <ListChecks size={16} className="text-[#7dffb2]" /> {p.title}
          </div>
          <div className="text-[11px] text-white/60">{done ? fmt(p.winner, { title: poll.options[poll.winner!]?.title ?? "" }) : p.hint}</div>
        </div>
        <div className="flex items-center gap-1">
          {!done && <span className="tv-osd whitespace-nowrap text-xl">{fmt(p.left, { s: left })}</span>}
          <button type="button" onClick={() => setCollapsed(true)} aria-label={t.common.close} className="rounded-full p-1 text-white/50 hover:text-white">
            <X size={15} />
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        {poll.options.map((o, i) => {
          const pct = total ? Math.round((o.votes / total) * 100) : 0;
          const win = done && poll.winner === i;
          return (
            <button
              key={i}
              type="button"
              disabled={busy || done || poll.myVote != null}
              onClick={() => vote(i)}
              className={clsx(
                "relative w-full overflow-hidden rounded-xl px-3 py-2 text-left text-[13px] font-medium ring-1 transition",
                win ? "ring-[#7dffb2]" : poll.myVote === i ? "ring-white/50" : "ring-white/10 enabled:hover:ring-white/30",
              )}
            >
              {showBars && <span className="absolute inset-y-0 left-0 bg-[#7dffb2]/20 transition-[width] duration-700" style={{ width: `${pct}%` }} />}
              <span className="relative flex items-center justify-between gap-2">
                <span className="line-clamp-1">{o.title}</span>
                {showBars && <span className="tv-osd shrink-0 text-base">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      {showBars && <div className="mt-1.5 text-right text-[11px] text-white/50">{total} {plural(total, p.votes, locale)}</div>}
    </div>
  );
}

// ───────────── quiz ─────────────

export function QuizCard({ slot, channel, clock, loggedIn, onAnswered }: { slot: TvSlotDTO; channel: TvChannelDTO; clock: Clock; loggedIn: boolean; onAnswered: (slotId: string, options: string[]) => void }) {
  const { t } = useI18n();
  const q = t.tv.live2.quiz;
  const toast = useToast();
  const now = useNow(clock);
  const [mine, setMine] = useState<number | null>(null);
  const end = slot.startsAt + slot.durationSec * 1000;
  const left = Math.max(0, Math.ceil((end - now) / 1000));

  const answer = async (i: number) => {
    if (!loggedIn) return toast(q.login, "error");
    if (mine != null || left <= 0) return;
    setMine(i);
    const r = await answerQuizAction(slot.id, i);
    if (r.ok) onAnswered(slot.id, slot.quiz?.options ?? []);
    else setMine(null);
  };

  const h = channel.hue;
  return (
    <div className="absolute inset-0 z-[2] flex items-center justify-center overflow-hidden px-4">
      <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(70% 70% at 50% 35%, hsl(${(h + 200) % 360} 70% 22%), #000 75%)` }} />
      <div className="relative w-full max-w-2xl text-center">
        <div className="tv-osd mb-2 flex items-center justify-center gap-2 text-2xl uppercase md:text-3xl">
          <HelpCircle size={24} /> {q.title} · {channel.hostName}
        </div>
        <div className="tv-osd mb-4 text-5xl md:text-6xl">{left}</div>
        <h2 className="text-balance font-display text-xl font-bold leading-snug md:text-3xl">{slot.text}</h2>
        <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
          {slot.quiz?.options.map((o, i) => (
            <button
              key={i}
              type="button"
              disabled={mine != null || left <= 0}
              onClick={() => answer(i)}
              className={clsx(
                "rounded-2xl px-4 py-3.5 text-left text-[15px] font-semibold ring-2 transition",
                mine === i ? "bg-white/20 ring-white" : "bg-white/[.07] ring-white/10 enabled:hover:bg-white/15",
              )}
            >
              <span className="tv-osd mr-2 text-lg">{"ABCD"[i]}</span> {o}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm text-white/65">{mine != null ? q.answered : fmt(q.hint, { n: GOLD_EARN.TV_QUIZ.amount })}</p>
      </div>
    </div>
  );
}

/**
 * After a quiz slot ended (the card is gone by then), asks the server for the result of every quiz the viewer
 * answered: toast with the right answer and gold.
 */
export function useQuizResults(currentSlotId: string, onGold: (n: number) => void) {
  const { t } = useI18n();
  const toast = useToast();
  const pending = useRef(new Map<string, string[]>());
  const onAnswered = useCallback((slotId: string, options: string[]) => pending.current.set(slotId, options), []);
  useEffect(() => {
    const due = [...pending.current.entries()].filter(([id]) => id !== currentSlotId);
    if (!due.length) return;
    const timer = window.setTimeout(async () => {
      for (const [id, options] of due) {
        pending.current.delete(id);
        const r = await quizResultAction(id);
        if (!r.ok || r.mine == null) continue;
        const q = t.tv.live2.quiz;
        if (r.mine === r.correct) {
          toast(r.gold ? fmt(q.right, { n: r.gold }) : q.rightNoGold, "coin");
          if (r.gold) onGold(r.gold);
        } else toast(fmt(q.wrong, { answer: options[r.correct] ?? "" }), "error");
      }
    }, 1600);
    return () => clearTimeout(timer);
  }, [currentSlotId, onGold, t, toast]);
  return onAnswered;
}

// ───────────── "Catch the UFO" mini game ─────────────

type Ufo = { id: number; x: number; y: number; vx: number; vy: number; size: number };

export function GameOverlay({ open, onClose, loggedIn, onGold }: { open: boolean; onClose: () => void; loggedIn: boolean; onGold: (n: number) => void }) {
  const { t } = useI18n();
  const g = t.tv.live2.game;
  const toast = useToast();
  const [phase, setPhase] = useState<"intro" | "play" | "done">("intro");
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(GAME_SEC);
  const [ufos, setUfos] = useState<Ufo[]>([]);
  const [result, setResult] = useState<string>("");
  const gameId = useRef<string | null>(null);
  const scoreRef = useRef(0);
  const seq = useRef(0);

  const finish = useCallback(async () => {
    setPhase("done");
    setUfos([]);
    const final = scoreRef.current;
    if (!gameId.current) return setResult(fmt(g.done, { n: final }));
    const r = await finishTvGameAction(gameId.current, final);
    gameId.current = null;
    if (r.ok && r.gold) {
      setResult(fmt(g.won, { gold: r.gold }));
      onGold(r.gold);
      toast(fmt(g.won, { gold: r.gold }), "coin");
    } else if (r.ok && final >= GAME_GOOD_SCORE) setResult(g.limit);
    else setResult(fmt(g.noGold, { n: GAME_GOOD_SCORE }));
  }, [g, onGold, toast]);

  const start = async () => {
    scoreRef.current = 0;
    setScore(0);
    setLeft(GAME_SEC);
    setResult("");
    gameId.current = null;
    if (loggedIn) {
      const r = await startTvGameAction();
      if (r.ok) gameId.current = r.id;
    }
    setPhase("play");
  };

  // Timer + spawning + movement.
  useEffect(() => {
    if (phase !== "play") return;
    const started = Date.now();
    const tick = window.setInterval(() => {
      const l = Math.max(0, GAME_SEC - Math.floor((Date.now() - started) / 1000));
      setLeft(l);
      if (l <= 0) {
        clearInterval(tick);
        void finish();
      }
    }, 250);
    const spawn = window.setInterval(() => {
      setUfos((u) => [
        ...u.slice(-7),
        { id: seq.current++, x: Math.random() * 80 + 5, y: Math.random() * 60 + 10, vx: (Math.random() - 0.5) * 1.6, vy: (Math.random() - 0.5) * 1.2, size: 44 + Math.random() * 26 },
      ]);
    }, 650);
    const move = window.setInterval(() => {
      setUfos((u) =>
        u.map((o) => {
          let { x, y, vx, vy } = o;
          x += vx;
          y += vy;
          if (x < 2 || x > 90) vx = -vx;
          if (y < 5 || y > 80) vy = -vy;
          return { ...o, x, y, vx, vy };
        }),
      );
    }, 50);
    return () => {
      clearInterval(tick);
      clearInterval(spawn);
      clearInterval(move);
    };
  }, [phase, finish]);

  if (!open) return null;
  const hit = (id: number) => {
    scoreRef.current += 1;
    setScore(scoreRef.current);
    setUfos((u) => u.filter((o) => o.id !== id));
  };

  return (
    <div className="absolute inset-0 z-[45] overflow-hidden bg-[radial-gradient(80%_80%_at_50%_30%,#0d2a1d,#000)]" role="dialog" aria-modal="true" aria-label={g.title}>
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-[max(14px,env(safe-area-inset-top))] md:px-8 md:pt-6">
        <div className="tv-osd text-2xl md:text-3xl">{fmt(g.score, { n: score })}</div>
        <div className="flex items-center gap-3">
          {phase === "play" && <div className="tv-osd text-2xl md:text-3xl">{fmt(g.time, { s: left })}</div>}
          <button type="button" onClick={onClose} aria-label={g.close} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
            <X size={18} />
          </button>
        </div>
      </div>
      {phase === "play" &&
        ufos.map((o) => (
          <button
            key={o.id}
            type="button"
            onPointerDown={() => hit(o.id)}
            aria-label="UFO"
            className="absolute -translate-x-1/2 -translate-y-1/2 select-none drop-shadow-[0_0_14px_rgba(125,255,178,.8)] transition-transform active:scale-75"
            style={{ left: `${o.x}%`, top: `${o.y}%`, fontSize: o.size }}
          >
            🛸
          </button>
        ))}
      {phase !== "play" && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="max-w-sm text-center">
            <div className="text-6xl">🛸</div>
            <h2 className="mt-3 font-display text-3xl font-bold">{g.title}</h2>
            <p className="mt-2 text-white/75">{phase === "done" ? result : fmt(g.hint, { n: GAME_GOOD_SCORE })}</p>
            {!loggedIn && phase === "intro" && <p className="mt-1 text-sm text-white/50">{g.login}</p>}
            <div className="mt-6 flex justify-center gap-2">
              <button type="button" onClick={start} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#7dffb2] px-6 font-semibold text-black">
                <Gamepad2 size={18} /> {phase === "done" ? g.again : g.start}
              </button>
              {phase === "done" && (
                <button type="button" onClick={onClose} className="inline-flex h-12 items-center rounded-2xl bg-white/10 px-5 font-semibold">
                  {g.close}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────── sleep timer ─────────────

export const SLEEP_STEPS = [0, 15, 30, 60] as const;

export function SleepScreen({ onWake }: { onWake: () => void }) {
  const { t } = useI18n();
  return (
    <button type="button" onClick={onWake} className="absolute inset-0 z-[50] flex flex-col items-center justify-center bg-black text-center">
      <Moon size={42} className="text-[#7dffb2]" />
      <div className="tv-osd mt-4 text-4xl">{t.tv.live2.goodnight}</div>
      <p className="mt-2 max-w-xs text-white/60">{t.tv.live2.goodnightText}</p>
    </button>
  );
}
