"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Loader2, Pause, Play } from "lucide-react";
import { btn, inputCls, labelCls, textareaCls } from "@/components/ui/button";
import { Uploader } from "@/components/studio/uploader";
import { useI18n } from "@/i18n/client";
import { createSongAction } from "@/app/actions/songs";
import { AI_TOOLS, BLOCKED_TOOLS, clampHook, peaks, SONG_GENRES, type AiTool } from "@/lib/song-rules";

const BARS = 120;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Waveform with a draggable 15-second frame; the frame can be previewed before publishing. */
function HookPicker({ file, start, onStart }: { file: File; start: number; onStart: (s: number) => void }) {
  const { t } = useI18n();
  const f = t.songs.form;
  const [wave, setWave] = useState<number[] | null>(null);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const url = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    const u = URL.createObjectURL(file);
    url.current = u;
    if (audio.current) audio.current.src = u;
    (async () => {
      try {
        const ctx = new AudioContext();
        const buf = await ctx.decodeAudioData(await file.arrayBuffer());
        if (!alive) return;
        setDuration(buf.duration);
        setWave(peaks(buf.getChannelData(0), BARS));
        void ctx.close();
      } catch {
        if (alive) setWave([]);
      }
    })();
    return () => {
      alive = false;
      URL.revokeObjectURL(u);
    };
  }, [file]);

  const hook = clampHook(start, duration);
  const toTime = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return x * duration - hook.len / 2; // the frame centres on the finger
  };
  const drag = (e: React.PointerEvent) => {
    if (!duration) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    onStart(clampHook(toTime(e.clientX), duration).start);
  };

  // preview loops the frame
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const tick = () => {
      if (a.currentTime >= hook.start + hook.len || a.currentTime < hook.start - 0.5) a.currentTime = hook.start;
    };
    a.addEventListener("timeupdate", tick);
    return () => a.removeEventListener("timeupdate", tick);
  }, [hook.start, hook.len]);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.currentTime = hook.start;
      void a.play();
      setPlaying(true);
    }
  };

  return (
    <div className="rounded-3xl bg-surface p-5 ring-1 ring-line">
      <p className="font-semibold">{f.hook}</p>
      <p className="mt-1 text-sm text-muted">{f.hookHint}</p>
      <audio ref={audio} preload="auto" onPause={() => setPlaying(false)} />
      {!wave ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted"><Loader2 size={16} className="animate-spin" /> {f.decoding}</p>
      ) : (
        <>
          <div
            ref={box}
            onPointerDown={drag}
            onPointerMove={(e) => e.buttons === 1 && drag(e)}
            role="slider"
            tabIndex={0}
            aria-label={f.hook}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(hook.start)}
            aria-valuetext={`${mmss(hook.start)} – ${mmss(hook.start + hook.len)}`}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") onStart(clampHook(hook.start - 1, duration).start);
              if (e.key === "ArrowRight") onStart(clampHook(hook.start + 1, duration).start);
            }}
            className="relative mt-4 flex h-24 cursor-pointer touch-none select-none items-center gap-[2px] rounded-2xl bg-black/30 px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {wave.map((v, i) => {
              const t0 = (i / BARS) * duration;
              const inside = t0 >= hook.start && t0 <= hook.start + hook.len;
              return <span key={i} className={clsx("flex-1 rounded-full", inside ? "bg-accent" : "bg-white/25")} style={{ height: `${Math.max(6, v * 92)}%` }} />;
            })}
            {duration > 0 && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-1 rounded-xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,.25)]"
                style={{ left: `${(hook.start / duration) * 100}%`, width: `${(hook.len / duration) * 100}%` }}
              />
            )}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" onClick={toggle} className={btn("glass", "sm")}>
              {playing ? <Pause size={15} /> : <Play size={15} />} {playing ? f.stop : f.preview}
            </button>
            <span className="font-mono text-sm tabular-nums text-muted">
              {mmss(hook.start)} – {mmss(hook.start + hook.len)} / {mmss(duration)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export function SongForm() {
  const { t } = useI18n();
  const f = t.songs.form;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [audioRef, setAudio] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [coverRef, setCover] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState<string>("pop");
  const [lyrics, setLyrics] = useState("");
  const [tool, setTool] = useState<AiTool>("HUMAN");
  const [rights, setRights] = useState(false);
  const [hookStart, setHookStart] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const blocked = BLOCKED_TOOLS.includes(tool);
  const err = (code: string) => (f.errors as Record<string, string>)[code] ?? t.common.error;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!audioRef) return setError(f.errors.needAudio);
    if (blocked) return setError(f.errors.SUNO_FREE);
    if (!rights) return setError(f.errors.RIGHTS);
    start(async () => {
      const r = await createSongAction({ title, artist, genre, audioRef, coverRef, lyrics, hookStart, aiTool: tool, rightsOk: rights });
      if (r.ok) router.push(`/songs/${r.id}`);
      else setError(err(r.error));
    });
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-[1fr_200px]">
        <div className="space-y-4">
          <div>
            <Uploader kind="audio" endpoint="/api/music/upload" accept=".mp3,.wav,.m4a,.ogg,.flac,audio/*" label={f.audio} onDone={setAudio}
              onFile={(fl) => {
                setFile(fl);
                // "Artist - Title.mp3" → title (the author can still edit it)
                if (fl && !title.trim()) setTitle(fl.name.replace(/\.[^.]+$/, "").replace(/^.+?\s[-–—]\s/, "").replace(/[_]+/g, " ").trim().slice(0, 100));
              }}
            />
            <p className="mt-1.5 text-xs text-muted">{f.audioHint}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="sg-title" className={labelCls}>{f.name}</label>
              <input id="sg-title" required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="sg-artist" className={labelCls}>{f.artist}</label>
              <input id="sg-artist" maxLength={80} value={artist} onChange={(e) => setArtist(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>
        <Uploader kind="image" endpoint="/api/music/upload" accept="image/*" label={f.cover} onDone={setCover} aspect="aspect-square" />
      </div>

      {file && <HookPicker file={file} start={hookStart} onStart={setHookStart} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="sg-genre" className={labelCls}>{f.genre}</label>
          <select id="sg-genre" value={genre} onChange={(e) => setGenre(e.target.value)} className={inputCls}>
            {SONG_GENRES.map((g) => (
              <option key={g} value={g}>{t.songs.genres[g]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sg-tool" className={labelCls}>{f.made}</label>
          <select id="sg-tool" value={tool} onChange={(e) => setTool(e.target.value as AiTool)} className={inputCls}>
            {AI_TOOLS.map((x) => (
              <option key={x} value={x}>{f.tools[x]}</option>
            ))}
          </select>
        </div>
      </div>
      {blocked && <p className="rounded-2xl bg-coin/10 p-3 text-sm text-coin ring-1 ring-coin/30">{f.sunoFree}</p>}

      <div>
        <label htmlFor="sg-lyrics" className={labelCls}>{f.lyrics}</label>
        <textarea id="sg-lyrics" rows={5} maxLength={8000} value={lyrics} onChange={(e) => setLyrics(e.target.value)} className={textareaCls} />
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl bg-surface-2 p-4 text-sm leading-relaxed ring-1 ring-line">
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]" />
        <span>{f.rights}</span>
      </label>
      {error && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-300">{error}</p>}
      <button disabled={pending || !audioRef || blocked} className={btn("primary", "lg", "w-full sm:w-auto")}>
        {pending ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} {f.publish}
      </button>
    </form>
  );
}
