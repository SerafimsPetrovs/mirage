"use client";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Clapperboard, Dice5, Film, Info, Lightbulb, ListPlus, Loader2, RectangleHorizontal, RectangleVertical, RefreshCw, ShieldAlert, Sparkles, Trash2, Wand2, Zap } from "lucide-react";
import { btn, inputCls, labelCls, textareaCls } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { costFor, GEN_DURATIONS, GEN_STYLES, PROMPT_MAX, type GenStyle } from "@/lib/generation";
import { addGenerationToSeriesAction, deleteGenerationAction, listGenerationsAction, startGenerationAction, type GenJobDTO } from "@/app/actions/generate";

type Orientation = "VERTICAL" | "HORIZONTAL";
const STYLE_HUE: Record<GenStyle, number> = { cinematic: 20, anime: 320, noir: 230, dreamy: 270, neon: 190, realistic: 40 };
const isOpen = (j: GenJobDTO) => j.status === "QUEUED" || j.status === "RUNNING";
const videoSrc = (id: string) => `/api/studio/generations/${id}/video`;

export function GenStudio({ initialJobs, initialCredits, series }: { initialJobs: GenJobDTO[]; initialCredits: number; series: { id: string; title: string }[] }) {
  const { t } = useI18n();
  const toast = useToast();
  const [jobs, setJobs] = useState(initialJobs);
  const [credits, setCredits] = useState(initialCredits);
  const [selectedId, setSelectedId] = useState<string | null>(initialJobs[0]?.id ?? null);
  const [pending, start] = useTransition();

  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<GenStyle>("cinematic");
  const [orientation, setOrientation] = useState<Orientation>("VERTICAL");
  const [duration, setDuration] = useState<(typeof GEN_DURATIONS)[number]>(5);
  const [seed, setSeed] = useState("");

  const cost = costFor(duration);
  const selected = jobs.find((j) => j.id === selectedId) ?? null;
  const anyOpen = jobs.some(isOpen);

  const refresh = useCallback(async () => {
    const r = await listGenerationsAction();
    setJobs(r.jobs);
    setCredits(r.credits);
  }, []);

  useEffect(() => {
    if (!anyOpen) return;
    const id = setInterval(refresh, 1200);
    return () => clearInterval(id);
  }, [anyOpen, refresh]);

  const generate = () =>
    start(async () => {
      const r = await startGenerationAction({ prompt, style, orientation, durationSec: duration, seed: seed ? Number(seed) : undefined });
      if (!r.ok) return toast(t.gen.errors[r.error], "error");
      setJobs((js) => [r.job, ...js]);
      setCredits(r.credits);
      setSelectedId(r.job.id);
    });

  const remix = (j: GenJobDTO) => {
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
      if (selectedId === j.id) setSelectedId(null);
    });

  return (
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
          <p className="max-w-[220px] text-right text-[11px] leading-snug text-muted">{t.gen.creditsHint}</p>
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="gen-prompt" className={labelCls + " mb-0"}>{t.gen.prompt}</label>
            <span className="text-[11px] tabular-nums text-muted">{prompt.length}/{PROMPT_MAX}</span>
          </div>
          <textarea
            id="gen-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && prompt.trim()) generate();
            }}
            maxLength={PROMPT_MAX}
            rows={5}
            placeholder={t.gen.promptPh}
            className={textareaCls + " min-h-32"}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 text-xs text-muted"><Lightbulb size={13} /> {t.gen.examples}:</span>
            {t.gen.exampleList.map((ex, i) => (
              <button key={i} type="button" onClick={() => setPrompt(ex)} className="max-w-full truncate rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted ring-1 ring-line transition hover:text-text hover:ring-white/20" title={ex}>
                {ex.split(/[,:]/)[0]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className={labelCls}>{t.gen.style}</p>
          <div className="grid grid-cols-3 gap-2">
            {GEN_STYLES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={style === s}
                onClick={() => setStyle(s)}
                className={clsx("relative h-14 overflow-hidden rounded-2xl text-sm font-semibold ring-1 transition", style === s ? "ring-2 ring-accent" : "ring-line hover:ring-white/20")}
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
            <p className={labelCls}>{t.gen.duration}</p>
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
        </div>

        <button onClick={generate} disabled={pending || !prompt.trim() || credits < cost} className={btn("vip", "lg", "w-full")}>
          {pending ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
          {t.gen.generate}
          <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-black/25 px-2 py-0.5 text-xs"><Zap size={12} />{cost}</span>
        </button>
        {credits < cost && <p className="-mt-2 text-center text-xs text-red-300">{t.gen.errors.no_credits}</p>}

        <p className="flex gap-2 text-[11px] leading-relaxed text-muted">
          <ShieldAlert size={14} className="mt-0.5 shrink-0" /> {t.gen.rules}
        </p>
      </section>

      {/* Stage + history */}
      <section className="min-w-0 space-y-6">
        {selected ? <Stage job={selected} series={series} onRemix={() => remix(selected)} /> : (
          <EmptyState icon={<Clapperboard size={24} />} title={t.gen.empty} text={t.gen.emptyText} />
        )}

        <p className="flex gap-2 rounded-2xl bg-surface-2/40 px-4 py-3 text-xs text-muted ring-1 ring-line">
          <Info size={14} className="mt-0.5 shrink-0" /> {t.gen.mockNote}
        </p>

        {jobs.length > 0 && (
          <div>
            <h2 className="mb-3 font-display text-lg font-semibold">{t.gen.history}</h2>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 xl:grid-cols-5">
              {jobs.map((j) => (
                <HistoryCard key={j.id} job={j} active={j.id === selectedId} onSelect={() => setSelectedId(j.id)} onRemove={() => remove(j)} />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function chip(active: boolean) {
  return clsx(
    "flex h-11 items-center gap-2 rounded-2xl px-3 text-sm font-medium ring-1 transition",
    active ? "bg-accent/15 text-text ring-accent/70" : "bg-surface-2 text-muted ring-line hover:text-text hover:ring-white/20",
  );
}

function Stage({ job, series, onRemix }: { job: GenJobDTO; series: { id: string; title: string }[]; onRemix: () => void }) {
  const { t } = useI18n();
  const vertical = job.orientation === "VERTICAL";
  const hue = STYLE_HUE[job.style as GenStyle] ?? 300;
  return (
    <div className="animate-fade-up overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
      <div className="flex justify-center bg-black/40 p-3 md:p-5">
        <div className={clsx("relative overflow-hidden rounded-2xl bg-surface-2 shadow-2xl", vertical ? "aspect-[9/16] w-full max-w-[300px]" : "aspect-video w-full max-w-[640px]")}>
          {job.status === "DONE" ? (
            <video key={job.id} src={videoSrc(job.id)} autoPlay loop muted playsInline controls className="h-full w-full object-cover" />
          ) : job.status === "FAILED" ? (
            <div className="flex h-full items-center justify-center text-red-300">{t.gen.failed}</div>
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
          <button onClick={onRemix} className={btn("glass", "sm")}><RefreshCw size={15} /> {t.gen.remix}</button>
        </div>
        {job.status === "DONE" && <AddToSeries job={job} series={series} />}
      </div>
    </div>
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

function AddToSeries({ job, series }: { job: GenJobDTO; series: { id: string; title: string }[] }) {
  const { t } = useI18n();
  const toast = useToast();
  const [seriesId, setSeriesId] = useState(series[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  if (series.length === 0)
    return (
      <Link href="/studio/series/new" className={btn("glass", "md")}>
        <Film size={18} /> {t.gen.noSeries}
      </Link>
    );
  return (
    <div className="grid gap-2 rounded-2xl bg-surface-2/50 p-3 ring-1 ring-line sm:grid-cols-[1fr_1fr_auto]">
      <select aria-label={t.gen.chooseSeries} value={seriesId} onChange={(e) => setSeriesId(e.target.value)} className={inputCls}>
        {series.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
      </select>
      <input aria-label={t.gen.episodeTitle} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t.gen.episodeTitle} className={inputCls} />
      <button
        disabled={pending || !seriesId}
        onClick={() =>
          start(async () => {
            const r = await addGenerationToSeriesAction(job.id, seriesId, title);
            if (r.ok) {
              toast(t.gen.added);
              setTitle("");
            } else toast(t.common.error, "error");
          })
        }
        className={btn("primary", "md", "h-12")}
      >
        <ListPlus size={18} /> {t.gen.add}
      </button>
    </div>
  );
}

function HistoryCard({ job, active, onSelect, onRemove }: { job: GenJobDTO; active: boolean; onSelect: () => void; onRemove: () => void }) {
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
      {!isOpen(job) && (
        <button onClick={onRemove} aria-label={t.common.delete} className="glass absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}
