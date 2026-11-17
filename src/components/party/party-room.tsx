"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, BarChart3, CheckCircle2, Clapperboard, Gamepad2, LogOut, MessageCircle, Palette, Power, Search, Tv, UserPlus, Users, UtensilsCrossed, Volume2, VolumeX } from "lucide-react";
import { btn, inputCls } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { ShareSheet } from "@/components/ui/share-sheet";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { PARTY_THEMES, type PartyTheme } from "@/lib/party-rules";
import type { PartyOp, PartyStateDTO } from "@/lib/party";
import { useParty } from "./use-party";
import { FoodProgress } from "./food-progress";
import { PartyEpisodePlayer, PartyTvPlayer } from "./party-players";
import { ChatTab, FoodTab, PeopleTab, ReactionBar, ReactionsLayer, useSysText, VoteTab } from "./party-panels";

export type ChannelOption = { slug: string; number: number; name: string; hue: number };

const THEME_BG: Record<PartyTheme, string> = {
  CINEMA: "radial-gradient(120% 70% at 50% -10%, rgba(255,46,99,.16), transparent 60%), #07070b",
  NEON: "radial-gradient(80% 60% at 0% 0%, rgba(124,92,255,.28), transparent 60%), radial-gradient(70% 60% at 100% 10%, rgba(62,230,200,.18), transparent 60%), #07070b",
  COZY: "radial-gradient(100% 70% at 50% 0%, rgba(255,181,71,.18), transparent 65%), #0b0806",
  SPACE: "radial-gradient(1px 1px at 20% 30%, #fff8, transparent), radial-gradient(1px 1px at 70% 20%, #fff6, transparent), radial-gradient(1px 1px at 40% 70%, #fff5, transparent), radial-gradient(90% 60% at 50% 0%, rgba(80,120,255,.2), transparent 60%), #05060d",
};

type Tab = "chat" | "people" | "food" | "vote";

