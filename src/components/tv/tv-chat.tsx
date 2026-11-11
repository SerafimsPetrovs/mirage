"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronsRight, Coins, Flag, MessageCircle, Pin, Send, Sparkles, VolumeX, X } from "lucide-react";
import clsx from "clsx";
import { useI18n } from "@/i18n/client";
import { CoinAmount } from "@/components/ui/misc";
import { fmt } from "@/i18n/shared";
import { useToast } from "@/components/ui/toast";
import { reportTvMessageAction, sendTvMessageAction, superchatTvAction } from "@/app/actions/tv";
import { HIGHLIGHT_PRICE, paidColor, REACTIONS, TV_CHAT_MAX, TV_TICKER_PRICE } from "@/lib/tv-rules";
import type { TvChatMessage, TvLiveDTO, TvPinnedDTO, TvPollDTO, TvTickerItem } from "@/lib/tv-types";

const POLL_MS = 3000;
const BEAT_MS = 60_000;

function viewerId() {
  try {
    let v = localStorage.getItem("tv-vid");
    if (!v) localStorage.setItem("tv-vid", (v = Math.random().toString(36).slice(2, 12)));
    return v;
  } catch {
    return "x";
  }
}

/**
 * The channel's live feed (chat, ticker, reactions, viewers, pinned super chat, poll), polled every 3 s while
 * the tab is visible. Once a minute the request doubles as the watching heartbeat (gold for logged-in viewers).
 */
export function useTvLive(slug: string, onGold?: (earned: number, total: number | null) => void) {
  const [messages, setMessages] = useState<TvChatMessage[]>([]);
  const [tickers, setTickers] = useState<TvTickerItem[]>([]);
  const [reactions, setReactions] = useState<{ id: string; emoji: string }[]>([]);
  const [viewers, setViewers] = useState(0);
  const [pinned, setPinned] = useState<TvPinnedDTO | null>(null);
  const [poll, setPoll] = useState<TvPollDTO | null>(null);
  const [gold, setGold] = useState<number | null>(null);
  const [alerts, setAlerts] = useState<TvLiveDTO["alerts"]>([]);
  const [pip, setPip] = useState<TvLiveDTO["pip"]>(null);
  const since = useRef(0);
  const lastBeat = useRef(0);
  const goldCb = useRef(onGold);
  useEffect(() => {
    goldCb.current = onGold;
  });

  const load = useCallback(async () => {
    try {
      const beat = Date.now() - lastBeat.current >= BEAT_MS;
      const res = await fetch(`/api/tv/${slug}/live?since=${since.current}&v=${viewerId()}${beat ? "&beat=1" : ""}`, { cache: "no-store" });
      if (!res.ok) return;
      if (beat) lastBeat.current = Date.now();
      const d = (await res.json()) as TvLiveDTO;
      setTickers(d.tickers);
      setViewers(d.viewers);
      setPinned(d.pinned);
      setPoll(d.poll);
      setGold(d.gold);
      setAlerts(d.alerts ?? []);
      setPip(d.pip ?? null);
      if (d.goldEarned > 0) goldCb.current?.(d.goldEarned, d.gold);
      if (d.reactions.length) setReactions(d.reactions);
      if (d.messages.length) {
        since.current = Math.max(since.current, d.messages[d.messages.length - 1].at);
        setMessages((old) => {
          const seen = new Set(old.map((m) => m.id));
          return [...old, ...d.messages.filter((m) => !seen.has(m.id))].slice(-80);
        });
      }
    } catch {
      /* offline — try again next tick */
    }
  }, [slug]);

  useEffect(() => {
    since.current = 0;
    const reset = window.setTimeout(() => {
      setMessages([]);
      setTickers([]);
      setPoll(null);
      setPinned(null);
    }, 0);
    void load();
    const id = window.setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    return () => {
      clearTimeout(reset);
      clearInterval(id);
    };
  }, [load]);

  return { messages, tickers, reactions, viewers, pinned, poll, gold, alerts, pip, setGold, setPoll, reload: load };
}

