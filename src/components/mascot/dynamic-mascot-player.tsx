"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  fitTimeline,
  GLITCH_CHANCE,
  GLITCH_MS,
  nextCutMs,
  parseScriptToEmotionalTimeline,
  pickClip,
  timelineAt,
  timelineDuration,
  type Emotion,
  type MascotClipDTO,
  type TimelineItem,
  type Tone,
} from "@/lib/mascot";
import { MascotFigure } from "./mascot-figure";

// ───────────── clip bank (fetched once per page) ─────────────

let bankPromise: Promise<MascotClipDTO[]> | null = null;
function loadBank() {
  bankPromise ??= fetch("/api/mascot/clips")
    .then((r) => (r.ok ? r.json() : { clips: [] }))
    .then((d: { clips: MascotClipDTO[] }) => d.clips ?? [])
    .catch(() => []);
  return bankPromise;
}

export function useMascotBank() {
  const [bank, setBank] = useState<MascotClipDTO[]>([]);
  useEffect(() => {
    let alive = true;
    void loadBank().then((b) => alive && setBank(b));
    return () => {
      alive = false;
    };
  }, []);
  return bank;
}

// ───────────── audio: radio "gas mask" filter + loudness peaks ─────────────

type AudioChain = { ctx: AudioContext; analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> };
const chains = new WeakMap<HTMLAudioElement, AudioChain>();

function radioChain(el: HTMLAudioElement): AudioChain | null {
  const had = chains.get(el);
  if (had) return had;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const src = ctx.createMediaElementSource(el);
    // Telephone band (300–3400 Hz) + a little overdrive = voice through a gas mask / radio.
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 300;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3400;
    const peak = ctx.createBiquadFilter();
    peak.type = "peaking";
    peak.frequency.value = 1500;
    peak.gain.value = 6;
    const drive = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / curve.length) * 2 - 1;
      curve[i] = Math.tanh(2.2 * x);
    }
    drive.curve = curve;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(hp).connect(lp).connect(peak).connect(drive).connect(analyser).connect(ctx.destination);
    const chain = { ctx, analyser, data: new Uint8Array(new ArrayBuffer(analyser.fftSize)) };
    chains.set(el, chain);
    return chain;
  } catch {
    return null;
  }
}

function rms(chain: AudioChain) {
  chain.analyser.getByteTimeDomainData(chain.data);
  let sum = 0;
  for (const v of chain.data) sum += ((v - 128) / 128) ** 2;
  return Math.sqrt(sum / chain.data.length);
}

// ───────────── emotion particles (fire when angry, hearts when in love…) ─────────────

type FxMode = "rise" | "fall" | "burst";
const FX: Partial<Record<Emotion, { items: string[]; perSec: number; mode: FxMode; behind?: boolean; area: [number, number, number, number] }>> = {
  // area = [xFrom%, xTo%, yFrom%, yTo%] of the figure box
  ANGRY_RAGE: { items: ["🔥", "🔥", "🔥", "💢"], perSec: 7, mode: "rise", behind: true, area: [10, 90, 45, 95] },
  HYPE_EXCITED: { items: ["✨", "⭐", "💰", "🎉", "✨"], perSec: 5, mode: "burst", area: [5, 95, 5, 70] },
  LAUGH_SARCASM: { items: ["HA", "HA!", "😂", "ха-ха"], perSec: 3, mode: "rise", area: [0, 100, 10, 50] },
  SHOCK_SCARED: { items: ["❗", "⁉️", "💦", "❕"], perSec: 3.5, mode: "burst", area: [10, 90, 0, 45] },
  LOVE: { items: ["❤️", "💕", "💖", "❤️"], perSec: 4, mode: "rise", area: [5, 95, 20, 80] },
  SAD: { items: ["💧", "💧", "💧"], perSec: 4, mode: "fall", area: [25, 75, 0, 10] },
  CONFUSED: { items: ["❓", "❔", "?"], perSec: 2, mode: "rise", area: [55, 95, 0, 30] },
};
type Particle = { id: number; ch: string; x: number; y: number; size: number; dur: number; mode: FxMode; dx: number; dy: number; behind: boolean };

function useParticles(emotion: Emotion, scale: number) {
  const [items, setItems] = useState<Particle[]>([]);
  useEffect(() => {
    const fx = FX[emotion];
    if (!fx || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = window.setTimeout(() => setItems([]), 0);
      return () => clearTimeout(id);
    }
    let n = 0;
    const timers: number[] = [];
    const spawn = () => {
      const [x0, x1, y0, y1] = fx.area;
      const dur = 1100 + Math.random() * 900;
      const p: Particle = {
        id: Date.now() + n++,
        ch: fx.items[Math.floor(Math.random() * fx.items.length)],
        x: x0 + Math.random() * (x1 - x0),
        y: y0 + Math.random() * (y1 - y0),
        size: (16 + Math.random() * 16) * scale,
        dur,
        mode: fx.mode,
        dx: (Math.random() - 0.5) * 60 * scale,
        dy: (Math.random() - 0.5) * 60 * scale,
        behind: !!fx.behind,
      };
      setItems((list) => [...list.slice(-17), p]);
      timers.push(window.setTimeout(() => setItems((list) => list.filter((x) => x.id !== p.id)), dur));
    };
    spawn();
    const id = window.setInterval(spawn, 1000 / fx.perSec);
    return () => {
      clearInterval(id);
      timers.forEach(clearTimeout);
    };
  }, [emotion, scale]);
  return items;
}

