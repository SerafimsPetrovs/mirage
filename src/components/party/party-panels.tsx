"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { BarChart3, Bike, Check, ClipboardCopy, Crown, ExternalLink, Gamepad2, Plus, Send, Star, Trash2, UserX, X } from "lucide-react";
import { btn, inputCls } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { fmt, formatMoney } from "@/i18n/shared";
import { FOOD_SERVICES, PARTY_POLL_OPTIONS_MAX, PARTY_REACTIONS, type FoodService } from "@/lib/party-rules";
import type { PartyStateDTO } from "@/lib/party";
import type { PartyEvent } from "./use-party";

type State = PartyStateDTO;
type Send = (op: import("@/lib/party").PartyOp) => Promise<{ ok: boolean; error?: string }>;

/** Episode moments as m:ss; live-TV moments are stored as seconds since midnight → shown as hh:mm. */
const mmss = (s: number) =>
  s >= 3600 ? `${String(Math.floor(s / 3600) % 24).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}` : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** System events are stored as { k, ...vars } and rendered in the viewer's language. */
export function useSysText() {
  const { t, locale } = useI18n();
  return (e: PartyEvent) => {
    try {
      const d = JSON.parse(e.body) as Record<string, string | number | boolean>;
      const tpl = (t.party.sys as Record<string, string>)[String(d.k)];
      if (!tpl) return "";
      const vars: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(d)) vars[k] = String(v);
      if (locale === "ru" && d.channelRu) vars.channel = String(d.channelRu);
      return fmt(tpl, vars);
    } catch {
      return "";
    }
  };
}

// ---------------------------------------------------------------- reactions over the video

/** Emojis that fly up over the player for everyone (only reactions that arrive after the page opened). */
export function ReactionsLayer({ events, since }: { events: PartyEvent[]; since: number }) {
  const [shown, setShown] = useState<{ id: string; emoji: string; left: number; rot: number }[]>([]);
  const seen = useRef(new Set<string>());
  useEffect(() => {
    const fresh = events.filter((e) => e.kind === "REACTION" && e.at > since && !seen.current.has(e.id));
    if (!fresh.length) return;
    fresh.forEach((e) => seen.current.add(e.id));
    const add = fresh.map((e, i) => ({ id: e.id, emoji: e.body, left: 8 + ((e.id.charCodeAt(e.id.length - 1) * 37 + i * 13) % 80), rot: ((e.id.charCodeAt(0) % 30) - 15) }));
    const id = window.setTimeout(() => setShown((s) => [...s, ...add].slice(-40)), 0);
    const clear = window.setTimeout(() => setShown((s) => s.filter((x) => !add.some((a) => a.id === x.id))), 3200);
    return () => {
      clearTimeout(id);
      clearTimeout(clear);
    };
  }, [events, since]);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[15] overflow-hidden">
      {shown.map((r) => (
        <span
          key={r.id}
          className="party-float absolute bottom-6 text-4xl drop-shadow-lg md:text-5xl"
          style={{ left: `${r.left}%`, animation: "party-float 3s ease-out forwards", ["--party-rot" as string]: `${r.rot}deg` }}
        >
          {r.emoji}
        </span>
      ))}
    </div>
  );
}