export function ChatPanel({
  slug,
  messages,
  loggedIn,
  onClose,
  onSent,
  onSuperchat,
  pinned,
  isAdmin,
  onMute,
  className,
  collapse,
  onReact,
  coins,
  onCoins,
}: {
  slug: string;
  messages: TvChatMessage[];
  loggedIn: boolean;
  onClose: () => void;
  onSent: () => void;
  onSuperchat?: () => void;
  pinned?: TvPinnedDTO | null;
  isAdmin?: boolean;
  onMute?: (messageId: string) => void;
  className?: string;
  /** Desktop column: the header button collapses the column instead of closing a sheet. */
  collapse?: boolean;
  /** Quick reactions live with the chat (they fly over the picture for everyone). */
  onReact?: (emoji: string) => void;
  coins?: number;
  onCoins?: (n: number) => void;
}) {
  const { t } = useI18n();
  const c = t.v3.chat;
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    const r = highlight ? await superchatTvAction(slug, text, HIGHLIGHT_PRICE) : await sendTvMessageAction(slug, text);
    setBusy(false);
    if (r.ok) {
      setText("");
      stick.current = true;
      if (highlight && "balance" in r) onCoins?.(r.balance as number);
      setHighlight(false);
      onSent();
    } else if (r.error === "insufficient") toast(t.tv.noCoins, "error");
    else toast((t.tv.chat.errors as Record<string, string>)[r.error] ?? t.common.error, "error");
  };

  const report = async (id: string) => {
    const r = await reportTvMessageAction(id);
    toast(r.ok ? t.tv.chat.reported : t.common.error, r.ok ? "ok" : "error");
  };

  return (
    <aside className={clsx("flex min-h-0 flex-col bg-[#0e0e10]", className)} aria-label={c.title}>
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-3">
        {collapse ? (
          <button type="button" onClick={onClose} title={t.v3.live.hideChat} aria-label={t.v3.live.hideChat} className="flex h-8 w-8 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white">
            <ChevronsRight size={18} />
          </button>
        ) : (
          <span className="w-8" />
        )}
        <h2 className="text-[13px] font-bold uppercase tracking-[.14em] text-white/85">{c.title}</h2>
        {collapse ? (
          <span className="w-8" />
        ) : (
          <button type="button" onClick={onClose} aria-label={t.tv.chat.close} className="flex h-8 w-8 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        )}
      </div>
      <div
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="no-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3"
      >
        {pinned && (
          <div className="sticky top-0 z-10 mb-2 rounded-xl px-3 py-2.5 text-[14px] text-black shadow-lg" style={{ background: paidColor(pinned.paid) ?? undefined }}>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider opacity-80">
              <Pin size={12} /> {pinned.name} · {fmt(t.tv.coinsShort, { n: pinned.paid })}
            </div>
            <p className="mt-0.5 break-words font-semibold">{pinned.text}</p>
          </div>
        )}
        {!messages.length && <p className="pt-6 text-center text-sm text-white/45">{t.tv.chat.empty}</p>}
        {messages.map((m) => {
          const color = m.paid > 0 ? paidColor(m.paid) : null;
          return (
            <div
              key={m.id}
              className={clsx("group flex items-start gap-1.5 rounded-md px-1.5 py-1 text-[14px] leading-snug hover:bg-white/[.04]", color && "border-l-[3px]")}
              style={color ? { background: color + "26", borderColor: color } : undefined}
            >
              <p className="min-w-0 flex-1 break-words">
                <span className="mr-1 font-bold" style={{ color: "hsl(" + m.hue + " 85% 70%)" }}>
                  {m.name}
                </span>
                {m.mine && <span className="mr-1 text-[11px] text-white/40">({t.tv.chat.you})</span>}
                <span className="text-white/90">{m.text}</span>
              </p>
              {isAdmin && !m.mine && onMute && (
                <button type="button" onClick={() => onMute(m.id)} aria-label="Mute" title="Mute 24h" className="shrink-0 rounded p-1 text-red-300/60 opacity-0 hover:text-red-300 group-hover:opacity-100">
                  <VolumeX size={13} />
                </button>
              )}
              {!m.mine && loggedIn && (
                <button
                  type="button"
                  onClick={() => report(m.id)}
                  aria-label={t.tv.chat.report}
                  title={t.tv.chat.report}
                  className="shrink-0 rounded p-1 text-white/30 opacity-0 transition-opacity hover:text-white/80 focus:opacity-100 group-hover:opacity-100 max-md:opacity-60"
                >
                  <Flag size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="shrink-0 space-y-2 border-t border-white/10 p-3">
        {onReact && (
          <div className="flex items-center justify-between gap-1" role="group" aria-label={c.react}>
            {REACTIONS.map((e) => (
              <button key={e} type="button" onClick={() => onReact(e)} aria-label={c.react + " " + e} className="flex h-9 flex-1 items-center justify-center rounded-lg text-xl transition-transform hover:scale-110 hover:bg-white/[.06] active:scale-90">
                {e}
              </button>
            ))}
          </div>
        )}
        {loggedIn ? (
          <form onSubmit={send} className="space-y-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={TV_CHAT_MAX}
              placeholder={t.tv.chat.placeholder}
              aria-label={t.tv.chat.placeholder}
              className={clsx(
                "h-11 w-full rounded-lg border bg-white/[.06] px-3 text-[15px] outline-none placeholder:text-white/40",
                highlight ? "border-[#a78bfa] ring-2 ring-[#a78bfa]/30" : "border-white/10 focus:border-white/30",
              )}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setHighlight((h) => !h)}
                aria-pressed={highlight}
                title={fmt(c.highlightHint, { n: HIGHLIGHT_PRICE })}
                className={clsx("flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold ring-1 transition-colors", highlight ? "bg-[#a78bfa] text-black ring-[#a78bfa]" : "text-[#c4b5fd] ring-[#a78bfa]/40 hover:bg-[#a78bfa]/15")}
              >
                <Sparkles size={14} /> {fmt(c.highlight, { n: HIGHLIGHT_PRICE })}
              </button>
              {onSuperchat && (
                <button type="button" onClick={onSuperchat} aria-label={c.superchat} title={c.superchat} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-coin/15 text-coin hover:bg-coin/25">
                  <Coins size={17} />
                </button>
              )}
              {coins !== undefined && (
                <span className="ml-auto text-xs text-muted">
                  <CoinAmount value={coins} size={12} />
                </span>
              )}
            </div>
            <button type="submit" disabled={busy || !text.trim()} className={clsx("flex h-11 w-full items-center justify-center gap-2 rounded-lg text-[15px] font-bold transition-colors disabled:opacity-50", highlight ? "bg-[#a78bfa] text-black" : "bg-[#9147ff] text-white hover:bg-[#772ce8]")}>
              <Send size={17} /> {highlight ? c.send + " · " + HIGHLIGHT_PRICE : c.send}
              {highlight && <Coins size={15} />}
            </button>
          </form>
        ) : (
          <Link href={"/login?next=" + encodeURIComponent("/tv/" + slug)} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#9147ff] text-[15px] font-bold text-white hover:bg-[#772ce8]">
            <MessageCircle size={17} /> {c.login}
          </Link>
        )}
      </div>
    </aside>
  );
}

/** 2000s crawling SMS ticker at the bottom of the music channel. */
export function TickerBar({ items, onCompose }: { items: TvTickerItem[]; onCompose?: () => void }) {
  const { t } = useI18n();
  const text = items.length
    ? items.map((i) => `${i.name}: ${i.text}`).join("   ✦   ")
    : `${t.tv.ticker.cta} — ${fmt(t.tv.coinsShort, { n: TV_TICKER_PRICE })}   ✦   ${t.tv.likesHint}`;
  const dur = Math.max(18, text.length * 0.22);
  return (
    <div className="relative z-[8] flex h-9 items-stretch overflow-hidden border-y border-white/10 bg-[linear-gradient(90deg,#1b0630,#08122b)] text-[14px] md:h-10 md:text-[15px]">
      <button
        type="button"
        onClick={onCompose}
        disabled={!onCompose}
        className="z-10 flex shrink-0 items-center bg-[#ffde3b] px-3 font-black uppercase tracking-wider text-black disabled:cursor-default"
      >
        {t.tv.ticker.label}
      </button>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div className="tv-marquee absolute inset-y-0 left-0 flex w-max items-center whitespace-nowrap font-semibold" style={{ ["--dur" as string]: `${dur}s` }}>
          <span className="px-6">{text}</span>
          <span className="px-6" aria-hidden>
            {text}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Phones & tablets: the chat as a TikTok-Live overlay — no background, bottom-left over the picture.
 * New messages rise from below, live ~5 s and dissolve; "Write" opens the full chat sheet.
 */
export function ChatOverlay({ messages, onWrite, onReact, lift = 172 }: { messages: TvChatMessage[]; onWrite: () => void; onReact?: (emoji: string) => void; /** px above the bottom UI (theatre: above the lower third) */ lift?: number }) {
  const { t } = useI18n();
  const [shown, setShown] = useState<TvChatMessage[]>([]);
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    // The backlog that was already there when the channel opened is not replayed (only the last two).
    const first = seen.current === null;
    if (first) seen.current = new Set();
    const fresh = messages.filter((m) => !seen.current!.has(m.id));
    fresh.forEach((m) => seen.current!.add(m.id));
    const add = first ? fresh.slice(-2) : fresh;
    if (!add.length) return;
    const id = window.setTimeout(() => setShown((s) => [...s, ...add].slice(-4)), 0);
    const ids = new Set(add.map((m) => m.id));
    const drop = window.setTimeout(() => setShown((s) => s.filter((m) => !ids.has(m.id))), 5000);
    return () => {
      clearTimeout(id);
      // keep the removal timer running: messages must disappear even if more arrive
      void drop;
    };
  }, [messages]);
  return (
    <div style={{ bottom: "calc(var(--tv-ui-bottom, 0px) + " + lift + "px)" }} className="pointer-events-none absolute left-0 z-[17] flex w-[78%] max-w-sm flex-col items-start gap-1.5 px-3 lg:hidden">
      {shown.map((m) => (
        <p key={m.id} className={clsx("chat-float max-w-full break-words text-[14px] leading-snug", m.paid > 0 ? "line-clamp-3" : "line-clamp-2", "text-white [text-shadow:0_1px_3px_rgba(0,0,0,.95),0_0_10px_rgba(0,0,0,.6)]")}>
          <span className="mr-1.5 font-bold" style={{ color: `hsl(${m.hue} 90% 75%)` }}>
            {m.name}
          </span>
          {m.paid > 0 && <span className="mr-1 rounded bg-coin px-1 text-[11px] font-black text-black">{m.paid}</span>}
          {m.text}
        </p>
      ))}
      <div className="pointer-events-auto mt-1 flex items-center gap-1.5">
        <button type="button" onClick={onWrite} className="flex h-9 items-center gap-2 rounded-full bg-black/35 px-3.5 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm">
          <MessageCircle size={16} /> {t.v3.live.write}
        </button>
        {onReact &&
          REACTIONS.slice(0, 3).map((e) => (
            <button key={e} type="button" onClick={() => onReact(e)} aria-label={t.v3.chat.react + " " + e} className="flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-lg ring-1 ring-white/20 backdrop-blur-sm active:scale-90">
              {e}
            </button>
          ))}
      </div>
    </div>
  );
}
