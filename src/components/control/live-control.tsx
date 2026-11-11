"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AlertOctagon, ArrowDown, ArrowUp, Flame, GripVertical, Maximize, Megaphone, Minimize, Play, Radio, SkipForward, Trash2, Volume2, VolumeX, Zap } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { useToast } from "@/components/ui/toast";
import { btn, inputCls } from "@/components/ui/button";
import { Stage } from "@/components/tv/tv-stage";
import { Uploader } from "@/components/studio/uploader";
import { DynamicMascotPlayer } from "@/components/mascot/dynamic-mascot-player";
import { EMOTIONS, parseScriptToEmotionalTimeline, TONES, type Emotion, type Tone } from "@/lib/mascot";
import { LENS } from "@/components/mascot/mascot-figure";
import type { TvChannelDTO, TvNowDTO } from "@/lib/tv-types";
import {
  addMascotClipAction,
  alertAction,
  bountyBoostAction,
  deleteMascotClipAction,
  forceNowAction,
  injectAction,
  panicAction,
  playNextAction,
  reorderAction,
  stopAlertAction,
} from "@/app/actions/live-control";

type QueueItem = { id: string; startsAt: number; durationSec: number; kind: string; title: string; publicNow: boolean; masterNow: boolean; buffered: boolean };
type LiveData = {
  serverNow: number;
  delaySec: number;
  monitors: { public: TvNowDTO; master: TvNowDTO };
  queue: QueueItem[];
  alerts: { id: string; text: string; until: number; all: boolean }[];
  buffer: { zone: string; boosted: boolean; fill24: number } | null;
};
type PoolItem = { type: "CLIP" | "EPISODE"; id: string; title: string; sub: string; durationSec: number };

function hhmmss(ms: number) {
  const d = new Date(ms);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
}

