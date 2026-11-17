"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Coins, Loader2, Lock, Pause, Play } from "lucide-react";
import { Stage } from "@/components/tv/tv-stage";
import { useHls } from "@/components/player/use-hls";
import { btn } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { unlockEpisodeAction } from "@/app/actions/wallet";
import { countdownLeft, expectedPosition, needsSeek, type Playback } from "@/lib/party-rules";
import type { TvNowDTO } from "@/lib/tv-types";

/**
 * TV mode: the channel's live broadcast. The schedule is global, so every member sees the same second
 * without any extra syncing — the room only decides which channel is on.
 */
export function PartyTvPlayer({ slug, muted, volume, onBlocked }: { slug: string; muted: boolean; volume: number; onBlocked: () => void }) {
  const [data, setData] = useState<TvNowDTO | null>(null);
  const [retry, setRetry] = useState(0);
  const skew = useRef(0);
  const clock = useCallback(() => Date.now() + skew.current, []);

  useEffect(() => {
    let alive = true;
    fetch(`/api/tv/${slug}/now`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<TvNowDTO>) : null))
      .then((d) => {
        if (!alive || !d) return;
        skew.current = d.serverNow - Date.now();
        setData(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [slug, retry]);

  // fetch the next programme exactly when the current one ends
  useEffect(() => {
    if (!data) return;
    const end = data.slot.startsAt + data.slot.durationSec * 1000;
    const id = window.setTimeout(() => setRetry((r) => r + 1), Math.max(500, end - clock() + 200));
    return () => clearTimeout(id);
  }, [data, clock]);

  if (!data || data.channel.slug !== slug) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <Loader2 size={28} className="animate-spin text-muted" />
      </div>
    );
  }
  const noop = () => {};
  return (
    <Stage
      slot={data.slot}
      channel={data.channel}
      clock={clock}
      muted={muted}
      volume={volume}
      kids={false}
      onBlocked={onBlocked}
      onOrder={noop}
      onLike={noop}
      loggedIn
      onQuizAnswered={noop}
      shoutouts={[]}
      onGame={noop}
      speak={!muted}
      minimal
    />
  );
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * EPISODE mode: one catalog episode, in sync. The room stores { playing, position, stateAt }; each member's
 * player follows it and jumps back when it drifts. Only the remote holder's controls change the room.
 */
export function PartyEpisodePlayer({
  episode,
  playback,
  countdownTo,
  control,
  clock,
  muted,
  volume,
  onBlocked,
  onControl,
  onTime,
}: {
  episode: { id: string; number: number; durationSec: number; vertical: boolean; access: { ok: true } | { ok: false; price: number }; hls: boolean };
  playback: Playback;
  countdownTo: number | null;
  control: boolean;
  clock: () => number;
  muted: boolean;
  volume: number;
  onBlocked: () => void;
  onControl: (op: "play" | "pause" | "seek", positionSec: number) => void;
  onTime: (sec: number) => void;
}) {
  const { t } = useI18n();
  const p = t.party;
  const ref = useRef<HTMLVideoElement>(null);
  const [now, setNow] = useState(() => clock());
  const [unlocking, setUnlocking] = useState(false);
  const [unlockErr, setUnlockErr] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const duration = episode.durationSec || 0;
  useHls(ref, episode.access.ok && episode.hls ? `/api/hls/${episode.id}` : null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(clock()), 250);
    return () => clearInterval(id);
  }, [clock]);

  const left = countdownLeft(countdownTo, now);
  const target = expectedPosition(playback, now, duration || Infinity);

  // follow the room
  useEffect(() => {
    const v = ref.current;
    if (!v || !episode.access.ok) return;
    v.muted = muted;
    v.volume = volume;
    const shouldPlay = playback.playing && !left;
    // a file shorter than the episode's metadata (demo clips) loops, like in the normal player
    const real = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 0;
    const want = real && target >= real - 0.05 && real < duration - 1 ? target % real : target;
    if (needsSeek(v.currentTime, want, shouldPlay) && v.readyState >= 1) v.currentTime = want;
    if (shouldPlay && v.paused) v.play().catch(() => onBlocked());
    if (!shouldPlay && !v.paused) v.pause();
    onTime(v.currentTime);
  }, [now, playback, left, target, duration, muted, volume, episode.access.ok, onBlocked, onTime]);

  if (!episode.access.ok) {
    const price = episode.access.price;
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-surface to-black p-6 text-center">
        <div className="max-w-sm">
          <Lock size={32} className="mx-auto text-coin" />
          <p className="mt-3 font-display text-lg font-semibold">{p.locked}</p>
          <p className="mt-1 text-sm text-muted">{fmt(p.lockedText, { n: episode.number })}</p>
          <button
            type="button"
            disabled={unlocking}
            onClick={async () => {
              setUnlocking(true);
              const r = await unlockEpisodeAction(episode.id);
              setUnlocking(false);
              if (r.ok) window.location.reload();
              else setUnlockErr(true);
            }}
            className={btn("coin", "md", "mt-5")}
          >
            {unlocking ? <Loader2 size={17} className="animate-spin" /> : <Coins size={17} />} {fmt(p.unlock, { price })}
          </button>
          {unlockErr && <p className="mt-2 text-xs text-red-300">{t.common.error}</p>}
        </div>
      </div>
    );
  }

  const pos = drag ?? Math.min(target, duration || target);
  const commit = () => {
    if (drag !== null) onControl("seek", drag);
    setDrag(null);
  };
  return (
    <div className="absolute inset-0 bg-black">
      <video
        ref={ref}
        src={episode.hls ? undefined : `/api/stream/${episode.id}`}
        playsInline
        preload="auto"
        className={clsx("absolute inset-0 h-full w-full", episode.vertical ? "object-contain" : "object-contain")}
      />
      {left && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <span key={left} className="animate-[party-pop_0.9s_ease-out] font-display text-8xl font-black text-white drop-shadow-[0_0_30px_rgba(255,46,99,.8)]">
            {left}
          </span>
        </div>
      )}
      {!playback.playing && !left && (
        <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-sm font-semibold backdrop-blur">{p.paused}</div>
      )}
      {/* controls: everyone sees the position, only the remote holder can change it */}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/85 to-transparent px-4 pb-3 pt-10">
        {control && (
          <button
            type="button"
            aria-label={playback.playing ? p.pause : p.play}
            onClick={() => onControl(playback.playing ? "pause" : "play", pos)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black"
          >
            {playback.playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </button>
        )}
        <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-white/80">{mmss(pos)}</span>
        <input
          type="range"
          min={0}
          max={Math.max(1, duration)}
          step={1}
          value={Math.floor(pos)}
          disabled={!control}
          aria-label={p.play}
          onChange={(e) => setDrag(Number(e.target.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          className="h-1 flex-1 accent-[var(--accent)] disabled:opacity-70"
        />
        <span className="w-12 shrink-0 font-mono text-xs tabular-nums text-white/60">{mmss(duration)}</span>
      </div>
    </div>
  );
}
