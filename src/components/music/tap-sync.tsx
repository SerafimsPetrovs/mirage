"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import clsx from "clsx";
import { ClipboardPaste, Pencil, Play, RotateCcw, Save, Timer, Undo2 } from "lucide-react";
import { btn, textareaCls } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { saveTimingsAction } from "@/app/actions/music";
import { lyricLines, parseLrc, type LrcLine } from "@/lib/music-rules";

const mmss = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

/**
 * Tap-to-sync: the song plays, the user taps "Line" (or Space) when each lyric line starts.
 * One listen gives line timings — cheaper and more reliable than speech recognition on a small box.
 */
export function TapSync({ trackId, lyrics: initialLyrics, initial, editable }: { trackId: string; lyrics: string; initial: LrcLine[]; editable: boolean }) {
  const { t } = useI18n();
  const s = t.music.sync;
  const toast = useToast();
  const audio = useRef<HTMLAudioElement>(null);
  const [lyrics, setLyrics] = useState(initial.length && !initialLyrics.trim() ? initial.map((l) => l.text).join("\n") : initialLyrics);
  const lines = useMemo(() => lyricLines(lyrics), [lyrics]);
  const [times, setTimes] = useState<(number | null)[]>(() => {
    const ls = lyricLines(initialLyrics.trim() ? initialLyrics : initial.map((l) => l.text).join("\n"));
    return ls.map((txt, i) => (initial[i]?.text === txt ? initial[i].t : null));
  });
  const [idx, setIdx] = useState(-1); // next line to stamp while syncing; -1 = not syncing
  const [now, setNow] = useState(0);
  const [editing, setEditing] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [paste, setPaste] = useState("");
  const [saving, startSave] = useTransition();
  const listRef = useRef<HTMLOListElement>(null);

  const syncing = idx >= 0 && idx < lines.length;
  const timed = times.filter((x) => x !== null).length;
  // line playing right now (preview of the saved/stamped timings)
  const current = useMemo(() => {
    let c = -1;
    times.forEach((x, i) => {
      if (x !== null && x <= now) c = i;
    });
    return c;
  }, [times, now]);

  const tap = useCallback(() => {
    const a = audio.current;
    if (!a || idx < 0 || idx >= lines.length) return;
    const at = Math.round(a.currentTime * 100) / 100;
    setTimes((x) => {
      const next = [...x];
      next[idx] = at;
      return next;
    });
    setIdx((i) => i + 1);
  }, [idx, lines.length]);

  const undo = () => {
    if (idx <= 0) return;
    const back = idx - 1;
    const a = audio.current;
    const prevT = times[back - 1] ?? 0;
    setTimes((x) => {
      const next = [...x];
      next[back] = null;
      return next;
    });
    setIdx(back);
    if (a) a.currentTime = Math.max(0, prevT);
  };

  const begin = () => {
    setTimes(lines.map(() => null));
    setIdx(0);
    const a = audio.current;
    if (a) {
      a.currentTime = 0;
      void a.play();
    }
  };

  useEffect(() => {
    if (!syncing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        tap();
      } else if (e.code === "Backspace" && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    const focus = syncing ? idx : current;
    listRef.current?.querySelector(`[data-i="${focus}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [idx, current, syncing]);

  const save = () =>
    startSave(async () => {
      const payload = lines.flatMap((text, i) => (times[i] !== null && times[i] !== undefined ? [{ t: times[i] as number, text }] : []));
      const r = await saveTimingsAction(trackId, payload, lyrics);
      toast(r.ok ? s.saved : t.common.error, r.ok ? "ok" : "error");
    });

  const applyLrc = () => {
    const parsed = parseLrc(paste);
    if (!parsed.length) return;
    setLyrics(parsed.map((l) => l.text).join("\n"));
    setTimes(parsed.map((l) => l.t));
    setIdx(-1);
    setPasting(false);
    setPaste("");
  };

  return (
    <section className="rounded-3xl bg-surface p-5 ring-1 ring-line md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Timer size={20} className="text-accent" /> {s.title}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted">{s.hint}</p>
        </div>
        {editable && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing((x) => !x)} className={btn("glass", "sm")}>
              <Pencil size={15} /> {s.editLyrics}
            </button>
            <button type="button" onClick={() => setPasting((x) => !x)} className={btn("glass", "sm")}>
              <ClipboardPaste size={15} /> {s.pasteLrc}
            </button>
          </div>
        )}
      </div>

      <audio ref={audio} src={`/api/music/${trackId}/audio`} controls preload="metadata" className="mt-4 w-full" onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)} />

      {pasting && (
        <div className="mt-4 space-y-2">
          <textarea rows={6} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="[00:12.30] …" className={textareaCls + " font-mono text-sm"} aria-label={s.pasteLrc} />
          <p className="text-xs text-muted">{s.pasteHint}</p>
          <button type="button" onClick={applyLrc} className={btn("primary", "sm")}>
            {s.apply}
          </button>
        </div>
      )}
      {editing && (
        <textarea
          rows={8}
          value={lyrics}
          onChange={(e) => {
            setLyrics(e.target.value);
            setTimes(lyricLines(e.target.value).map(() => null));
            setIdx(-1);
          }}
          aria-label={t.music.lyrics}
          className={textareaCls + " mt-4"}
        />
      )}

      {lines.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-surface-2 p-4 text-center text-sm text-muted">{s.empty}</p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {editable && !syncing && (
              <button type="button" onClick={begin} className={btn("primary", "md")}>
                <Play size={17} /> {timed ? s.reset : s.start}
              </button>
            )}
            {syncing && (
              <>
                <button type="button" onClick={tap} className={btn("primary", "lg", "min-w-40")}>
                  {s.tap} <kbd className="ml-1 rounded bg-black/25 px-1.5 py-0.5 text-xs font-normal">Space</kbd>
                </button>
                <button type="button" onClick={undo} disabled={idx <= 0} className={btn("glass", "md")}>
                  <Undo2 size={16} /> {s.undo}
                </button>
                <span className="text-sm text-muted">{fmt(s.line, { n: Math.min(idx + 1, lines.length), total: lines.length })}</span>
              </>
            )}
            {!syncing && idx >= lines.length && <span className="text-sm text-ok">{s.done}</span>}
            {editable && (
              <button type="button" onClick={save} disabled={saving} className={btn("glass", "md", "ml-auto")}>
                <Save size={16} /> {s.save}
              </button>
            )}
          </div>
          <ol ref={listRef} className="mt-4 max-h-80 space-y-1 overflow-y-auto pr-1">
            {lines.map((text, i) => (
              <li
                key={`${i}-${text}`}
                data-i={i}
                className={clsx(
                  "flex items-baseline gap-3 rounded-xl px-3 py-2 text-[15px] transition",
                  syncing && i === idx ? "bg-accent/15 text-text ring-1 ring-accent/40" : !syncing && i === current ? "bg-white/10 text-text" : "text-muted",
                )}
              >
                <button
                  type="button"
                  disabled={times[i] === null}
                  onClick={() => {
                    const a = audio.current;
                    if (a && times[i] !== null) {
                      a.currentTime = times[i] as number;
                      void a.play();
                    }
                  }}
                  className="w-14 shrink-0 text-left font-mono text-xs tabular-nums text-muted hover:text-text disabled:hover:text-muted"
                >
                  {times[i] !== null ? mmss(times[i] as number) : "—"}
                </button>
                <span>{text}</span>
              </li>
            ))}
          </ol>
          {timed === 0 && !syncing && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
              <RotateCcw size={13} /> {s.untimed}
            </p>
          )}
        </>
      )}
    </section>
  );
}
