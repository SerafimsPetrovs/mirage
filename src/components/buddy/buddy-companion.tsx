"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Shirt, X } from "lucide-react";
import clsx from "clsx";
import { useI18n } from "@/i18n/client";
import { EVENT_MOOD, pickLine, reactionEvent, slotEvent, type BuddyEvent, type BuddyId, type BuddyMood, type Outfit } from "@/lib/buddy-catalog";
import { BuddyFigure } from "./buddy-figure";

type SlotLike = { id: string; kind: string; clipKind: string | null; title: string; info: { tags: string[] } | null };

/** Lines that may interrupt anything (the viewer did something). */
const URGENT: BuddyEvent[] = ["poke", "annoyed", "laugh", "love", "wow", "gold"];
/** Quiet gap between unprompted lines, so the buddy never chatters over the show. */
const GAP_MS = 9000;
const IDLE_LINE_MS = [80_000, 140_000] as const;
const SLEEP_AFTER_MS = 6 * 60_000;

/**
 * The watch buddy: sits in a corner of the full-screen player and watches with you.
 * Comments on what starts (by kind and genre), echoes your reactions, notices a busy chat,
 * wanders along the bottom now and then (the goose a lot), falls asleep when nothing happens,
 * and answers when you tap it. Purely client-side: lines come from i18n, nothing is sent anywhere.
 */
