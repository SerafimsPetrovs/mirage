"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { BarChart3, Heart, Library, ListMusic, Music2, Play, Plus, Share2, Sparkles, Volume2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { hookHeardAction, toggleSaveAction } from "@/app/actions/songs";
import { isAiMusic } from "@/lib/song-rules";
import { useMusicPlayer } from "./player";

export type FeedItem = {
  id: string;
  title: string;
  artist: string;
  genre: string;
  cover: string | null;
  durationSec: number;
  hookStart: number;
  hookLen: number;
  aiTool: string;
  saves: number;
  saved: boolean;
  airedTrackId: string | null;
  user: { id: string; name: string };
};

/**
 * The song feed: full-screen cards, swipe up for the next one. Each card plays only the author's 15-second hook
 * in a loop; ♥ adds the whole song to "My music"; ▶ plays it in the site-wide player.
 */
export function SongFeed({ initial, loggedIn }: { initial: FeedItem[]; loggedIn: boolean }) {
  const { t } = useI18n();
  const s = t.songs;
  const toast = useToast();
  const router = useRouter();
  const player = useMusicPlayer();
  const [items, setItems] = useState(initial);
  const [active, setActive] = useState(0);
  const [started, setStarted] = useState(false);
  const [progress, setProgress] = useState(0);
  const audio = useRef<HTMLAudioElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const heard = useRef(new Set<string>());
  const loading = useRef(false);
  const item = items[active];

  // which card is on screen
  useEffect(() => {
    const root = list.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll("[data-i]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items.length]);

  // more hooks when close to the end
  useEffect(() => {
    if (active < items.length - 3 || loading.current) return;
    loading.current = true;
    fetch(`/api/songs/feed?x=${items.map((i) => i.id).join(",")}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<FeedItem[]>) : []))
      .then((more) => {
        const seen = new Set(items.map((i) => i.id));
        const fresh = more.filter((m) => !seen.has(m.id));
        if (fresh.length) setItems((x) => [...x, ...fresh]);
      })
      .catch(() => {})
      .finally(() => {
        loading.current = false;
      });
  }, [active, items]);

  // play the active hook in a loop
  useEffect(() => {
    const a = audio.current;
    if (!a || !item || !started) return;
    player.pause();
    a.src = `/api/songs/${item.id}/audio`;
    const seek = () => {
      a.currentTime = item.hookStart;
      void a.play().catch(() => {});
    };
    a.addEventListener("loadedmetadata", seek, { once: true });
    const tick = () => {
      const into = a.currentTime - item.hookStart;
      setProgress(Math.max(0, Math.min(1, into / item.hookLen)));
      if (into >= item.hookLen || a.ended) {
        a.currentTime = item.hookStart;
        void a.play().catch(() => {});
      }
      if (into > 3 && !heard.current.has(item.id)) {
        heard.current.add(item.id);
        void hookHeardAction(item.id);
      }
    };
    a.addEventListener("timeupdate", tick);
    return () => {
      a.removeEventListener("loadedmetadata", seek);
      a.removeEventListener("timeupdate", tick);
      a.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the player object changes on every song; we only need pause()
  }, [item?.id, started]);

  const save = useCallback(
    async (it: FeedItem) => {
      if (!loggedIn) return router.push("/register?next=/songs");
      const r = await toggleSaveAction(it.id);
      if (!r.ok) return toast(t.common.error, "error");
      setItems((x) => x.map((y) => (y.id === it.id ? { ...y, saved: r.saved, saves: y.saves + (r.saved ? 1 : -1) } : y)));
      if (r.saved) toast(s.saved);
    },
    [loggedIn, router, toast, t.common.error, s.saved],
  );

  const share = async (it: FeedItem) => {
    const url = `${window.location.origin}/songs/${it.id}`;
    try {
      if (navigator.share) await navigator.share({ title: it.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast(t.party.copied);
      }
    } catch {}
  };

  return (
    <div className="relative h-dvh bg-black">
      <audio ref={audio} preload="auto" />
      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent px-4 pb-6 pt-[max(12px,env(safe-area-inset-top))]">
        <Link href="/" className="pointer-events-auto font-display text-lg font-bold">MIRAGE</Link>
        <span className="pointer-events-auto flex items-center gap-1.5 font-semibold text-accent">
          <Music2 size={18} /> {s.nav}
        </span>
        <div className="pointer-events-auto ml-auto flex gap-1.5">
          <Link href="/songs/chart" aria-label={s.chart} title={s.chart} className="rounded-full bg-white/10 p-2.5 backdrop-blur hover:bg-white/20"><BarChart3 size={18} /></Link>
          <Link href="/songs/library" aria-label={s.library} title={s.library} className="rounded-full bg-white/10 p-2.5 backdrop-blur hover:bg-white/20"><Library size={18} /></Link>
          <Link href="/songs/new" aria-label={s.upload} title={s.upload} className="rounded-full bg-accent p-2.5 hover:brightness-110"><Plus size={18} /></Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
          <ListMusic size={40} className="text-muted" />
          <p className="text-muted">{s.empty}</p>
          <Link href="/songs/new" className="rounded-full bg-accent px-5 py-2.5 font-semibold">{s.upload}</Link>
        </div>
      ) : (
        <div ref={list} className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll">
          {items.map((it, i) => (
            <section key={it.id} data-i={i} className="relative flex h-dvh snap-start snap-always items-center justify-center overflow-hidden">
              {/* blurred cover behind */}
              {it.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.cover} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-3xl" />
              ) : (
                <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(70% 60% at 50% 40%, hsl(${(it.id.charCodeAt(2) * 37) % 360} 70% 35%), #000 75%)` }} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/40" />
              {/* cover, spinning like a record while its hook plays */}
              <div className={clsx("relative h-[min(62vw,320px)] w-[min(62vw,320px)] overflow-hidden rounded-[28px] shadow-[0_30px_80px_-20px_rgba(0,0,0,.9)] ring-1 ring-white/15", i === active && started && "motion-safe:animate-[float-glow_6s_ease-in-out_infinite]")}>
                {it.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.cover} alt={it.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#7c5cff] to-[#ff2e63]">
                    <Music2 size={72} className="text-white/80" />
                  </div>
                )}
              </div>

              {/* title + author */}
              <div className="absolute inset-x-0 bottom-0 px-5 pb-[max(28px,calc(env(safe-area-inset-bottom)+20px))] pr-20">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {isAiMusic(it.aiTool) && (
                    <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold backdrop-blur"><Sparkles size={12} /> {s.ai}</span>
                  )}
                  {it.genre && it.genre !== "other" && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] backdrop-blur">{(s.genres as Record<string, string>)[it.genre] ?? it.genre}</span>}
                  {it.airedTrackId && <span className="rounded-full bg-[#ff3b3b]/80 px-2 py-0.5 text-[11px] font-semibold">● {s.aired}</span>}
                </div>
                <Link href={`/songs/${it.id}`} className="block font-display text-2xl font-bold leading-tight drop-shadow">{it.title}</Link>
                <p className="mt-0.5 text-white/80">{it.artist || it.user.name}</p>
                {/* 15 s hook progress */}
                <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full bg-white transition-[width] duration-200 ease-linear" style={{ width: `${i === active ? progress * 100 : 0}%` }} />
                </div>
              </div>

              {/* actions */}
              <div className="absolute bottom-[max(36px,calc(env(safe-area-inset-bottom)+28px))] right-3 flex flex-col items-center gap-4">
                <button type="button" onClick={() => save(it)} aria-pressed={it.saved} aria-label={it.saved ? s.saved : s.save} className="flex flex-col items-center gap-1">
                  <span className={clsx("flex h-12 w-12 items-center justify-center rounded-full backdrop-blur transition active:scale-90", it.saved ? "bg-accent" : "bg-white/15")}>
                    <Heart size={24} className={it.saved ? "fill-white" : ""} />
                  </span>
                  <span className="text-xs font-semibold">{it.saves}</span>
                </button>
                <button
                  type="button"
                  aria-label={s.full}
                  title={s.full}
                  onClick={() => {
                    audio.current?.pause();
                    setStarted(false);
                    player.play({ id: it.id, title: it.title, artist: it.artist, cover: it.cover, userName: it.user.name }, items.map((x) => ({ id: x.id, title: x.title, artist: x.artist, cover: x.cover, userName: x.user.name })));
                  }}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 backdrop-blur"
                >
                  <Play size={22} className="ml-0.5" />
                </button>
                <button type="button" onClick={() => share(it)} aria-label={s.share} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 backdrop-blur">
                  <Share2 size={20} />
                </button>
              </div>
            </section>
          ))}
        </div>
      )}

      {!started && items.length > 0 && (
        <button type="button" onClick={() => setStarted(true)} className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/55 backdrop-blur-sm">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-black shadow-2xl"><Volume2 size={34} /></span>
          <span className="font-display text-xl font-bold">{s.tapToStart}</span>
          <span className="max-w-xs px-6 text-center text-sm text-white/75">{s.tapHint}</span>
        </button>
      )}
      {!loggedIn && started && (
        <p className="pointer-events-none absolute inset-x-0 top-16 z-20 text-center text-xs text-white/70">{s.loginToSave}</p>
      )}
      <span className="sr-only" aria-live="polite">{item ? fmt(s.by, { name: `${item.title} — ${item.artist || item.user.name}` }) : ""}</span>
    </div>
  );
}
