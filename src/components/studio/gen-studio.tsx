"use client";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowLeft, ArrowRight, Clapperboard, Dice5, Film, Info, Layers, Lightbulb, ListPlus, Loader2, Plus, RectangleHorizontal, RectangleVertical,
  RefreshCw, Scissors, ShieldAlert, Sparkles, Trash2, Wand2, X, Zap,
} from "lucide-react";
import { btn, inputCls, labelCls, textareaCls } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { costFor, GEN_DURATIONS, GEN_STYLES, MAX_SHOTS, PROMPT_MAX, type GenStyle } from "@/lib/generation";
import { assembleClipsAction, deleteGenerationAction, listGenerationsAction, startGenerationAction, type GenJobDTO } from "@/app/actions/generate";

type Orientation = "VERTICAL" | "HORIZONTAL";
export type GenSeries = { id: string; title: string; orientation: Orientation; episodes: { id: string; number: number; title: string; durationSec: number }[] };

const STYLE_HUE: Record<GenStyle, number> = { cinematic: 20, anime: 320, noir: 230, dreamy: 270, neon: 190, realistic: 40 };
const MAX_TIMELINE = 11; // + the existing episode video = STITCH_MAX_CLIPS
const isOpen = (j: GenJobDTO) => j.status === "QUEUED" || j.status === "RUNNING";
const videoSrc = (id: string) => `/api/studio/generations/${id}/video`;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function GenStudio({ initialJobs, initialCredits, series, provider = "mock" }: { initialJobs: GenJobDTO[]; initialCredits: number; series: GenSeries[]; provider?: "mock" | "ltx" }) {
  const { t } = useI18n();
  const toast = useToast();
  const [jobs, setJobs] = useState(initialJobs);
  const [credits, setCredits] = useState(initialCredits);
  const [selectedId, setSelectedId] = useState<string | null>(initialJobs[0]?.id ?? null);
  const [timeline, setTimeline] = useState<string[]>([]);
  const [pending, start] = useTransition();

  const [mode, setMode] = useState<"single" | "story">("single");
  const [prompt, setPrompt] = useState("");
  const [shots, setShots] = useState<string[]>(["", ""]);
  const [style, setStyle] = useState<GenStyle>("cinematic");
  const [orientation, setOrientation] = useState<Orientation>("VERTICAL");
  const [duration, setDuration] = useState<(typeof GEN_DURATIONS)[number]>(10);
  const [seed, setSeed] = useState("");

  const filledShots = shots.map((s) => s.trim()).filter(Boolean);
  const clipCount = mode === "single" ? 1 : filledShots.length;
  const cost = costFor(duration) * Math.max(1, clipCount);
  const canGenerate = mode === "single" ? !!prompt.trim() : filledShots.length > 0;
  const selected = jobs.find((j) => j.id === selectedId) ?? null;
  const anyOpen = jobs.some(isOpen);

  const refresh = useCallback(async () => {
    const r = await listGenerationsAction();
    setJobs(r.jobs);
    setCredits(r.credits);
  }, []);

  useEffect(() => {
    if (!anyOpen) return;
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, [anyOpen, refresh]);

  const addToTimeline = (ids: string[]) =>
    setTimeline((tl) => {
      const next = [...tl, ...ids.filter((id) => !tl.includes(id))];
      if (next.length > MAX_TIMELINE) toast(fmt(t.gen.tl.max, { n: MAX_TIMELINE }), "error");
      return next.slice(0, MAX_TIMELINE);
    });

  const generate = () =>
    start(async () => {
      const r = await startGenerationAction({
        prompt,
        shots: mode === "story" ? filledShots : undefined,
        style,
        orientation,
        durationSec: duration,
        seed: seed ? Number(seed) : undefined,
      });
      if (!r.ok) return toast(t.gen.errors[r.error], "error");
      setJobs((js) => [...r.jobs, ...js]);
      setCredits(r.credits);
      setSelectedId(r.jobs[r.jobs.length - 1].id);
      // Storyboard shots go straight to the editing table, in shot order.
      if (mode === "story") {
        addToTimeline([...r.jobs].reverse().map((j) => j.id));
        toast(fmt(t.gen.story.queued, { n: r.jobs.length }));
      }
    });

  const remix = (j: GenJobDTO) => {
    setMode("single");
    setPrompt(j.prompt);
    setStyle((GEN_STYLES as readonly string[]).includes(j.style) ? (j.style as GenStyle) : "cinematic");
    setOrientation(j.orientation);
    setDuration(j.durationSec === 10 ? 10 : 5);
    setSeed(String(j.seed));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = (j: GenJobDTO) =>
    start(async () => {
      await deleteGenerationAction(j.id);
      setJobs((js) => js.filter((x) => x.id !== j.id));
      setTimeline((tl) => tl.filter((id) => id !== j.id));
      if (selectedId === j.id) setSelectedId(null);
    });

  return (
    <div className="space-y-6">
      <ol className="grid gap-2 sm:grid-cols-3">
        {t.gen.steps.map((s, i) => (
          <li key={s.t} className="flex gap-3 rounded-2xl bg-surface p-3.5 ring-1 ring-line">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-vip/15 font-display text-sm font-bold text-vip">{i + 1}</span>
            <span>
              <span className="block text-sm font-semibold">{s.t}</span>
              <span className="block text-xs leading-snug text-muted">{s.d}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-8">
        {/* Composer */}
        <section className="space-y-5 rounded-3xl bg-surface p-4 ring-1 ring-line md:p-5 lg:sticky lg:top-[calc(var(--header-h)+16px)] lg:self-start">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2/60 px-4 py-3 ring-1 ring-line">
            <div>
              <p className="text-xs text-muted">{t.gen.credits}</p>
              <p className="flex items-center gap-1.5 font-display text-2xl font-bold tabular-nums">
                <Zap size={18} className="text-vip" /> {credits}
              </p>
            </div>
            <p className="max-w-[230px] text-right text-[11px] leading-snug text-muted">{t.gen.creditsHint}</p>
          </div>

          <div role="tablist" aria-label={t.gen.modeLabel} className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1 ring-1 ring-line">
            {(["single", "story"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={clsx("flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition", mode === m ? "bg-surface text-text shadow ring-1 ring-line" : "text-muted hover:text-text")}
              >
                {m === "single" ? <Sparkles size={15} /> : <Layers size={15} />}
                {m === "single" ? t.gen.modeSingle : t.gen.modeStory}
              </button>
            ))}
          </div>
          <p className="-mt-3 text-xs leading-relaxed text-muted">{mode === "single" ? t.gen.modeSingleHint : t.gen.story.hint}</p>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label htmlFor="gen-prompt" className={labelCls + " mb-0"}>{mode === "single" ? t.gen.prompt : t.gen.story.scene}</label>
              <span className="text-[11px] tabular-nums text-muted">{prompt.length}/{PROMPT_MAX}</span>
            </div>
            <textarea
              id="gen-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && canGenerate) generate();
              }}
              maxLength={PROMPT_MAX}
              rows={mode === "single" ? 5 : 3}
              placeholder={mode === "single" ? t.gen.promptPh : t.gen.story.scenePh}
              className={textareaCls + (mode === "single" ? " min-h-32" : "")}
            />
            {mode === "single" && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 text-xs text-muted"><Lightbulb size={13} /> {t.gen.examples}:</span>
                {t.gen.exampleList.map((ex, i) => (
                  <button key={i} type="button" onClick={() => setPrompt(ex)} className="max-w-full truncate rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted ring-1 ring-line transition hover:text-text hover:ring-white/20" title={ex}>
                    {ex.split(/[,:]/)[0]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {mode === "story" && (
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <p className={labelCls + " mb-0"}>{t.gen.story.shots}</p>
                <button type="button" onClick={() => setShots(t.gen.story.example)} className="text-xs text-muted underline-offset-2 hover:text-text hover:underline">
                  {t.gen.story.fillExample}
                </button>
              </div>
              <div className="space-y-2">
                {shots.map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-3 w-5 shrink-0 text-right font-display text-sm font-semibold tabular-nums text-muted">{i + 1}</span>
                    <textarea
                      aria-label={fmt(t.gen.story.shotN, { n: i + 1 })}
                      value={s}
                      onChange={(e) => setShots((xs) => xs.map((x, k) => (k === i ? e.target.value : x)))}
                      maxLength={400}
                      rows={2}
                      placeholder={t.gen.story.shotPh[i % t.gen.story.shotPh.length]}
                      className={textareaCls + " min-h-0 py-2.5 text-sm"}
                    />
                    <button
                      type="button"
                      aria-label={t.common.delete}
                      disabled={shots.length <= 1}
                      onClick={() => setShots((xs) => xs.filter((_, k) => k !== i))}
                      className={btn("ghost", "icon", "mt-1.5 h-9 w-9 shrink-0 disabled:opacity-30")}
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
              {shots.length < MAX_SHOTS && (
                <button type="button" onClick={() => setShots((xs) => [...xs, ""])} className={btn("glass", "sm", "mt-2")}>
                  <Plus size={15} /> {t.gen.story.addShot}
                </button>
              )}
            </div>
          )}

          <div>
            <p className={labelCls}>{t.gen.style}</p>
            <div className="grid grid-cols-3 gap-2">
              {GEN_STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={style === s}
                  onClick={() => setStyle(s)}
                  className={clsx("relative h-12 overflow-hidden rounded-2xl text-sm font-semibold ring-1 transition", style === s ? "ring-2 ring-accent" : "ring-line hover:ring-white/20")}
                  style={{ background: `linear-gradient(135deg, hsl(${STYLE_HUE[s]} 70% 30%), hsl(${(STYLE_HUE[s] + 40) % 360} 60% 14%))` }}
                >
                  <span className="relative">{t.gen.styles[s]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={labelCls}>{t.gen.format}</p>
              <div className="grid gap-2">
                {(["VERTICAL", "HORIZONTAL"] as const).map((o) => (
                  <button key={o} type="button" aria-pressed={orientation === o} onClick={() => setOrientation(o)} className={chip(orientation === o)}>
                    {o === "VERTICAL" ? <RectangleVertical size={16} /> : <RectangleHorizontal size={16} />}
                    {o === "VERTICAL" ? t.gen.vertical : t.gen.horizontal}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className={labelCls}>{mode === "single" ? t.gen.duration : t.gen.story.durationEach}</p>
              <div className="grid gap-2">
                {GEN_DURATIONS.map((d) => (
                  <button key={d} type="button" aria-pressed={duration === d} onClick={() => setDuration(d)} className={chip(duration === d)}>
                    {fmt(t.gen.seconds, { n: d })}
                    <span className="ml-auto inline-flex items-center gap-0.5 text-xs text-vip"><Zap size={12} />{costFor(d)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="gen-seed" className={labelCls}>{t.gen.seed}</label>
            <div className="flex gap-2">
              <input id="gen-seed" inputMode="numeric" value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, "").slice(0, 9))} placeholder={t.gen.seedRandom} className={inputCls} />
              <button type="button" aria-label={t.gen.seedRandom} onClick={() => setSeed(String(Math.floor(Math.random() * 1e9)))} className={btn("glass", "icon", "h-12 w-12 shrink-0 rounded-2xl")}>
                <Dice5 size={18} />
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted">{t.gen.seedHint}</p>
          </div>

          {mode === "story" && clipCount > 0 && (
            <p className="rounded-2xl bg-surface-2/60 px-4 py-2.5 text-sm text-muted ring-1 ring-line">
              {fmt(t.gen.story.total, { n: clipCount, d: duration, s: clock(clipCount * duration) })}
            </p>
          )}

          <button onClick={generate} disabled={pending || !canGenerate || credits < cost} className={btn("vip", "lg", "w-full")}>
            {pending ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
            {mode === "single" ? t.gen.generate : fmt(t.gen.story.generate, { n: clipCount })}
            <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-black/25 px-2 py-0.5 text-xs"><Zap size={12} />{cost}</span>
          </button>
          {credits < cost && <p className="-mt-2 text-center text-xs text-red-300">{t.gen.errors.no_credits}</p>}

          <p className="flex gap-2 text-[11px] leading-relaxed text-muted">
            <ShieldAlert size={14} className="mt-0.5 shrink-0" /> {t.gen.rules}
          </p>
        </section>

        {/* Stage + editing table + history */}
        <section className="min-w-0 space-y-6">
          {selected ? (
            <Stage job={selected} inTimeline={timeline.includes(selected.id)} onAdd={() => addToTimeline([selected.id])} onRemix={() => remix(selected)} />
          ) : (
            <EmptyState icon={<Clapperboard size={24} />} title={t.gen.empty} text={t.gen.emptyText} />
          )}

          <Timeline jobs={jobs} ids={timeline} setIds={setTimeline} series={series} onSelect={setSelectedId} />

          <p className="flex gap-2 rounded-2xl bg-surface-2/40 px-4 py-3 text-xs text-muted ring-1 ring-line">
            <Info size={14} className="mt-0.5 shrink-0" /> {provider === "ltx" ? t.gen.ltxNote : t.gen.mockNote}
          </p>

          {jobs.length > 0 && (
            <div>
              <h2 className="font-display text-lg font-semibold">{t.gen.history}</h2>
              <p className="mb-3 mt-0.5 text-xs text-muted">{t.gen.historyHint}</p>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 xl:grid-cols-5">
                {jobs.map((j) => (
                  <HistoryCard
                    key={j.id}
                    job={j}
                    active={j.id === selectedId}
                    position={timeline.indexOf(j.id)}
                    onSelect={() => setSelectedId(j.id)}
                    onAdd={() => addToTimeline([j.id])}
                    onRemove={() => remove(j)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function chip(active: boolean) {
  return clsx(
    "flex h-11 items-center gap-2 rounded-2xl px-3 text-sm font-medium ring-1 transition",
    active ? "bg-accent/15 text-text ring-accent/70" : "bg-surface-2 text-muted ring-line hover:text-text hover:ring-white/20",
  );
}

function Stage({ job, inTimeline, onAdd, onRemix }: { job: GenJobDTO; inTimeline: boolean; onAdd: () => void; onRemix: () => void }) {
  const { t } = useI18n();
  const vertical = job.orientation === "VERTICAL";
  const hue = STYLE_HUE[job.style as GenStyle] ?? 300;
  return (
    <div className="animate-fade-up overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
      <div className="flex justify-center bg-black/40 p-3 md:p-5">
        <div className={clsx("relative overflow-hidden rounded-2xl bg-surface-2 shadow-2xl", vertical ? "aspect-[9/16] w-full max-w-[260px]" : "aspect-video w-full max-w-[600px]")}>
          {job.status === "DONE" ? (
            <video key={job.id} src={videoSrc(job.id)} autoPlay loop muted playsInline controls className="h-full w-full object-cover" />
          ) : job.status === "FAILED" ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <span className="font-semibold text-red-300">{t.gen.failed}</span>
              <span className="text-sm text-white/75">{/quota|TIMEOUT/i.test(job.error ?? "") ? t.gen.quotaError : t.gen.failedText}</span>
            </div>
          ) : (
            <Generating job={job} hue={hue} />
          )}
        </div>
      </div>
      <div className="space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <StatusPill job={job} />
          <span className="rounded-full bg-surface-2 px-2.5 py-1 ring-1 ring-line">{t.gen.styles[job.style as GenStyle] ?? job.style}</span>
          <span className="rounded-full bg-surface-2 px-2.5 py-1 ring-1 ring-line">{vertical ? "9:16" : "16:9"} · {fmt(t.gen.seconds, { n: job.durationSec })}</span>
          <span className="rounded-full bg-surface-2 px-2.5 py-1 font-mono ring-1 ring-line">seed {job.seed}</span>
        </div>
        <p className="text-[15px] leading-relaxed">{job.prompt}</p>
        <div className="flex flex-wrap gap-2">
          {job.status !== "FAILED" && (
            <button onClick={onAdd} disabled={inTimeline} className={btn("primary", "sm")}>
              <ListPlus size={15} /> {inTimeline ? t.gen.tl.inTable : t.gen.tl.add}
            </button>
          )}
          <button onClick={onRemix} className={btn("glass", "sm")}><RefreshCw size={15} /> {t.gen.remix}</button>
        </div>
      </div>
    </div>
  );
}

/** The editing table: chosen clips in order → one video → a new episode or the end of an existing one. */
function Timeline({ jobs, ids, setIds, series, onSelect }: { jobs: GenJobDTO[]; ids: string[]; setIds: React.Dispatch<React.SetStateAction<string[]>>; series: GenSeries[]; onSelect: (id: string) => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [seriesId, setSeriesId] = useState(series[0]?.id ?? "");
  const [mode, setMode] = useState<"new" | "append">("new");
  const [episodeId, setEpisodeId] = useState("");
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  const [done, setDone] = useState<{ seriesId: string; number: number } | null>(null);

  const clips = useMemo(() => ids.map((id) => jobs.find((j) => j.id === id)).filter((j): j is GenJobDTO => !!j), [ids, jobs]);
  const s = series.find((x) => x.id === seriesId);
  const target = s?.episodes.find((e) => e.id === episodeId) ?? s?.episodes[s.episodes.length - 1];
  const waiting = clips.filter(isOpen).length;
  const failed = clips.filter((c) => c.status === "FAILED").length;
  const seconds = clips.reduce((a, c) => a + c.durationSec, 0);
  const mismatch = !!s && clips.some((c) => c.orientation !== s.orientation);

  const move = (i: number, d: -1 | 1) =>
    setIds((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const next = [...xs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const publish = () =>
    start(async () => {
      const r = await assembleClipsAction({ jobIds: clips.map((c) => c.id), seriesId, mode, episodeId: mode === "append" ? target?.id : undefined, title });
      if (!r.ok) return toast(t.gen.tl.errors[r.error], "error");
      toast(mode === "new" ? fmt(t.gen.tl.createdNew, { n: r.number }) : fmt(t.gen.tl.appended, { n: r.number, d: clock(r.durationSec) }));
      setDone({ seriesId, number: r.number });
      setIds([]);
      setTitle("");
    });

  return (
    <div className="rounded-3xl bg-surface p-4 ring-1 ring-line md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Scissors size={18} className="text-accent" /> {t.gen.tl.title}</h2>
        {clips.length > 0 && <span className="text-sm tabular-nums text-muted">{fmt(t.gen.tl.summary, { n: clips.length, d: clock(seconds) })}</span>}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">{t.gen.tl.hint}</p>

      {done && clips.length === 0 && (
        <p className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-ok/10 px-4 py-3 text-sm text-ok">
          {fmt(t.gen.tl.doneText, { n: done.number })}
          <Link href={`/studio/series/${done.seriesId}`} className="font-semibold underline underline-offset-2">{t.gen.tl.openSeries}</Link>
        </p>
      )}

      {clips.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-muted">{t.gen.tl.empty}</div>
      ) : (
        <>
          <ol className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {clips.map((c, i) => (
              <li key={c.id} className="w-24 shrink-0">
                <button onClick={() => onSelect(c.id)} className="relative block aspect-[9/16] w-full overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line" aria-label={c.prompt}>
                  {c.status === "DONE" ? (
                    <video src={videoSrc(c.id) + "#t=0.5"} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                  ) : (
                    <span className={clsx("flex h-full items-center justify-center text-xs", c.status === "FAILED" ? "text-red-300" : "text-muted")}>
                      {c.status === "FAILED" ? t.gen.failed : <Loader2 size={16} className="animate-spin" />}
                    </span>
                  )}
                  <span className="glass absolute left-1 top-1 rounded-full px-1.5 text-[11px] font-bold tabular-nums">{i + 1}</span>
                  <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] tabular-nums">{clock(c.durationSec)}</span>
                </button>
                <div className="mt-1 flex justify-between">
                  <button aria-label={t.gen.tl.left} disabled={i === 0} onClick={() => move(i, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-white/5 hover:text-text disabled:opacity-25"><ArrowLeft size={14} /></button>
                  <button aria-label={t.gen.tl.remove} onClick={() => setIds((xs) => xs.filter((x) => x !== c.id))} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-white/5 hover:text-red-300"><X size={14} /></button>
                  <button aria-label={t.gen.tl.right} disabled={i === clips.length - 1} onClick={() => move(i, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-white/5 hover:text-text disabled:opacity-25"><ArrowRight size={14} /></button>
                </div>
              </li>
            ))}
          </ol>

          {series.length === 0 ? (
            <Link href="/studio/series/new" className={btn("glass", "md", "mt-3")}><Film size={18} /> {t.gen.noSeries}</Link>
          ) : (
            <div className="mt-3 space-y-3 rounded-2xl bg-surface-2/50 p-3 ring-1 ring-line md:p-4">
              <div>
                <label htmlFor="tl-series" className={labelCls}>{t.gen.chooseSeries}</label>
                <select id="tl-series" value={seriesId} onChange={(e) => { setSeriesId(e.target.value); setEpisodeId(""); }} className={inputCls}>
                  {series.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                </select>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <ModeCard active={mode === "new"} onClick={() => setMode("new")} title={fmt(t.gen.tl.modeNew, { n: (s?.episodes.at(-1)?.number ?? 0) + 1 })} text={t.gen.tl.modeNewHint} />
                <ModeCard
                  active={mode === "append"}
                  disabled={!s?.episodes.length}
                  onClick={() => setMode("append")}
                  title={t.gen.tl.modeAppend}
                  text={s?.episodes.length ? t.gen.tl.modeAppendHint : t.gen.tl.noEpisodes}
                />
              </div>
              {mode === "append" && s && s.episodes.length > 0 && (
                <div>
                  <label htmlFor="tl-ep" className={labelCls}>{t.gen.tl.whichEpisode}</label>
                  <select id="tl-ep" value={target?.id ?? ""} onChange={(e) => setEpisodeId(e.target.value)} className={inputCls}>
                    {s.episodes.map((e) => (
                      <option key={e.id} value={e.id}>
                        {fmt(t.gen.tl.episodeOption, { n: e.number, d: clock(e.durationSec) })}{e.title ? ` · ${e.title}` : ""}
                      </option>
                    ))}
                  </select>
                  {target && <p className="mt-1 text-xs text-muted">{fmt(t.gen.tl.appendResult, { from: clock(target.durationSec), to: clock(target.durationSec + seconds) })}</p>}
                </div>
              )}
              <div>
                <label htmlFor="tl-title" className={labelCls}>{mode === "new" ? t.gen.episodeTitle : t.gen.tl.newTitle}</label>
                <input id="tl-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={mode === "new" ? t.gen.tl.titlePh : t.gen.tl.keepTitle} className={inputCls} />
              </div>
              {mismatch && <p className="text-xs text-coin">{t.gen.tl.mismatch}</p>}
              {failed > 0 && <p className="text-xs text-red-300">{t.gen.tl.hasFailed}</p>}
              <button onClick={publish} disabled={pending || waiting > 0 || failed > 0 || !seriesId || (mode === "append" && !target)} className={btn("primary", "lg", "w-full")}>
                {pending ? <Loader2 size={18} className="animate-spin" /> : <Film size={18} />}
                {pending ? t.gen.tl.assembling : waiting > 0 ? fmt(t.gen.tl.waiting, { n: waiting }) : mode === "new" ? t.gen.tl.publishNew : t.gen.tl.publishAppend}
              </button>
              <p className="text-[11px] leading-relaxed text-muted">{t.gen.tl.afterNote}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ModeCard({ active, disabled, onClick, title, text }: { active: boolean; disabled?: boolean; onClick: () => void; title: string; text: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={clsx("rounded-2xl p-3 text-left ring-1 transition disabled:opacity-40", active ? "bg-accent/12 ring-2 ring-accent/70" : "bg-surface ring-line hover:ring-white/20")}
    >
      <span className="block text-sm font-semibold">{title}</span>
      <span className="mt-0.5 block text-xs leading-snug text-muted">{text}</span>
    </button>
  );
}

function Generating({ job, hue }: { job: GenJobDTO; hue: number }) {
  const { t } = useI18n();
  const pct = Math.round(job.progress * 100);
  const stages = t.gen.stages;
  const stage = job.status === "QUEUED" ? t.gen.queued : stages[Math.min(stages.length - 1, Math.floor(job.progress * stages.length))];
  return (
    <div className="absolute inset-0">
      <div className="absolute -left-1/4 -top-1/4 h-3/4 w-3/4 rounded-full opacity-70 blur-3xl motion-safe:animate-[float-glow_6s_ease-in-out_infinite]" style={{ background: `hsl(${hue} 85% 55%)` }} />
      <div className="absolute -bottom-1/4 -right-1/4 h-3/4 w-3/4 rounded-full opacity-60 blur-3xl motion-safe:animate-[float-glow_7s_ease-in-out_infinite_reverse]" style={{ background: `hsl(${(hue + 60) % 360} 85% 50%)` }} />
      <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,.08)_50%,transparent_70%)] bg-[length:200%_100%] motion-safe:animate-shimmer" />
      <div className="absolute inset-0 bg-black/30" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Sparkles size={28} className="text-white motion-safe:animate-pulse" />
        <p className="font-display text-4xl font-bold tabular-nums">{pct}%</p>
        <p className="text-sm text-white/80" aria-live="polite">{stage}</p>
      </div>
      <div className="absolute inset-x-4 bottom-4 h-1.5 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-white transition-[width] duration-1000 ease-linear" style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </div>
  );
}

function StatusPill({ job }: { job: GenJobDTO }) {
  const { t } = useI18n();
  if (job.status === "DONE") return <span className="rounded-full bg-ok/15 px-2.5 py-1 font-semibold text-ok">{t.gen.done}</span>;
  if (job.status === "FAILED") return <span className="rounded-full bg-red-500/15 px-2.5 py-1 font-semibold text-red-300">{t.gen.failed}</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 font-semibold text-accent">
      <Loader2 size={12} className="animate-spin" />
      {job.status === "QUEUED" ? t.gen.queued : fmt(t.gen.running, { p: Math.round(job.progress * 100) })}
    </span>
  );
}

function HistoryCard({ job, active, position, onSelect, onAdd, onRemove }: { job: GenJobDTO; active: boolean; position: number; onSelect: () => void; onAdd: () => void; onRemove: () => void }) {
  const { t } = useI18n();
  const hue = STYLE_HUE[job.style as GenStyle] ?? 300;
  const pct = Math.round(job.progress * 100);
  const bg = useMemo(() => `linear-gradient(135deg, hsl(${hue} 60% 28%), hsl(${(hue + 60) % 360} 60% 14%))`, [hue]);
  return (
    <div className={clsx("group relative overflow-hidden rounded-2xl ring-1 transition", active ? "ring-2 ring-accent" : "ring-line hover:ring-white/25")}>
      <button onClick={onSelect} aria-label={job.prompt} className="block aspect-[9/16] w-full" style={{ background: bg }}>
        {job.status === "DONE" ? (
          <video
            src={videoSrc(job.id) + "#t=0.5"}
            muted
            loop
            playsInline
            preload="metadata"
            onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
            onMouseLeave={(e) => e.currentTarget.pause()}
            className="h-full w-full object-cover"
          />
        ) : job.status === "FAILED" ? (
          <span className="flex h-full items-center justify-center text-xs font-semibold text-red-300">{t.gen.failed}</span>
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-1">
            <Loader2 size={18} className="animate-spin text-white/80" />
            <span className="font-display text-sm font-semibold tabular-nums">{job.status === "QUEUED" ? "…" : `${pct}%`}</span>
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2 pt-6 text-left text-[11px] leading-tight text-white/85">
          <span className="line-clamp-2">{job.prompt}</span>
        </span>
        {job.orientation === "HORIZONTAL" && <span className="glass absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[10px]">16:9</span>}
      </button>
      {position >= 0 ? (
        <span className="absolute bottom-10 right-1.5 flex h-7 min-w-7 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold tabular-nums" title={t.gen.tl.inTable}>
          {position + 1}
        </span>
      ) : (
        job.status !== "FAILED" && (
          <button onClick={onAdd} aria-label={t.gen.tl.add} title={t.gen.tl.add} className="absolute bottom-10 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white text-black shadow-lg transition hover:scale-105">
            <Plus size={15} />
          </button>
        )
      )}
      {!isOpen(job) && (
        <button onClick={onRemove} aria-label={t.common.delete} className="glass absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}