function FxLayer({ items, behind }: { items: Particle[]; behind: boolean }) {
  return (
    <div aria-hidden className={clsx("pointer-events-none absolute inset-0 overflow-visible", behind ? "z-0" : "z-20")}>
      {items
        .filter((p) => p.behind === behind)
        .map((p) => (
          <span
            key={p.id}
            className={clsx("mascot-fx absolute select-none font-display font-black leading-none text-[#ffd23d] [text-shadow:0_2px_6px_rgba(0,0,0,.6)]", "mascot-fx-" + p.mode)}
            style={{ left: p.x + "%", top: p.y + "%", fontSize: p.size, animationDuration: p.dur + "ms", ["--dx" as string]: p.dx + "px", ["--dy" as string]: p.dy + "px" }}
          >
            {p.ch}
          </span>
        ))}
    </div>
  );
}

// ───────────── the player ─────────────

export type MascotPlayerProps = {
  /** The script to read (ignored when `timeline` is given). */
  text?: string;
  timeline?: TimelineItem[];
  tone?: Tone;
  /** Broadcast sync: the moment (on `clock`) the script started; everybody is at the same phrase. */
  startedAt?: number;
  clock?: () => number;
  /** Produce sound (TTS file or the browser voice). Muted viewers still see the performance + captions. */
  speak?: boolean;
  audioUrl?: string | null;
  locale: "ru" | "en";
  /** stage = full screen host, pip = corner window, badge = small brand mascot (idle loop, no text). */
  variant?: "stage" | "pip" | "badge";
  captions?: boolean;
  /** Badge: the emotion to loop. */
  emotion?: Emotion;
  className?: string;
};

/**
 * DynamicMascotPlayer: assembles a "live" host performance from short emotion loops — no video rendering,
 * no lip-sync. Follows the emotional timeline under the voice, cuts to another micro-clip of the same emotion
 * every 0.5–1 s and on loudness peaks, and sometimes covers a cut with a 0.2 s TV glitch.
 */
