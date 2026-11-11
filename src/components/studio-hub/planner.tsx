"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { CalendarClock, Check, ListChecks, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { useToast } from "@/components/ui/toast";
import { btn, inputCls } from "@/components/ui/button";
import { createTaskAction, deleteTaskAction, setReleaseAction, updateTaskAction } from "@/app/actions/studio-hub";

type Ep = { id: string; number: number; title: string; publishAt: number | null };
type SeriesCal = { id: string; title: string; hue: number; episodes: Ep[] };

/** `datetime-local` value in the creator's own time zone. */
function toLocalInput(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
}

// ───────────── release calendar ─────────────

export function ReleaseCalendar({ series, now }: { series: SeriesCal[]; now: number }) {
  const { t, locale } = useI18n();
  const p = t.v3.studio.planner;
  const days = useMemo(() => {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [now]);
  const releases = series.flatMap((s) => s.episodes.filter((e) => e.publishAt && e.publishAt > now).map((e) => ({ ...e, series: s })));
  const fmtDay = (d: Date) => d.toLocaleDateString(locale === "ru" ? "ru-RU" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
  const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString(locale === "ru" ? "ru-RU" : "en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <section className="space-y-5">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold">
        <CalendarClock size={20} className="text-accent" /> {p.calendar}
      </h2>
      <div>
        <div className="mb-2 text-sm font-semibold text-muted">{p.week}</div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-7 md:px-0">
          {days.map((d) => {
            const items = releases.filter((r) => new Date(r.publishAt!).toDateString() === d.toDateString()).sort((a, b) => a.publishAt! - b.publishAt!);
            return (
              <div key={d.toISOString()} className="min-h-[110px] w-[150px] shrink-0 rounded-2xl bg-surface p-2.5 ring-1 ring-line md:w-auto">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted" suppressHydrationWarning>{fmtDay(d)}</div>
                <div className="space-y-1.5">
                  {items.map((r) => (
                    <div key={r.id} className="rounded-lg px-2 py-1.5 text-xs ring-1 ring-white/10" style={{ background: "hsl(" + r.series.hue + " 70% 45% / .18)" }}>
                      <div className="font-bold tabular-nums" suppressHydrationWarning>{fmtTime(r.publishAt!)}</div>
                      <div className="truncate">
                        {r.series.title} · {r.number}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {!releases.length && <p className="mt-2 text-sm text-muted">{p.noReleases}</p>}
      </div>
      {!series.length ? (
        <p className="rounded-3xl bg-surface p-8 text-center text-muted ring-1 ring-line">{p.noSeries}</p>
      ) : (
        <div className="space-y-4">
          {series.map((s) => (
            <details key={s.id} className="group rounded-3xl bg-surface ring-1 ring-line" open={series.length === 1}>
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 font-semibold">
                <span className="h-3 w-3 rounded-full" style={{ background: "hsl(" + s.hue + " 80% 60%)" }} />
                {s.title}
                <span className="ml-auto text-sm font-normal text-muted">{s.episodes.length}</span>
              </summary>
              <ul className="divide-y divide-line border-t border-line">
                {s.episodes.map((e) => (
                  <EpisodeRelease key={e.id} ep={e} now={now} />
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function EpisodeRelease({ ep, now }: { ep: Ep; now: number }) {
  const { t } = useI18n();
  const p = t.v3.studio.planner;
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const future = !!ep.publishAt && ep.publishAt > now;
  const [value, setValue] = useState(future ? toLocalInput(ep.publishAt!) : "");
  const save = (at: string | null) =>
    start(async () => {
      const r = await setReleaseAction(ep.id, at);
      if (r.ok) {
        toast(p.saved, "ok");
        if (!at) setValue("");
        router.refresh();
      } else toast(r.error === "PAST" ? p.past : t.common.error, "error");
    });
  return (
    <li className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">
          {t.common.episode} {ep.number}
        </span>
        {ep.title && <span className="text-muted"> · {ep.title}</span>}
        {!future && <span className="ml-2 rounded-full bg-ok/15 px-2 py-0.5 text-xs font-semibold text-ok">{p.now}</span>}
      </div>
      <div className="flex items-center gap-2">
        <input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} aria-label={p.release} className={inputCls + " h-10 w-[210px] py-0 text-sm"} />
        <button type="button" disabled={pending || !value} onClick={() => save(new Date(value).toISOString())} className={btn("primary", "sm")}>
          {p.save}
        </button>
        {future && (
          <button type="button" disabled={pending} onClick={() => save(null)} className={btn("ghost", "sm")}>
            {p.clear}
          </button>
        )}
      </div>
    </li>
  );
}

// ───────────── task tracker ─────────────

type Task = { id: string; title: string; notes: string; status: string; dueAt: number | null; series: string | null; checklist: { t: string; done: boolean }[] };

export function TaskBoard({ tasks, series }: { tasks: Task[]; series: { id: string; title: string }[] }) {
  const { t } = useI18n();
  const p = t.v3.studio.planner;
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [due, setDue] = useState("");
  const [seriesId, setSeriesId] = useState("");
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await createTaskAction({
        title,
        notes,
        seriesId: seriesId || null,
        dueAt: due ? new Date(due).toISOString() : null,
        checklist: Object.values(p.checks),
      });
      if (r.ok) {
        setTitle("");
        setNotes("");
        setDue("");
        router.refresh();
      } else toast(t.common.error, "error");
    });
  };
  const cols = (["TODO", "DOING", "DONE"] as const).map((s) => ({ s, items: tasks.filter((x) => x.status === s) }));
  return (
    <section className="space-y-5">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold">
        <ListChecks size={20} className="text-[#7dffb2]" /> {p.tasks}
      </h2>
      <form onSubmit={add} className="grid gap-3 rounded-3xl bg-surface p-5 ring-1 ring-line md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">{p.taskTitle}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={p.taskTitlePh} className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">{p.taskSeries}</span>
          <select value={seriesId} onChange={(e) => setSeriesId(e.target.value)} className={inputCls}>
            <option value="">{p.none}</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">{p.taskDue}</span>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} />
        </label>
        <button disabled={pending || title.trim().length < 2} className={btn("primary", "md")}>
          <Plus size={16} /> {p.add}
        </button>
        <label className="block md:col-span-4">
          <span className="mb-1.5 block text-sm text-muted">{p.taskNotes}</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={4000} className={inputCls + " h-auto py-2"} />
        </label>
      </form>
      <div className="grid gap-4 md:grid-cols-3">
        {cols.map(({ s, items }) => (
          <div key={s} className="rounded-3xl bg-white/[.03] p-3 ring-1 ring-line">
            <div className="mb-2 flex items-center justify-between px-2 text-sm font-bold">
              {p.statuses[s]} <span className="text-muted">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
              {!items.length && <p className="px-2 py-4 text-center text-xs text-muted">{p.empty}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TaskCard({ task }: { task: Task }) {
  const { t, locale } = useI18n();
  const p = t.v3.studio.planner;
  const router = useRouter();
  const [checks, setChecks] = useState(task.checklist);
  const [newCheck, setNewCheck] = useState("");
  const [, start] = useTransition();
  const done = checks.filter((c) => c.done).length;
  const patch = (body: Parameters<typeof updateTaskAction>[1]) =>
    start(async () => {
      await updateTaskAction(task.id, body);
      router.refresh();
    });
  const toggle = (i: number) => {
    const next = checks.map((c, j) => (j === i ? { ...c, done: !c.done } : c));
    setChecks(next);
    patch({ checklist: next });
  };
  const overdue = task.dueAt && task.status !== "DONE" && task.dueAt < Date.parse(new Date().toDateString());
  return (
    <article className="rounded-2xl bg-surface p-3.5 ring-1 ring-line">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug">{task.title}</h3>
        <button type="button" onClick={() => start(async () => (await deleteTaskAction(task.id), router.refresh()))} aria-label={p.delete} className="rounded-lg p-1 text-muted hover:bg-white/10 hover:text-text">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted">
        {task.series && <span>{task.series}</span>}
        {task.dueAt && <span suppressHydrationWarning className={clsx(overdue && "font-semibold text-[#ff8a8a]")}>{new Date(task.dueAt).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-GB")}</span>}
      </div>
      {task.notes && <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-text/80">{task.notes}</p>}
      {checks.length > 0 && (
        <div className="mt-2.5">
          <div className="mb-1 text-[11px] font-semibold text-muted">{fmt(p.ready, { done, all: checks.length })}</div>
          <div className="mb-2 h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-[#7dffb2]" style={{ width: (done / checks.length) * 100 + "%" }} />
          </div>
          <ul className="space-y-1">
            {checks.map((c, i) => (
              <li key={i}>
                <button type="button" onClick={() => toggle(i)} className="flex w-full items-center gap-2 text-left text-sm">
                  <span className={clsx("flex h-4 w-4 shrink-0 items-center justify-center rounded border", c.done ? "border-[#7dffb2] bg-[#7dffb2] text-black" : "border-white/30")}>{c.done && <Check size={11} strokeWidth={3} />}</span>
                  <span className={clsx(c.done && "text-muted line-through")}>{c.t}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newCheck.trim()) return;
          const next = [...checks, { t: newCheck.trim(), done: false }];
          setChecks(next);
          setNewCheck("");
          patch({ checklist: next });
        }}
        className="mt-2"
      >
        <input value={newCheck} onChange={(e) => setNewCheck(e.target.value)} maxLength={80} placeholder={"+ " + p.addCheck} aria-label={p.addCheck} className="h-8 w-full rounded-lg bg-white/5 px-2 text-xs outline-none placeholder:text-muted focus:bg-white/10" />
      </form>
      <div className="mt-2.5 flex gap-1">
        {(["TODO", "DOING", "DONE"] as const).map((s) => (
          <button
            key={s}
            type="button"
            disabled={task.status === s}
            onClick={() => patch({ status: s })}
            className={clsx("h-7 flex-1 rounded-lg text-[11px] font-semibold", task.status === s ? "bg-white text-black" : "bg-white/5 text-muted hover:text-text")}
          >
            {p.statuses[s]}
          </button>
        ))}
      </div>
    </article>
  );
}