export function ReactionBar({ send }: { send: Send }) {
  const { t } = useI18n();
  const toast = useToast();
  return (
    <div className="flex flex-wrap gap-1">
      {PARTY_REACTIONS.map((e) => (
        <button
          key={e}
          type="button"
          aria-label={e}
          onClick={async () => {
            const r = await send({ op: "react", emoji: e });
            if (!r.ok && r.error === "RATE") toast(t.party.errors.RATE, "error");
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[.06] text-xl transition hover:scale-110 hover:bg-white/[.12] active:scale-95"
        >
          {e}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- chat

export function ChatTab({ events, state, send, timeNow }: { events: PartyEvent[]; state: State; send: Send; timeNow: () => number }) {
  const { t } = useI18n();
  const p = t.party;
  const toast = useToast();
  const sysText = useSysText();
  const [text, setText] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const visible = useMemo(() => events.filter((e) => e.kind !== "REACTION").slice(-150), [events]);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [visible.length]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    const r = await send({ op: "chat", text: body });
    if (!r.ok) {
      setText(body);
      toast((p.errors as Record<string, string>)[r.error ?? ""] ?? t.common.error, "error");
    }
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={list} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3" aria-live="polite">
        {visible.map((e) =>
          e.kind === "SYSTEM" ? (
            <p key={e.id} className="text-center text-xs text-muted">
              {sysText(e)}
            </p>
          ) : (
            <div key={e.id} className={clsx("flex items-start gap-2", e.userId === state.me.id && "flex-row-reverse")}>
              <Avatar name={e.name} hue={e.hue} size={28} />
              <div className={clsx("max-w-[80%] rounded-2xl px-3 py-2 text-sm", e.userId === state.me.id ? "bg-accent/20" : "bg-white/[.06]")}>
                {e.userId !== state.me.id && <p className="text-xs font-semibold text-muted">{e.name}</p>}
                {e.kind === "MOMENT" ? (
                  <p className="flex items-center gap-1.5">
                    <Star size={14} className="shrink-0 fill-coin text-coin" />
                    <span>
                      {fmt(p.momentAt, { time: mmss(e.atSec ?? 0) })}
                      {e.body && <> — {e.body}</>}
                    </span>
                  </p>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{e.body}</p>
                )}
              </div>
            </div>
          ),
        )}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-line p-3">
        <button
          type="button"
          title={p.momentHint}
          aria-label={p.moment}
          onClick={() => send({ op: "moment", atSec: timeNow(), note: text.trim().slice(0, 80) }).then(() => setText(""))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[.06] text-coin hover:bg-white/[.12]"
        >
          <Star size={18} />
        </button>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder={p.chatPh} aria-label={p.chatPh} className={inputCls + " h-11"} />
        <button aria-label={p.send} className={btn("primary", "icon", "h-11 w-11 shrink-0 rounded-2xl")}>
          <Send size={17} />
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- people

export function PeopleTab({ state, send }: { state: State; send: Send }) {
  const { t } = useI18n();
  const p = t.party;
  const toast = useToast();
  const { me, party } = state;
  const act = async (op: import("@/lib/party").PartyOp) => {
    const r = await send(op);
    if (!r.ok) toast((p.errors as Record<string, string>)[r.error ?? ""] ?? t.common.error, "error");
  };
  return (
    <ul className="space-y-1 overflow-y-auto p-3">
      {state.members.map((m) => (
        <li key={m.id} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-white/[.04]">
          <span className="relative">
            <Avatar name={m.name} hue={m.hue} size={36} />
            <span className={clsx("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-surface", m.online ? "bg-ok" : "bg-white/25")} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
              {m.name}
              {m.id === me.id && <span className="text-xs font-normal text-muted">({p.you})</span>}
              {m.id === party.hostId && <Crown size={14} className="shrink-0 text-coin" aria-label={p.host} />}
              {m.id === party.remoteId && <Gamepad2 size={14} className="shrink-0 text-accent" aria-label={p.remote} />}
              {party.readyCheck && m.ready && <Check size={14} className="shrink-0 text-ok" />}
            </p>
            <p className="text-xs text-muted">{m.online ? p.online : p.away}</p>
          </div>
          {me.control && m.id !== party.remoteId && (
            <button type="button" onClick={() => act({ op: "remote", userId: m.id })} className={btn("glass", "sm")} title={p.giveRemote}>
              <Gamepad2 size={15} /> <span className="hidden sm:inline">{p.giveRemote}</span>
            </button>
          )}
          {me.host && m.id !== me.id && (
            <button type="button" onClick={() => act({ op: "kick", userId: m.id })} aria-label={p.kick} title={p.kick} className="rounded-full p-2 text-muted hover:bg-red-500/10 hover:text-red-300">
              <UserX size={16} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- food

export function FoodTab({ state, send, clock }: { state: State; send: Send; clock: () => number }) {
  const { t, locale } = useI18n();
  const p = t.party;
  const f = p.food;
  const toast = useToast();
  const [item, setItem] = useState("");
  const [price, setPrice] = useState("");
  const [now, setNow] = useState(() => clock());
  useEffect(() => {
    const id = window.setInterval(() => setNow(clock()), 15_000);
    return () => clearInterval(id);
  }, [clock]);
  const food = state.party.food;
  const orderer = state.members.find((m) => m.id === food.byId);
  const iAmOrdering = food.byId === state.me.id;
  const money = (c: number) => formatMoney(c / 100, "EUR", locale);
  const etaMin = food.etaAt ? Math.max(0, Math.round((food.etaAt - now) / 60_000)) : null;
  const err = (r: { ok: boolean; error?: string }) => !r.ok && toast((p.errors as Record<string, string>)[r.error ?? ""] ?? t.common.error, "error");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item.trim()) return;
    const cents = price.trim() ? Math.round(Number(price.replace(",", ".")) * 100) : null;
    const r = await send({ op: "foodAdd", item: item.trim(), priceCents: cents !== null && Number.isFinite(cents) ? cents : null });
    err(r);
    if (r.ok) {
      setItem("");
      setPrice("");
    }
  };

  const listText = () =>
    state.food.map((x) => `${x.qty > 1 ? `${x.qty}× ` : ""}${x.item} — ${x.name}`).join("\n");

  return (
    <div className="space-y-4 overflow-y-auto p-4">
      <div>
        <h3 className="font-display text-base font-semibold">{f.title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">{f.sub}</p>
      </div>

      {food.arrivedAt ? (
        <div className="rounded-2xl bg-ok/15 p-3 text-sm font-semibold text-ok ring-1 ring-ok/30">🍕 {f.arrived}</div>
      ) : food.etaAt ? (
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-coin/10 p-3 text-sm ring-1 ring-coin/30">
          <span className="flex items-center gap-2 font-semibold text-coin">
            <Bike size={16} /> {etaMin ? fmt(f.arriving, { n: etaMin }) : f.arrivingSoon}
          </span>
          <button type="button" onClick={() => send({ op: "foodArrived" }).then(err)} className={btn("coin", "sm")}>
            {f.arrivedBtn}
          </button>
        </div>
      ) : null}

      <form onSubmit={add} className="grid grid-cols-[minmax(0,1fr)_88px_44px] gap-2">
        <input value={item} onChange={(e) => setItem(e.target.value)} maxLength={80} placeholder={f.item} aria-label={f.item} className={inputCls + " h-11"} />
        <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder={f.price} aria-label={f.price} className={inputCls + " h-11 px-3"} />
        <button aria-label={f.add} className={btn("primary", "icon", "h-11 w-11 shrink-0 rounded-2xl")}>
          <Plus size={18} />
        </button>
      </form>

      {state.food.length === 0 ? (
        <p className="rounded-2xl bg-white/[.04] p-4 text-center text-sm text-muted">{f.empty}</p>
      ) : (
        <>
          <ul className="divide-y divide-line rounded-2xl bg-white/[.03] ring-1 ring-line">
            {state.food.map((x) => (
              <li key={x.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{x.qty > 1 && `${x.qty}× `}{x.item}</span> <span className="text-muted">· {x.name}</span>
                </span>
                <span className="shrink-0 text-muted">{x.priceCents !== null ? money(x.priceCents * x.qty) : f.noPrice}</span>
                {(x.userId === state.me.id || state.me.host) && (
                  <button type="button" aria-label={t.common.delete} onClick={() => send({ op: "foodRemove", id: x.id }).then(err)} className="rounded-full p-1 text-muted hover:text-red-300">
                    <X size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {state.split.total > 0 && (
            <div className="rounded-2xl bg-white/[.03] p-3 ring-1 ring-line">
              <p className="flex justify-between text-sm font-semibold">
                <span>{f.total}</span> <span>{money(state.split.total)}</span>
              </p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">{f.perPerson}</p>
              <ul className="mt-1 space-y-0.5 text-sm">
                {Object.entries(state.split.perUser).map(([uid, cents]) => (
                  <li key={uid} className="flex justify-between">
                    <span className="text-muted">{state.members.find((m) => m.id === uid)?.name ?? "—"}</span>
                    <span>{money(cents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="space-y-2">
        {food.service && orderer ? (
          <p className="text-sm">{fmt(f.orders, { name: orderer.name, service: FOOD_SERVICES[food.service].name })}</p>
        ) : (
          <p className="text-sm font-semibold">{f.who}</p>
        )}
        {(!food.service || iAmOrdering || state.me.host) && (
          <>
            <p className="text-xs text-muted">{f.iOrder}</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(FOOD_SERVICES) as FoodService[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send({ op: "foodClaim", service: s }).then(err)}
                  className={clsx("rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition", food.service === s && iAmOrdering ? "text-black" : "bg-white/[.05] ring-line hover:bg-white/[.1]")}
                  style={food.service === s && iAmOrdering ? { background: FOOD_SERVICES[s].color } : undefined}
                >
                  {FOOD_SERVICES[s].name}
                </button>
              ))}
            </div>
          </>
        )}
        {iAmOrdering && food.service && (
          <div className="space-y-2 rounded-2xl bg-white/[.03] p-3 ring-1 ring-line">
            <div className="flex flex-wrap gap-2">
              <a href={FOOD_SERVICES[food.service].url} target="_blank" rel="noopener noreferrer" className={btn("primary", "sm")}>
                <ExternalLink size={15} /> {fmt(f.openApp, { service: FOOD_SERVICES[food.service].name })}
              </a>
              {state.food.length > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(listText());
                      toast(f.listCopied);
                    } catch {
                      toast(t.common.error, "error");
                    }
                  }}
                  className={btn("glass", "sm")}
                >
                  <ClipboardCopy size={15} /> {f.copyList}
                </button>
              )}
            </div>
            <p className="text-xs text-muted">{f.eta}</p>
            <div className="flex flex-wrap gap-1.5">
              {[15, 25, 35, 45, 60].map((n) => (
                <button key={n} type="button" onClick={() => send({ op: "foodEta", minutes: n }).then(err)} className="rounded-full bg-white/[.06] px-3 py-1 text-xs font-semibold hover:bg-white/[.12]">
                  {fmt(f.etaMin, { n })}
                </button>
              ))}
            </div>
          </div>
        )}
        {(iAmOrdering || state.me.host) && (food.service || state.food.length > 0) && (
          <button type="button" onClick={() => send({ op: "foodReset" }).then(err)} className="flex items-center gap-1.5 text-xs text-muted hover:text-text">
            <Trash2 size={13} /> {f.reset}
          </button>
        )}
      </div>
      <p className="text-[11px] leading-relaxed text-muted">{f.note}</p>
    </div>
  );
}

// ---------------------------------------------------------------- poll

export function VoteTab({ state, send }: { state: State; send: Send }) {
  const { t } = useI18n();
  const v = t.party.vote;
  const toast = useToast();
  const poll = state.party.poll;
  const [question, setQuestion] = useState(v.suggest);
  const [options, setOptions] = useState(["", ""]);
  const err = (r: { ok: boolean; error?: string }) => !r.ok && toast((t.party.errors as Record<string, string>)[r.error ?? ""] ?? t.common.error, "error");

  if (poll) {
    const total = poll.counts.reduce((a, b) => a + b, 0);
    return (
      <div className="space-y-3 overflow-y-auto p-4">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold">
          <BarChart3 size={18} className="text-accent" /> {poll.question}
        </h3>
        {poll.options.map((o, i) => {
          const pct = total ? Math.round((poll.counts[i] / total) * 100) : 0;
          return (
            <button
              key={i}
              type="button"
              onClick={() => send({ op: "vote", option: i }).then(err)}
              className={clsx("relative w-full overflow-hidden rounded-2xl px-4 py-3 text-left text-sm ring-1 transition", poll.mine === i ? "ring-accent" : "ring-line hover:ring-white/25")}
            >
              <span className="absolute inset-y-0 left-0 bg-accent/20 transition-[width] duration-500" style={{ width: `${pct}%` }} />
              <span className="relative flex justify-between gap-2">
                <span className="font-medium">{o}</span>
                <span className="text-muted">{fmt(v.votes, { n: poll.counts[i] })}</span>
              </span>
            </button>
          );
        })}
        {state.me.control && (
          <button type="button" onClick={() => send({ op: "closePoll" }).then(err)} className={btn("glass", "sm")}>
            <Check size={15} /> {v.close}
          </button>
        )}
      </div>
    );
  }
  return (
    <form
      className="space-y-3 overflow-y-auto p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await send({ op: "poll", question, options: options.filter((o) => o.trim()) });
        err(r);
        if (r.ok) setOptions(["", ""]);
      }}
    >
      <p className="text-sm text-muted">{v.none}</p>
      <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={120} aria-label={v.question} className={inputCls + " h-11"} />
      {options.map((o, i) => (
        <input
          key={i}
          value={o}
          maxLength={60}
          onChange={(e) => setOptions((x) => x.map((y, j) => (j === i ? e.target.value : y)))}
          placeholder={fmt(v.option, { n: i + 1 })}
          aria-label={fmt(v.option, { n: i + 1 })}
          className={inputCls + " h-11"}
        />
      ))}
      <div className="flex flex-wrap gap-2">
        {options.length < PARTY_POLL_OPTIONS_MAX && (
          <button type="button" onClick={() => setOptions((x) => [...x, ""])} className={btn("glass", "sm")}>
            <Plus size={15} /> {v.addOption}
          </button>
        )}
        <button className={btn("primary", "sm")}>{v.create}</button>
      </div>
    </form>
  );
}