export function BuddyCompanion({
  buddy,
  outfit,
  slot,
  channelKind,
  reaction,
  gold,
  messages,
  controls,
  makeRoom,
  onHide,
  className,
}: {
  buddy: BuddyId;
  outfit: Outfit;
  slot: SlotLike;
  channelKind: string;
  /** Last reaction the viewer sent; `n` changes on every tap. */
  reaction: { emoji: string; n: number } | null;
  /** Gold just earned for watching; `n` changes on every reward. */
  gold?: { amount: number; n: number } | null;
  /** Chat messages on screen (to notice a burst). */
  messages: { id: string }[];
  /** Player controls are visible: show the small hide / dress-up buttons. */
  controls: boolean;
  /** Something else sits in the corner right now (the host's picture-in-picture): step aside. */
  makeRoom?: boolean;
  onHide: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const lines = t.buddy.lines[buddy];
  const [mood, setMood] = useState<BuddyMood>("idle");
  const [line, setLine] = useState<string | null>(null);
  const [talking, setTalking] = useState(false);
  const [bounce, setBounce] = useState(0);
  const [walk, setWalk] = useState({ x: 0, left: false, moving: false });
  const [asleep, setAsleep] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const last = useRef<{ line: string | null; at: number }>({ line: null, at: 0 });
  const timers = useRef<number[]>([]);
  const activity = useRef(0);
  const pokes = useRef<number[]>([]);
  const titleRef = useRef(slot.title);
  const asleepRef = useRef(false);
  useEffect(() => {
    titleRef.current = slot.title;
  }, [slot.title]);
  useEffect(() => {
    asleepRef.current = asleep;
  }, [asleep]);

  const later = useCallback((ms: number, f: () => void) => {
    const id = window.setTimeout(f, ms);
    timers.current.push(id);
    return id;
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const say = useCallback(
    (ev: BuddyEvent, vars: Record<string, string | number> = {}) => {
      const now = Date.now();
      if (!URGENT.includes(ev) && now - last.current.at < GAP_MS) return;
      let text = pickLine(lines[ev], last.current.line).replace("{title}", titleRef.current);
      for (const [k, v] of Object.entries(vars)) text = text.replace(`{${k}}`, String(v));
      if (!text) return;
      last.current = { line: text, at: now };
      setAsleep(ev === "sleep");
      setMood(EVENT_MOOD[ev]);
      setLine(text);
      setBounce((b) => b + 1);
      const talkMs = Math.min(2600, 500 + text.length * 45);
      setTalking(true);
      later(talkMs, () => setTalking(false));
      later(Math.max(4200, talkMs + 2200), () => {
        setLine((l) => (l === text ? null : l));
        if (ev !== "sleep") setMood((m) => (m === EVENT_MOOD[ev] ? "idle" : m));
      });
    },
    [lines, later],
  );

  // mouth flap while talking
  const [flap, setFlap] = useState(false);
  useEffect(() => {
    if (!talking) return;
    const id = window.setInterval(() => setFlap((f) => !f), 130);
    return () => {
      clearInterval(id);
      setFlap(false);
    };
  }, [talking]);

  // hello (or a night greeting)
  useEffect(() => {
    activity.current = Date.now();
    const h = new Date().getHours();
    const id = window.setTimeout(() => say(h < 5 ? "night" : "hello"), 900);
    return () => clearTimeout(id);
  }, [say]);

  // a new programme
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = window.setTimeout(() => say(slotEvent(slot, channelKind)), 1800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot.id]);

  // the viewer's reactions
  useEffect(() => {
    if (!reaction) return;
    const ev = reactionEvent(reaction.emoji);
    if (ev) say(ev);
  }, [reaction, say]);

  // gold for watching
  useEffect(() => {
    if (gold) say("gold", { n: gold.amount });
  }, [gold, say]);

  // a burst in chat (5+ messages within ~15 s), at most once a minute
  const chatSeen = useRef<{ n: number; at: number }[]>([]);
  const chatSaid = useRef(0);
  const chatIds = useRef<Set<string> | null>(null);
  const [chatCount, setChatCount] = useState(0);
  useEffect(() => {
    // the first batch is history, not a burst
    if (!chatIds.current) {
      chatIds.current = new Set(messages.map((m) => m.id));
      return;
    }
    const seen = chatIds.current;
    const fresh = messages.filter((m) => !seen.has(m.id));
    if (!fresh.length) return;
    fresh.forEach((m) => seen.add(m.id));
    const id = window.setTimeout(() => setChatCount((c) => c + fresh.length), 0);
    return () => clearTimeout(id);
  }, [messages]);
  useEffect(() => {
    if (chatCount === 0) return;
    const now = Date.now();
    chatSeen.current = [...chatSeen.current.filter((c) => now - c.at < 15_000), { n: chatCount, at: now }];
    const oldest = chatSeen.current[0];
    if (chatCount - oldest.n >= 5 && now - chatSaid.current > 60_000) {
      chatSaid.current = now;
      say("chat");
    }
  }, [chatCount, say]);

  // idle chatter, falling asleep, waking up
  useEffect(() => {
    const wake = () => {
      activity.current = Date.now();
      if (asleepRef.current) {
        setAsleep(false);
        setMood("idle");
      }
    };
    const evs = ["pointerdown", "keydown", "mousemove", "touchstart"] as const;
    evs.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    let next = Date.now() + rand(...IDLE_LINE_MS);
    const id = window.setInterval(() => {
      const now = Date.now();
      if (now - activity.current > SLEEP_AFTER_MS) {
        if (!asleepRef.current) say("sleep");
        return;
      }
      if (now > next) {
        next = now + rand(...IDLE_LINE_MS);
        say("idle");
      }
    }, 5000);
    return () => {
      clearInterval(id);
      evs.forEach((e) => window.removeEventListener(e, wake));
    };
  }, [say]);

  // wandering along the bottom (the goose roams far and often)
  useEffect(() => {
    const roam = buddy === "goose" ? 0.6 : 0.28;
    const every = buddy === "goose" ? [18_000, 35_000] : [45_000, 90_000];
    let id = 0;
    const go = () => {
      id = window.setTimeout(() => {
        const w = root.current?.parentElement?.clientWidth ?? 0;
        if (!asleepRef.current && w > 0 && !reduceMotion()) {
          setWalk((cur) => {
            const target = cur.x < 0 ? 0 : -Math.round(w * roam * (0.5 + Math.random() * 0.5));
            return { x: target, left: target < cur.x, moving: true };
          });
          later(3200, () => setWalk((cur) => ({ ...cur, moving: false })));
        }
        go();
      }, rand(every[0], every[1]));
    };
    go();
    return () => clearTimeout(id);
  }, [buddy, later]);

  // make room for the host's picture-in-picture
  useEffect(() => {
    if (!makeRoom) return;
    const w = root.current?.parentElement?.clientWidth ?? 0;
    const id = window.setTimeout(() => {
      setWalk({ x: -Math.round(w * 0.35), left: true, moving: true });
      later(3200, () => setWalk((cur) => ({ ...cur, moving: false })));
    }, 0);
    return () => clearTimeout(id);
  }, [makeRoom, later]);

  const poke = () => {
    activity.current = Date.now();
    const now = Date.now();
    pokes.current = [...pokes.current.filter((p) => now - p < 3000), now];
    say(pokes.current.length >= 4 ? "annoyed" : "poke");
  };

  const shownMood: BuddyMood = asleep ? "sleep" : mood;
  return (
    <div
      ref={root}
      className={clsx("pointer-events-none absolute right-2 z-[19] md:right-5", className)}
      style={{ transform: `translateX(${walk.x}px)`, transition: "transform 3s cubic-bezier(.45,0,.55,1)" }}
    >
      {line && (
        <div className="animate-pop absolute bottom-full right-0 mb-1 w-max max-w-[min(220px,60vw)] origin-bottom-right rounded-2xl rounded-br-md bg-white px-3 py-2 text-[13px] font-semibold leading-snug text-[#17121f] shadow-xl md:max-w-[260px] md:text-sm">
          {line}
        </div>
      )}
      {controls && (
        <div className="pointer-events-auto absolute -top-1 left-0 flex -translate-x-full flex-col gap-1">
          <button type="button" onClick={onHide} aria-label={t.buddy.hide} title={t.buddy.hide} className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/20 backdrop-blur hover:bg-black/80">
            <X size={14} />
          </button>
          <Link href="/me/buddy" aria-label={t.buddy.customize} title={t.buddy.customize} className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/20 backdrop-blur hover:bg-black/80">
            <Shirt size={14} />
          </Link>
        </div>
      )}
      <button
        type="button"
        onClick={poke}
        aria-label={t.buddy.names[buddy]}
        title={t.buddy.tapHint}
        className="pointer-events-auto block touch-manipulation"
      >
        <div key={bounce} className={clsx("buddy-pop", walk.moving && "buddy-walk", !walk.moving && moodAnim(shownMood))}>
          <div style={{ transform: walk.left ? "scaleX(-1)" : undefined }}>
            <BuddyFigure id={buddy} mood={shownMood} outfit={outfit} talking={flap} className="h-[78px] w-[78px] drop-shadow-[0_6px_14px_rgba(0,0,0,.55)] md:h-[118px] md:w-[118px]" />
          </div>
        </div>
      </button>
      {asleep && (
        <div aria-hidden className="buddy-zzz absolute -top-2 right-1 font-display text-lg font-black text-white/80">
          z<span className="text-sm">z</span>
        </div>
      )}
    </div>
  );
}

function moodAnim(m: BuddyMood) {
  if (m === "hype") return "buddy-dance";
  if (m === "scared") return "buddy-shake";
  if (m === "sleep") return "buddy-breathe";
  return "buddy-bob";
}

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function reduceMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