export function PartyRoom({ code, initial, channels }: { code: string; initial: PartyStateDTO; channels: ChannelOption[] }) {
  const { t } = useI18n();
  const p = t.party;
  const toast = useToast();
  const router = useRouter();
  const { state, events, clock, send, gone } = useParty(code, initial);
  const { party, me } = state;
  const [tab, setTab] = useState<Tab>("chat");
  const [muted, setMuted] = useState(true);
  const [volume] = useState(1);
  const [share, setShare] = useState(false);
  const [picker, setPicker] = useState(false);
  const [openedAt] = useState(() => initial.serverNow);
  const time = useRef(0);
  const sysText = useSysText();

  const err = useCallback(
    (r: { ok: boolean; error?: string }) => {
      if (!r.ok) toast((p.errors as Record<string, string>)[r.error ?? ""] ?? t.common.error, "error");
      return r.ok;
    },
    [p.errors, t.common.error, toast],
  );
  const act = useCallback((op: PartyOp) => send(op).then(err), [send, err]);

  // big moments get a toast too (food arrived, someone passed you the remote…)
  const toasted = useRef(new Set<string>());
  useEffect(() => {
    for (const e of events) {
      if (e.kind !== "SYSTEM" || e.at <= openedAt || toasted.current.has(e.id)) continue;
      toasted.current.add(e.id);
      if (/"k":"(foodArrived|go|readyCheck|remote|pollResult)"/.test(e.body) && e.userId !== me.id) toast(sysText(e));
    }
  }, [events, openedAt, me.id, toast, sysText]);

  if (gone) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="font-display text-2xl font-bold">{(p.errors as Record<string, string>)[gone] ?? p.errors.ENDED}</p>
        <Link href="/party" className={btn("primary", "md")}>{p.hubTitle}</Link>
      </div>
    );
  }

  const remoteName = state.members.find((m) => m.id === party.remoteId)?.name ?? "";
  const online = state.members.filter((m) => m.online);
  const readyN = online.filter((m) => m.ready).length;
  const me_ = state.members.find((m) => m.id === me.id);
  const vertical = party.mode === "EPISODE" && state.episode?.vertical;
  const url = typeof window !== "undefined" ? `${window.location.origin}/party/${party.code}` : `/party/${party.code}`;
  const food = party.food;
  const etaMin = food.etaAt && !food.arrivedAt ? Math.max(0, Math.round((food.etaAt - clock()) / 60_000)) : null;
  const timeNow = () => {
    if (party.mode === "EPISODE") return time.current;
    const d = new Date(clock()); // live TV: the local time of day
    return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "chat", label: p.tabs.chat, icon: <MessageCircle size={16} /> },
    { id: "people", label: p.tabs.people, icon: <Users size={16} />, badge: online.length },
    { id: "food", label: p.tabs.food, icon: <UtensilsCrossed size={16} />, badge: state.food.length || undefined },
    { id: "vote", label: p.tabs.vote, icon: <BarChart3 size={16} />, badge: party.poll ? 1 : undefined },
  ];

  return (
    <div className="min-h-dvh pt-[var(--header-h)]" style={{ background: THEME_BG[party.theme] ?? THEME_BG.CINEMA }}>
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-6">
        <Link href="/party" aria-label={p.hubTitle} className="rounded-full p-2 text-muted hover:bg-white/10 hover:text-text">
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-bold md:text-xl">{party.title || p.hubTitle}</h1>
          <p className="text-xs text-muted">
            {p.code}: <span className="font-mono font-semibold tracking-widest text-text">{party.code}</span> · {fmt(p.members, { n: online.length })}
          </p>
        </div>
        <div className="hidden -space-x-2 sm:flex">
          {online.slice(0, 6).map((m) => (
            <Avatar key={m.id} name={m.name} hue={m.hue} size={32} className="ring-2 ring-bg" />
          ))}
        </div>
        <button type="button" onClick={() => setShare(true)} className={btn("primary", "sm")}>
          <UserPlus size={16} /> {p.invite}
        </button>
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <Palette size={16} />
          <span className="sr-only">{p.theme}</span>
          <select value={party.theme} onChange={(e) => act({ op: "theme", theme: e.target.value })} className="h-9 rounded-xl bg-white/[.06] px-2 text-sm text-text ring-1 ring-line">
            {PARTY_THEMES.map((x) => (
              <option key={x} value={x}>{p.themes[x]}</option>
            ))}
          </select>
        </label>
        {me.host ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(p.endConfirm)) act({ op: "end" }).then((ok) => ok && router.push("/party"));
            }}
            className={btn("ghost", "sm", "text-red-300")}
          >
            <Power size={16} /> <span className="hidden md:inline">{p.end}</span>
          </button>
        ) : (
          <button type="button" onClick={() => act({ op: "leave" }).then((ok) => ok && router.push("/party"))} className={btn("ghost", "sm")}>
            <LogOut size={16} /> <span className="hidden md:inline">{p.leave}</span>
          </button>
        )}
      </div>

      <div className="grid gap-4 px-4 pb-6 md:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-3">
          {/* player */}
          <div className={clsx("relative overflow-hidden rounded-3xl bg-black shadow-2xl ring-1 ring-white/10", vertical ? "mx-auto aspect-[9/16] max-h-[78dvh]" : "mx-auto aspect-video w-full max-w-[calc((100dvh-var(--header-h)-210px)*16/9)]")}>
            {party.mode === "EPISODE" && state.episode ? (
              <PartyEpisodePlayer
                episode={state.episode}
                playback={party.playback}
                countdownTo={party.countdownTo}
                control={me.control}
                clock={clock}
                muted={muted}
                volume={volume}
                onBlocked={() => setMuted(true)}
                onControl={(op, positionSec) => act({ op, positionSec })}
                onTime={(s) => (time.current = s)}
              />
            ) : party.channelSlug ? (
              <PartyTvPlayer slug={party.channelSlug} muted={muted} volume={volume} onBlocked={() => setMuted(true)} />
            ) : null}
            <ReactionsLayer events={events} since={openedAt} />
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? t.tv.unmute : t.tv.mute}
              className={clsx("absolute right-3 top-3 z-[16] flex items-center gap-2 rounded-full bg-black/60 px-3 py-2 text-sm font-semibold backdrop-blur", muted && "animate-pulse")}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />} {muted && t.tv.unmute}
            </button>
            {party.mode === "TV" && <span className="absolute left-3 top-3 z-[16] rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold backdrop-blur">● {p.live}</span>}
          </div>

          {/* food on its way / arrived */}
          {etaMin !== null && food.etaAt && (
            <button type="button" onClick={() => setTab("food")} className="block w-full text-left">
              <FoodProgress setAt={food.etaSetAt ?? food.etaAt - 30 * 60_000} etaAt={food.etaAt} arrivedAt={food.arrivedAt} clock={clock} compact />
            </button>
          )}

          {/* ready check */}
          {party.readyCheck && party.mode === "EPISODE" && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/[.05] px-4 py-3 ring-1 ring-line">
              <CheckCircle2 size={18} className="text-ok" />
              <span className="font-semibold">{p.readyCheck}</span>
              <span className="text-sm text-muted">{fmt(p.readyCount, { n: readyN, total: online.length })}</span>
              {!me_?.ready && (
                <button type="button" onClick={() => act({ op: "ready" })} className={btn("primary", "sm")}>
                  {p.ready}
                </button>
              )}
              {me.control && (
                <button type="button" onClick={() => act({ op: "go", positionSec: time.current })} className={btn(readyN >= online.length ? "primary" : "glass", "sm", "ml-auto")}>
                  {p.start}
                </button>
              )}
            </div>
          )}

          {/* remote + reactions */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full bg-white/[.06] px-3 py-1.5 text-sm">
              <Gamepad2 size={15} className="text-accent" /> {fmt(p.remoteAt, { name: remoteName })}
            </span>
            {me.control && (
              <>
                <label className="flex items-center gap-1.5 text-sm text-muted">
                  <Tv size={16} />
                  <span className="sr-only">{p.channel}</span>
                  <select
                    value={party.mode === "TV" ? party.channelSlug ?? "" : ""}
                    onChange={(e) => e.target.value && act({ op: "channel", slug: e.target.value })}
                    className="h-9 max-w-44 rounded-xl bg-white/[.06] px-2 text-sm text-text ring-1 ring-line"
                  >
                    {party.mode !== "TV" && <option value="">{p.switchToTv}</option>}
                    {channels.map((c) => (
                      <option key={c.slug} value={c.slug}>{c.number} · {c.name}</option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={() => setPicker(true)} className={btn("glass", "sm")} title={p.episodeHint}>
                  <Clapperboard size={15} /> {p.pickEpisode}
                </button>
                {party.mode === "EPISODE" && !party.readyCheck && (
                  <button type="button" onClick={() => act({ op: "readyCheck" })} className={btn("glass", "sm")}>
                    <CheckCircle2 size={15} /> {p.readyCheck}
                  </button>
                )}
              </>
            )}
          </div>
          <ReactionBar send={send} />
          {party.mode === "EPISODE" && state.episode && (
            <p className="text-sm text-muted">
              <Link href={`/series/${state.episode.seriesSlug}`} className="font-semibold text-text hover:underline">{state.episode.seriesTitle}</Link> · {fmt(t.tv.episode, { n: state.episode.number })}
              {state.episode.title && ` — ${state.episode.title}`}
            </p>
          )}
        </div>

        {/* side panel */}
        <aside className="flex h-[70dvh] min-h-[420px] flex-col overflow-hidden rounded-3xl bg-surface/85 ring-1 ring-line backdrop-blur-xl lg:sticky lg:top-[calc(var(--header-h)+12px)] lg:h-[calc(100dvh-var(--header-h)-90px)]">
          <div role="tablist" className="grid grid-cols-4 border-b border-line">
            {tabs.map((x) => (
              <button
                key={x.id}
                role="tab"
                aria-selected={tab === x.id}
                type="button"
                onClick={() => setTab(x.id)}
                className={clsx("relative flex flex-col items-center gap-1 py-2.5 text-xs font-semibold transition", tab === x.id ? "text-text" : "text-muted hover:text-text")}
              >
                {x.icon}
                {x.label}
                {!!x.badge && <span className="absolute right-3 top-1.5 rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">{x.badge}</span>}
                {tab === x.id && <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-accent" />}
              </button>
            ))}
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            {tab === "chat" && <ChatTab events={events} state={state} send={send} timeNow={timeNow} />}
            {tab === "people" && <PeopleTab state={state} send={send} />}
            {tab === "food" && <FoodTab state={state} send={send} clock={clock} />}
            {tab === "vote" && <VoteTab state={state} send={send} />}
          </div>
        </aside>
      </div>

      <ShareSheet open={share} onClose={() => setShare(false)} url={url} text={p.inviteText} title={party.title || p.hubTitle} />
      <EpisodePicker open={picker} onClose={() => setPicker(false)} onPick={(episodeId) => act({ op: "episode", episodeId }).then((ok) => ok && setPicker(false))} />
    </div>
  );
}

type SearchHit = { slug: string; title: string; poster: string; episodes: number };
type Ep = { id: string; number: number; title: string; ok: boolean; price: number };

/** Put on a catalog episode: find a series, pick an episode you can watch. */
function EpisodePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (episodeId: string) => void }) {
  const { t } = useI18n();
  const p = t.party;
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [series, setSeries] = useState<{ title: string; episodes: Ep[] } | null>(null);
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(async () => {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}&top=1`).then((x) => (x.ok ? x.json() : [])).catch(() => []);
      setHits(r as SearchHit[]);
    }, 250);
    return () => clearTimeout(id);
  }, [q, open]);
  const pickSeries = async (slug: string) => {
    const r = await fetch(`/api/party/episodes?slug=${encodeURIComponent(slug)}`).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    if (r) setSeries(r);
  };
  const list = useMemo(() => hits.slice(0, 8), [hits]);
  return (
    <Modal open={open} onClose={() => { setSeries(null); onClose(); }} label={p.episodeHint} className="max-w-lg">
      <h2 className="font-display text-lg font-semibold">{series ? series.title : p.episodeHint}</h2>
      {!series ? (
        <>
          <div className="relative mt-4">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={p.episodeSearch} aria-label={p.episodeSearch} className={inputCls + " pl-10"} />
          </div>
          <ul className="mt-3 max-h-[50dvh] space-y-1 overflow-y-auto">
            {list.map((h) => (
              <li key={h.slug}>
                <button type="button" onClick={() => pickSeries(h.slug)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-white/[.06]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={h.poster} alt="" className="h-14 w-10 rounded-lg object-cover" />
                  <span className="min-w-0 flex-1 truncate font-medium">{h.title}</span>
                  <span className="text-xs text-muted">{h.episodes}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <button type="button" onClick={() => setSeries(null)} className="mt-1 flex items-center gap-1 text-sm text-muted hover:text-text">
            <ArrowLeft size={14} /> {p.episodeSearch}
          </button>
          <ul className="mt-3 grid max-h-[50dvh] grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
            {series.episodes.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  disabled={!e.ok}
                  title={e.title}
                  onClick={() => onPick(e.id)}
                  className="flex aspect-square w-full flex-col items-center justify-center rounded-2xl bg-white/[.06] text-lg font-bold ring-1 ring-line transition hover:bg-white/[.12] disabled:opacity-40"
                >
                  {e.number}
                  {!e.ok && <span className="text-[10px] font-semibold text-coin">🔒 {e.price}</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