export function DynamicMascotPlayer({ text = "", timeline: given, tone = "AUTO", startedAt, clock, speak = false, audioUrl, locale, variant = "stage", captions = true, emotion: badgeEmotion, className }: MascotPlayerProps) {
  const bank = useMascotBank();
  const baseTimeline = useMemo(() => given ?? (text ? parseScriptToEmotionalTimeline(text, tone) : []), [given, text, tone]);
  const [timeline, setTimeline] = useState(baseTimeline);
  const [state, setState] = useState<{ emotion: Emotion; phrase: string; variant: number; clip: MascotClipDTO | null; glitch: boolean; pulse: number }>({
    emotion: badgeEmotion ?? "IDLE",
    phrase: "",
    variant: 0,
    clip: null,
    glitch: false,
    pulse: 0,
  });
  const audio = useRef<HTMLAudioElement>(null);
  const mountedAt = useRef(0);
  const speechStart = useRef<number | null>(null);
  const speechOffset = useRef(0);
  const peak = useRef(0);
  const lastPeak = useRef(0);

  useEffect(() => {
    const id = window.setTimeout(() => setTimeline(baseTimeline), 0);
    return () => clearTimeout(id);
  }, [baseTimeline]);

  // Where are we in the script (ms)?
  const position = () => {
    const now = performance.now();
    if (audio.current && audioUrl && speak && !audio.current.paused) return audio.current.currentTime * 1000;
    if (speechStart.current !== null) return speechOffset.current + (now - speechStart.current);
    if (startedAt !== undefined && clock) return clock() - startedAt;
    return now - mountedAt.current;
  };
  const positionRef = useRef(position);
  useEffect(() => {
    positionRef.current = position;
  });

  // Sound: server TTS through the radio filter, or the browser voice from the current phrase on.
  useEffect(() => {
    if (!speak || !timeline.length || variant === "badge") return;
    const startAt = startedAt !== undefined && clock ? Math.max(0, clock() - startedAt) : 0;
    if (startAt >= timelineDuration(timeline)) return;
    if (audioUrl && audio.current) {
      const el = audio.current;
      const chain = radioChain(el);
      void chain?.ctx.resume();
      const onMeta = () => {
        if (el.duration > 0) setTimeline((t) => fitTimeline(t, el.duration * 1000));
        el.currentTime = Math.min(el.duration || 0, startAt / 1000);
        void el.play().catch(() => {});
      };
      if (el.readyState >= 1) onMeta();
      else el.addEventListener("loadedmetadata", onMeta, { once: true });
      return () => {
        el.pause();
        el.removeEventListener("loadedmetadata", onMeta);
      };
    }
    if (!("speechSynthesis" in window)) return;
    const from = timelineAt(timeline, startAt);
    const rest = timeline.slice(from?.index ?? 0).map((x) => x.phrase).filter(Boolean).join(" ");
    if (!rest) return;
    let offset = 0;
    for (let i = 0; i < (from?.index ?? 0); i++) offset += timeline[i].durationMs;
    const u = new SpeechSynthesisUtterance(rest);
    u.lang = locale === "ru" ? "ru-RU" : "en-US";
    u.rate = 1.05;
    u.pitch = 0.8;
    u.onstart = () => {
      speechOffset.current = offset;
      speechStart.current = performance.now();
    };
    // The browser voice can't go through Web Audio — word boundaries stand in for loudness peaks.
    u.onboundary = () => (peak.current = performance.now());
    u.onend = () => (speechStart.current = null);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    return () => {
      window.speechSynthesis.cancel();
      speechStart.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak, timeline, audioUrl, variant]);

  // The editing engine: ~10 ticks per second decide the emotion, cuts and glitches.
  useEffect(() => {
    mountedAt.current = performance.now();
    let nextCut = 0;
    let curEmotion: Emotion | null = null;
    let prevClip: string | null = null;
    let glitchUntil = 0;
    const rnd = Math.random;
    const id = window.setInterval(() => {
      const now = performance.now();
      const pos = positionRef.current();
      const at = timeline.length ? timelineAt(timeline, Math.max(0, pos)) : null;
      const emotion: Emotion = at ? at.item.emotion : badgeEmotion && !timeline.length ? badgeEmotion : "IDLE";
      const phrase = at?.item.phrase ?? "";
      // Loudness peak (server TTS) or a spoken word boundary (browser voice).
      const chain = audio.current ? chains.get(audio.current) : undefined;
      if (chain && audio.current && !audio.current.paused) {
        const level = rms(chain);
        if (level > 0.14 && now - lastPeak.current > 260) peak.current = now;
      }
      const isPeak = peak.current > lastPeak.current && now - peak.current < 160;
      if (isPeak) lastPeak.current = peak.current;
      const changed = emotion !== curEmotion;
      const due = now >= nextCut || changed || (isPeak && emotion !== "IDLE");
      if (!due) {
        if (glitchUntil && now > glitchUntil) {
          glitchUntil = 0;
          setState((s) => ({ ...s, glitch: false }));
        }
        return;
      }
      curEmotion = emotion;
      nextCut = now + nextCutMs(emotion, rnd);
      const glitch = !changed ? rnd() < GLITCH_CHANCE : rnd() < 0.6;
      if (glitch) glitchUntil = now + GLITCH_MS;
      const clip = pickClip(bank, emotion, prevClip, rnd);
      prevClip = clip?.id ?? null;
      setState((s) => ({
        emotion,
        phrase,
        variant: s.variant + 1 + Math.floor(rnd() * 2),
        clip,
        glitch,
        pulse: isPeak ? s.pulse + 1 : 0,
      }));
    }, 100);
    return () => clearInterval(id);
  }, [timeline, bank, badgeEmotion]);

  const glitchClip = state.glitch ? bank.find((c) => c.emotion === "GLITCH_TRANSITION") ?? null : null;
  const clip = glitchClip ?? state.clip;
  const small = variant !== "stage";
  const particles = useParticles(state.emotion, small ? 0.55 : 1);

  return (
    <div className={clsx("mascot-player relative flex flex-col items-center", className)} data-emotion={state.emotion}>
      <div className={clsx("relative", state.glitch && "mascot-glitch", `mascot-mood-${state.emotion.toLowerCase()}`, variant === "stage" ? "h-[42vh] max-h-[420px] w-auto md:h-[52vh]" : variant === "pip" ? "h-full w-full" : "h-full w-full")}>
        <FxLayer items={particles} behind />
        <div className="relative z-10 h-full w-full">
          {clip ? (
            <video key={clip.id} src={clip.url} autoPlay muted loop playsInline className="h-full w-full object-contain" />
          ) : (
            <MascotFigure emotion={state.emotion === "GLITCH_TRANSITION" ? "NEUTRAL_TALK" : state.emotion} variant={state.variant} pulse={state.pulse} className="h-full w-full" />
          )}
        </div>
        <FxLayer items={particles} behind={false} />
      </div>
      {audioUrl && <audio ref={audio} src={audioUrl} preload="auto" crossOrigin="anonymous" className="hidden" />}
      {captions && !small && (
        <p className="mt-4 min-h-[2.6em] max-w-3xl text-balance text-center text-xl font-semibold leading-snug [text-shadow:0_2px_10px_rgba(0,0,0,.9)] md:text-3xl">{state.phrase}</p>
      )}
      {captions && variant === "pip" && state.phrase && (
        <p className="absolute inset-x-1 bottom-1 line-clamp-2 rounded bg-black/70 px-1.5 py-0.5 text-center text-[11px] font-semibold leading-tight md:text-xs">{state.phrase}</p>
      )}
    </div>
  );
}