export function LiveControl({
  channel,
  channelId,
  pool,
  bank,
  tts,
}: {
  channel: TvChannelDTO;
  channelId: string;
  pool: PoolItem[];
  bank: { id: string; emotion: string; durationMs: number }[];
  tts: boolean;
}) {
  const { t } = useI18n();
  const c = t.v3.control;
  const toast = useToast();
  const router = useRouter();
  const [data, setData] = useState<LiveData | null>(null);
  const [order, setOrder] = useState<QueueItem[] | null>(null);
  const [pending, start] = useTransition();
  const skew = useRef(0);
  const clock = useCallback(() => Date.now() + skew.current, []);
  const masterClock = useCallback(() => Date.now() + skew.current + (data?.delaySec ?? 120) * 1000, [data?.delaySec]);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/live/" + channel.slug, { cache: "no-store" });
    if (!res.ok) return;
    const d = (await res.json()) as LiveData;
    skew.current = d.serverNow - Date.now();
    setData(d);
  }, [channel.slug]);

  useEffect(() => {
    const first = window.setTimeout(load, 0);
    const id = window.setInterval(() => document.visibilityState === "visible" && void load(), 5000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast(okMsg, "ok");
        await load();
        router.refresh();
      } else toast(c.errors[r.error ?? "unknown"] ?? t.common.error, "error");
    });

  // Up-next queue: drag-and-drop (or arrows) reorders the upcoming, not-yet-public slots.
  const queue = order ?? data?.queue ?? [];
  const movable = (q: QueueItem) => q.startsAt > (data?.serverNow ?? Infinity);
  const dragId = useRef<string | null>(null);
  const move = (from: number, to: number) => {
    const list = [...queue];
    if (to < 0 || to >= list.length || !movable(list[from]) || !movable(list[to])) return;
    const [x] = list.splice(from, 1);
    list.splice(to, 0, x);
    setOrder(list);
  };
  const saveOrder = () => {
    const ids = queue.filter(movable).map((q) => q.id);
    act(async () => {
      const r = await reorderAction(channelId, ids);
      if (r.ok) setOrder(null);
      return r;
    }, c.orderSaved);
  };
  const panic = (q: QueueItem) => {
    if (!window.confirm(fmt(c.panicConfirm, { title: q.title }))) return;
    act(() => panicAction(q.id), c.panicDone);
  };

  return (
    <div className="space-y-8">
      {/* Two monitors */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Monitor title={fmt(c.master, { s: data?.delaySec ?? 120 })} tone="master" now={data?.monitors.master} clock={masterClock} channel={channel} onPanic={data ? () => { const q = data.queue.find((x) => x.masterNow); if (q) panic(q); } : undefined} panicLabel={c.panic} />
        <Monitor title={c.public} tone="public" now={data?.monitors.public} clock={clock} channel={channel} onPanic={data ? () => { const q = data.queue.find((x) => x.publicNow); if (q) panic(q); } : undefined} panicLabel={c.panic} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Queue */}
        <section className="min-w-0 rounded-3xl bg-surface p-4 ring-1 ring-line md:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold">{c.queue}</h2>
              <p className="text-xs text-muted">{c.queueHint}</p>
            </div>
            {order && (
              <button type="button" disabled={pending} onClick={saveOrder} className={btn("primary", "sm")}>
                {c.saveOrder}
              </button>
            )}
          </div>
          <ol className="max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
            {queue.map((q, i) => {
              const canMove = movable(q);
              return (
                <li
                  key={q.id}
                  draggable={canMove}
                  onDragStart={() => (dragId.current = q.id)}
                  onDragOver={(e) => canMove && e.preventDefault()}
                  onDrop={() => {
                    const from = queue.findIndex((x) => x.id === dragId.current);
                    if (from >= 0) move(from, i);
                    dragId.current = null;
                  }}
                  className={clsx(
                    "flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm ring-1",
                    q.publicNow ? "bg-[#ff3b3b]/12 ring-[#ff3b3b]/40" : q.buffered || q.masterNow ? "bg-coin/10 ring-coin/30" : "bg-white/[.03] ring-line",
                    canMove && "cursor-grab active:cursor-grabbing",
                  )}
                >
                  <GripVertical size={15} className={clsx("shrink-0", canMove ? "text-muted" : "text-transparent")} />
                  <span className="w-[66px] shrink-0 font-mono text-xs tabular-nums text-muted">{hhmmss(q.startsAt)}</span>
                  <span className="w-14 shrink-0 rounded bg-white/8 px-1.5 py-0.5 text-center text-[10px] font-bold uppercase">{q.kind}</span>
                  <span className="min-w-0 flex-1 truncate">{q.title}</span>
                  {q.publicNow && <span className="shrink-0 rounded-full bg-[#ff3b3b] px-2 py-0.5 text-[10px] font-black uppercase text-white">{c.onAir}</span>}
                  {!q.publicNow && (q.buffered || q.masterNow) && <span className="shrink-0 rounded-full bg-coin px-2 py-0.5 text-[10px] font-black uppercase text-black">{c.inBuffer}</span>}
                  <span className="shrink-0 font-mono text-xs text-muted">{q.durationSec}s</span>
                  {canMove && (
                    <>
                      <button type="button" onClick={() => move(i, i - 1)} aria-label="up" className="rounded p-1 text-muted hover:bg-white/10">
                        <ArrowUp size={13} />
                      </button>
                      <button type="button" onClick={() => move(i, i + 1)} aria-label="down" className="rounded p-1 text-muted hover:bg-white/10">
                        <ArrowDown size={13} />
                      </button>
                    </>
                  )}
                  <button type="button" onClick={() => panic(q)} aria-label={c.panic} title={c.panic} className="rounded p-1 text-[#ff6b6b] hover:bg-[#ff3b3b]/20">
                    <AlertOctagon size={15} />
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="min-w-0 space-y-6">
          <PoolPicker pool={pool} onNext={(it) => act(() => playNextAction(channelId, it), c.inserted)} onNow={(it) => act(() => forceNowAction(channelId, it), c.inserted)} />

          <section className="rounded-3xl bg-surface p-4 ring-1 ring-line md:p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Flame size={18} className="text-[#ff6b6b]" /> {c.bounty}
            </h2>
            {data?.buffer?.boosted && <p className="mt-1 text-sm font-semibold text-[#ff8a8a]">🔥 {c.bountyActive}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {[6, 24].map((h) => (
                <button key={h} type="button" disabled={pending} onClick={() => act(() => bountyBoostAction(channelId, h), c.bountyActive)} className={btn("glass", "sm")}>
                  {fmt(c.bountyOn, { h })}
                </button>
              ))}
              {data?.buffer?.boosted && (
                <button type="button" disabled={pending} onClick={() => act(() => bountyBoostAction(channelId, null), c.bountyOff)} className={btn("ghost", "sm")}>
                  {c.bountyOff}
                </button>
              )}
            </div>
          </section>

          <AlertForm channelId={channelId} alerts={data?.alerts ?? []} onDone={load} />
        </div>
      </div>

      <Prompter channelId={channelId} tts={tts} />
      <ClipBank bank={bank} />
    </div>
  );
}

function Monitor({ title, tone, now, clock, channel, onPanic, panicLabel }: { title: string; tone: "master" | "public"; now?: TvNowDTO; clock: () => number; channel: TvChannelDTO; onPanic?: () => void; panicLabel: string }) {
  const { t } = useI18n();
  const noop = useCallback(() => {}, []);
  const [time, setTime] = useState("");
  const [sound, setSound] = useState(false);
  const [fs, setFs] = useState(false);
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    const on = () => setFs(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFs = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void box.current?.requestFullscreen?.().catch(() => {});
  };
  useEffect(() => {
    const id = window.setInterval(() => setTime(hhmmss(clock())), 1000);
    return () => clearInterval(id);
  }, [clock]);
  return (
    <section ref={box} className={clsx("flex flex-col overflow-hidden bg-black ring-2", fs ? "rounded-none" : "rounded-3xl", tone === "master" ? "ring-coin/60" : "ring-[#ff3b3b]/60")}>
      <div className={clsx("flex items-center justify-between gap-2 px-4 py-2 text-sm font-bold", tone === "master" ? "bg-coin text-black" : "bg-[#ff3b3b] text-white")}>
        <span className="flex items-center gap-2">
          <Radio size={15} /> {title}
        </span>
        <span className="flex items-center gap-1">
          <span className="mr-1 font-mono tabular-nums">{time}</span>
          <button type="button" onClick={() => setSound((x) => !x)} aria-label={sound ? t.tv.mute : t.tv.unmute} title={sound ? t.tv.mute : t.tv.unmute} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-black/15">
            {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button type="button" onClick={toggleFs} aria-label={fs ? t.tv.exitFullscreen : t.tv.fullscreen} title={fs ? t.tv.exitFullscreen : t.tv.fullscreen} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-black/15">
            {fs ? <Minimize size={15} /> : <Maximize size={15} />}
          </button>
        </span>
      </div>
      <div className={clsx("relative overflow-hidden bg-black", fs ? "flex-1" : "aspect-video")}>
        {/* The full-size broadcast picture, scaled down like a studio monitor. */}
        <div className="absolute left-0 top-0 h-[200%] w-[200%] origin-top-left scale-50">
        {now ? (
          <Stage
            key={now.slot.id}
            slot={now.slot}
            channel={channel}
            clock={clock}
            muted={!sound}
            volume={1}
            speak={sound}
            kids={false}
            onBlocked={noop}
            onOrder={noop}
            onLike={noop}
            loggedIn={false}
            onQuizAnswered={noop}
            shoutouts={[]}
            onGame={noop}
          />
        ) : null}
        </div>
        <div className="absolute inset-x-0 bottom-0 z-[30] flex items-center justify-between gap-2 bg-black/75 px-3 py-2 text-xs">
          <span className="min-w-0 truncate font-semibold">
            {now?.slot.kind} · {now?.slot.title || now?.slot.text?.slice(0, 60)}
          </span>
          {onPanic && (
            <button type="button" onClick={onPanic} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#ff3b3b] px-2.5 py-1.5 font-black uppercase text-white shadow-[0_0_20px_rgba(255,59,59,.6)] hover:brightness-110">
              🚨 {panicLabel}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function PoolPicker({ pool, onNext, onNow }: { pool: PoolItem[]; onNext: (it: { type: string; id: string }) => void; onNow: (it: { type: string; id: string }) => void }) {
  const { t } = useI18n();
  const c = t.v3.control;
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? pool.filter((p) => (p.title + " " + p.sub).toLowerCase().includes(s)) : pool).slice(0, 40);
  }, [pool, q]);
  return (
    <section className="rounded-3xl bg-surface p-4 ring-1 ring-line md:p-5">
      <h2 className="font-display text-lg font-bold">{c.pool}</h2>
      <p className="text-xs text-muted">{c.poolHint}</p>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={c.search} aria-label={c.search} className={inputCls + " mt-3 h-10"} />
      <ul className="mt-3 max-h-[260px] space-y-1 overflow-y-auto pr-1">
        {list.map((p) => (
          <li key={p.type + p.id} className="flex items-center gap-2 rounded-xl bg-white/[.03] px-2.5 py-1.5 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{p.title}</span>
              <span className="block truncate text-xs text-muted">
                {p.sub} · {p.durationSec}s
              </span>
            </span>
            <button type="button" onClick={() => onNext(p)} title={c.playNext} className={btn("glass", "sm", "h-8 px-2.5")}>
              <SkipForward size={14} /> <span className="max-sm:hidden">{c.playNext}</span>
            </button>
            <button type="button" onClick={() => onNow(p)} title={c.forceNow} className="flex h-8 items-center gap-1 rounded-full bg-accent px-2.5 text-xs font-bold text-white">
              <Zap size={14} /> <span className="max-sm:hidden">{c.forceNow}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AlertForm({ channelId, alerts, onDone }: { channelId: string; alerts: LiveData["alerts"]; onDone: () => void }) {
  const { t } = useI18n();
  const c = t.v3.control;
  const toast = useToast();
  const [text, setText] = useState("");
  const [all, setAll] = useState(false);
  const [minutes, setMinutes] = useState(10);
  const [pending, start] = useTransition();
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await alertAction(all ? null : channelId, text, minutes);
      if (r.ok) {
        setText("");
        onDone();
      } else toast(c.errors[r.error] ?? t.common.error, "error");
    });
  };
  return (
    <section className="rounded-3xl bg-surface p-4 ring-1 ring-line md:p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <Megaphone size={18} className="text-coin" /> {c.alerts}
      </h2>
      <form onSubmit={send} className="mt-3 space-y-2.5">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={160} placeholder={c.alertPh} aria-label={c.alertPh} className={inputCls} />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> {c.alertAll}
          </label>
          <label className="flex items-center gap-2">
            {c.alertMinutes}
            <input type="number" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 1)} className={inputCls + " h-9 w-20"} />
          </label>
          <button disabled={pending || !text.trim()} className={btn("primary", "sm", "ml-auto")}>
            {c.alertSend}
          </button>
        </div>
      </form>
      {alerts.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {alerts.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-xl bg-[#c8102e]/15 px-3 py-2 text-sm ring-1 ring-[#c8102e]/30">
              <span className="min-w-0 flex-1 truncate">
                {a.all && "🌐 "}
                {a.text}
              </span>
              <button type="button" onClick={() => start(async () => (await stopAlertAction(a.id), onDone()))} className="rounded p-1 text-white/70 hover:bg-white/10" aria-label={c.alertStop} title={c.alertStop}>
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Prompter({ channelId, tts }: { channelId: string; tts: boolean }) {
  const { t, locale } = useI18n();
  const c = t.v3.control;
  const toast = useToast();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"PIP" | "BREAKING">("PIP");
  const [tone, setTone] = useState<Tone>("AUTO");
  const [all, setAll] = useState(false);
  const [preview, setPreview] = useState(0);
  const [voice, setVoice] = useState(false);
  const [pending, start] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);
  const timeline = useMemo(() => parseScriptToEmotionalTimeline(text, tone), [text, tone]);
  /** Inserts an [emotion] tag at the cursor (like ElevenLabs audio tags). */
  const insertTag = (tag: string) => {
    const el = area.current;
    const at = el ? el.selectionStart : text.length;
    const next = text.slice(0, at) + (at && !/\s$/.test(text.slice(0, at)) ? " " : "") + tag + " " + text.slice(at);
    setText(next.slice(0, 600));
    requestAnimationFrame(() => {
      el?.focus();
      const pos = Math.min(600, at + tag.length + 2);
      el?.setSelectionRange(pos, pos);
    });
  };
  const send = () =>
    start(async () => {
      const r = await injectAction({ channelId: all ? null : channelId, text, mode, tone });
      if (r.ok) {
        toast(c.sent, "ok");
        setText("");
      } else toast(c.errors[r.error] ?? t.common.error, "error");
    });
  return (
    <section className="rounded-3xl bg-[radial-gradient(80%_120%_at_100%_0%,rgba(255,46,99,.18),transparent_60%),var(--surface)] p-4 ring-1 ring-line md:p-6">
      <h2 className="font-display text-xl font-bold">{c.prompter}</h2>
      <div className="mt-4 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <div>
            <div className="mb-1.5 text-sm font-semibold">{c.tagsTitle}</div>
            <div className="flex flex-wrap gap-1.5">
              {c.tagList.map((tag) => (
                <button key={tag} type="button" onClick={() => insertTag(tag)} className="rounded-lg bg-white/[.07] px-2 py-1 font-mono text-xs text-text/90 ring-1 ring-white/10 hover:bg-white/[.14]">
                  {tag}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">{c.tagsHint}</p>
          </div>
          <textarea ref={area} value={text} onChange={(e) => setText(e.target.value)} maxLength={600} rows={5} placeholder={c.prompterPh} aria-label={c.prompterPh} className={inputCls + " h-auto py-2.5 text-[15px]"} />
          <div className="grid gap-3 sm:grid-cols-2">
            <fieldset>
              <legend className="mb-1.5 text-sm text-muted">{c.mode}</legend>
              {(["PIP", "BREAKING"] as const).map((m) => (
                <label key={m} className="flex items-center gap-2 py-0.5 text-sm">
                  <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} /> {c.modes[m]}
                </label>
              ))}
            </fieldset>
            <label className="block">
              <span className="mb-1.5 block text-sm text-muted">{c.tone}</span>
              <select value={tone} onChange={(e) => setTone(e.target.value as Tone)} className={inputCls}>
                {TONES.map((x) => (
                  <option key={x} value={x}>
                    {c.tones[x]}
                  </option>
                ))}
              </select>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> {c.alertAll}
              </label>
            </label>
          </div>
          {timeline.length > 0 && (
            <div>
              <div className="mb-1.5 text-sm text-muted">{c.timeline}</div>
              <div className="flex flex-wrap gap-1.5">
                {timeline
                  .filter((x) => x.phrase)
                  .map((x, i) => (
                    <span key={i} className="max-w-full truncate rounded-lg px-2 py-1 text-xs font-medium text-black" style={{ background: LENS[x.emotion] }} title={x.emotion}>
                      {c.tones[x.emotion as Tone] ?? x.emotion}: {x.phrase}
                    </span>
                  ))}
              </div>
            </div>
          )}
          {!tts && <p className="text-xs text-muted">{c.ttsHint}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" disabled={!text.trim()} onClick={() => setPreview((p) => p + 1)} className={btn("glass", "md")}>
              <Play size={16} /> {c.preview}
            </button>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} /> {c.previewVoice}
            </label>
            <button type="button" disabled={pending || !text.trim()} onClick={send} className="ml-auto flex h-12 items-center gap-2 rounded-2xl bg-[#ff3b3b] px-6 font-display text-base font-black uppercase tracking-wide text-white shadow-[0_0_30px_rgba(255,59,59,.55)] hover:brightness-110 disabled:opacity-40">
              <span className="h-3 w-3 animate-pulse rounded-full bg-white" /> {c.onAirBtn}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-center rounded-2xl bg-black/60 p-3 ring-1 ring-white/10">
          {preview > 0 ? (
            <DynamicMascotPlayer key={preview} timeline={timeline} speak={voice} locale={locale} variant="stage" className="w-full" />
          ) : (
            <DynamicMascotPlayer variant="badge" emotion="IDLE" locale={locale} captions={false} className="h-64 w-52" />
          )}
        </div>
      </div>
    </section>
  );
}

function ClipBank({ bank }: { bank: { id: string; emotion: string; durationMs: number }[] }) {
  const { t } = useI18n();
  const c = t.v3.control;
  const toast = useToast();
  const router = useRouter();
  const [emotion, setEmotion] = useState<Emotion>("NEUTRAL_TALK");
  const [key, setKey] = useState(0);
  const [, start] = useTransition();
  return (
    <section className="rounded-3xl bg-surface p-4 ring-1 ring-line md:p-6">
      <h2 className="font-display text-xl font-bold">{c.bank}</h2>
      <p className="mt-1 text-sm text-muted">{c.bankHint}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {EMOTIONS.map((e) => {
          const items = bank.filter((b) => b.emotion === e);
          return (
            <div key={e} className="rounded-2xl bg-white/[.03] p-3 ring-1 ring-line">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: LENS[e] }} /> {c.emotions[e]}
                <span className="ml-auto text-muted">{items.length}</span>
              </div>
              <ul className="mt-2 space-y-1">
                {items.map((b) => (
                  <li key={b.id} className="flex items-center gap-2 text-xs">
                    <video src={"/api/mascot/file/" + b.id} muted loop autoPlay playsInline className="h-10 w-8 rounded bg-black object-cover" />
                    <span className="flex-1 font-mono text-muted">{(b.durationMs / 1000).toFixed(1)}s</span>
                    <button type="button" onClick={() => start(async () => (await deleteMascotClipAction(b.id), router.refresh()))} className="rounded p-1 text-muted hover:text-text" aria-label="delete">
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[220px_1fr] sm:items-start">
        <select value={emotion} onChange={(e) => setEmotion(e.target.value as Emotion)} className={inputCls} aria-label={c.bankUpload}>
          {EMOTIONS.map((e) => (
            <option key={e} value={e}>
              {c.emotions[e]}
            </option>
          ))}
        </select>
        <Uploader
          key={key}
          kind="video"
          accept="video/mp4,video/webm"
          label={c.bankUpload}
          onDone={(ref) =>
            start(async () => {
              const r = await addMascotClipAction(emotion, ref);
              toast(r.ok ? t.v3.studio.planner.saved : (c.errors[r.ok ? "" : r.error] ?? t.common.error), r.ok ? "ok" : "error");
              setKey((k) => k + 1);
              router.refresh();
            })
          }
        />
      </div>
    </section>
  );
}
