"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Clapperboard, Eye, Gem, History, LayoutList, Maximize, MessageCircle, MessageSquareText, Mic, MicOff, Minimize, Smile, Moon, Sparkles, Volume1, Volume2, VolumeX } from "lucide-react";
import clsx from "clsx";
import { useI18n } from "@/i18n/client";
import { useToast } from "@/components/ui/toast";
import { reactTvAction, toggleTvLikeAction } from "@/app/actions/tv";
import { muteFromChatAction } from "@/app/actions/tv-admin";
import { fmt } from "@/i18n/shared";
import { stripTitle, type TvChannelDTO, type TvNowDTO, type TvSlotDTO } from "@/lib/tv-types";
import { HardLoginWall, useGuestWall } from "@/components/auth/guest-wall";
import { Noise } from "./noise";
import { Stage, type Clock } from "./tv-stage";
import { ChatOverlay, ChatPanel, TickerBar, useTvLive } from "./tv-chat";
import { GameOverlay, PinnedBanner, PollCard, ReactionsLayer, SLEEP_STEPS, SleepScreen, SuperchatSheet, useFloating, useQuizResults } from "./tv-interactive";
import { Guide } from "./tv-guide";
import { OrderSheet, TickerSheet } from "./tv-sheets";
import { AlertsBar, FunnelCta, LiveCaptions, PipMascot, UnmuteButton } from "./tv-overlays";
import { ChannelStrip, TvInfoBar, type StripItem } from "./tv-home-parts";
import { BuddyCompanion } from "@/components/buddy/buddy-companion";
import { buddyDef, type Outfit } from "@/lib/buddy-catalog";

type Viewer = { loggedIn: boolean; coins: number; kids: boolean; name: string; gold: number; admin: boolean; buddy?: { buddy: string; outfit: Outfit } | null };

function useStored(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(initial);
  useEffect(() => {
    try {
      const s = localStorage.getItem(key);
      if (s !== null) {
        const id = window.setTimeout(() => setV(s === "1"), 0);
        return () => clearTimeout(id);
      }
    } catch {}
  }, [key]);
  const set = useCallback(
    (x: boolean) => {
      setV(x);
      try {
        localStorage.setItem(key, x ? "1" : "0");
      } catch {}
    },
    [key],
  );
  return [v, set];
}

function viewerKey() {
  try {
    return localStorage.getItem("tv-vid") ?? "x";
  } catch {
    return "x";
  }
}

function hhmm(ms: number) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * The live TV screen.
 * - `embedded` (home page) = a stream page like Twitch: the player with a hover control bar, the info bar under it,
 *   other channels as a row of cards, the chat column on the right (TikTok-style overlay on phones).
 * - otherwise (/tv/[slug]) = full-screen "theatre" with the on-screen remote.
 */
export function TvScreen({
  channels,
  initial,
  viewer,
  embedded = false,
  strip = [],
  below,
}: {
  channels: TvChannelDTO[];
  initial: TvNowDTO;
  viewer: Viewer;
  embedded?: boolean;
  /** Embedded: what's on every channel (for the channel row). */
  strip?: StripItem[];
  /** Embedded: content under the channel row (the modest catalog teaser). */
  below?: React.ReactNode;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [data, setData] = useState<TvNowDTO>(initial);
  const skew = useRef(0);
  const [booting, setBooting] = useState(false);
  const [switching, setSwitching] = useState(false);
  // Zero-friction autoplay: always start muted (browsers never block that) and show a big "sound on" button.
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [voice, setVoice] = useStored("tv-voice", true);
  /** The watch buddy in the corner (full screen and theatre). */
  const [buddyOn, setBuddyOn] = useStored("tv-buddy", true);
  /** Desktop: the chat column (collapsible). */
  const [chatOpen, setChatOpen] = useStored("tv-chat-col", true);
  /** Phones: the full chat sheet over the TikTok-style overlay. */
  const [composer, setComposer] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [sheet, setSheet] = useState<null | "order" | "ticker" | "superchat">(null);
  const [game, setGame] = useState(false);
  const [gold, setGold] = useState(viewer.gold);
  const [sleepMin, setSleepMin] = useState<number>(0);
  const [asleep, setAsleep] = useState(false);
  const [prevChannel, setPrevChannel] = useState<string | null>(null);
  const [coins, setCoins] = useState(viewer.coins);
  const [osd, setOsd] = useState(true);
  const [idle, setIdle] = useState(false);
  const [fs, setFs] = useState(false);
  const [items, setItems] = useState<StripItem[]>(strip);
  const root = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const digits = useRef("");
  const [typed, setTyped] = useState("");
  /** Bumped to re-run the "next slot" timer when the server still reported the old slot. */
  const [retry, setRetry] = useState(0);
  const digitTimer = useRef(0);
  const videoTime = useRef(0);

  const channel = data.channel;
  const slot = data.slot;
  const social = !viewer.kids && !channel.familyOnly;
  const clock: Clock = useCallback(() => Date.now() + skew.current, []);
  // Hard login wall: a guest watches 60 s for free, then the picture freezes until sign-in.
  const walled = useGuestWall(!viewer.loggedIn, !asleep);
  const [goldPing, setGoldPing] = useState<{ amount: number; n: number } | null>(null);
  const onGold = useCallback(
    (earned: number, total?: number | null) => {
      setGold((g) => (total ?? g + earned));
      if (earned > 0) setGoldPing((p) => ({ amount: earned, n: (p?.n ?? 0) + 1 }));
      toast(fmt(t.tv.live2.goldWatch, { n: earned }), "coin");
    },
    [toast, t.tv.live2.goldWatch],
  );
  const chat = useTvLive(channel.slug, onGold);
  const floating = useFloating(chat.reactions);
  const addGold = useCallback((n: number) => setGold((g) => g + n), []);
  const onQuizAnswered = useQuizResults(slot.id, addGold);
  const shoutouts = useMemo(
    () => [...(chat.pinned ? [`${chat.pinned.name}: ${chat.pinned.text}`] : []), ...chat.tickers.slice(-3).map((x) => `${x.name}: ${x.text}`)],
    [chat.pinned, chat.tickers],
  );
  const [lastReaction, setLastReaction] = useState<{ emoji: string; n: number } | null>(null);
  const react = useCallback(
    (e: string) => {
      setLastReaction((r) => ({ emoji: e, n: (r?.n ?? 0) + 1 }));
      floating.add(e);
      void reactTvAction(channel.slug, e, viewerKey());
    },
    [floating, channel.slug],
  );

  // Server clock: everyone sees the same second of the broadcast.
  useEffect(() => {
    skew.current = initial.serverNow - Date.now();
  }, [initial.serverNow]);

  // Power-on animation after a switch elsewhere; sound stays on within a session once allowed; ?order=1 opens the order sheet.
  useEffect(() => {
    let boot = false;
    let sound = false;
    try {
      boot = sessionStorage.getItem("tv-boot") === "1";
      sessionStorage.removeItem("tv-boot");
      sound = sessionStorage.getItem("tv-sound") === "1";
    } catch {}
    const order = new URLSearchParams(window.location.search).get("order") === "1";
    const id = window.setTimeout(() => {
      if (boot) setBooting(true);
      if (sound && viewer.loggedIn) setMuted(false);
      if (order && social) setSheet("order");
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async (slug: string) => {
    const res = await fetch(`/api/tv/${slug}/now`, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const d = (await res.json()) as TvNowDTO;
    skew.current = d.serverNow - Date.now();
    return d;
  }, []);

  // Next slot: fetch exactly when the current one ends (retry if the server still says the old one).
  useEffect(() => {
    const end = slot.startsAt + slot.durationSec * 1000;
    const wait = Math.max(300, end - clock() + 150);
    const id = window.setTimeout(async () => {
      try {
        const d = await load(channel.slug);
        setData((cur) => (cur.channel.slug === d.channel.slug ? d : cur));
        if (d.slot.id === slot.id) window.setTimeout(() => setRetry((r) => r + 1), 1000);
      } catch {
        window.setTimeout(() => setRetry((r) => r + 1), 3000);
      }
    }, wait);
    return () => clearTimeout(id);
  }, [slot.id, slot.startsAt, slot.durationSec, channel.slug, clock, load, retry]);

  // The control room can change the grid (break-in, panic): refresh "now" every 20 s and when coming back.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      load(channel.slug)
        .then((d) => setData((cur) => (cur.channel.slug === d.channel.slug && (cur.slot.id !== d.slot.id || cur.slot.durationSec !== d.slot.durationSec) ? d : cur)))
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", refresh);
    const id = window.setInterval(refresh, 20_000);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      clearInterval(id);
    };
  }, [channel.slug, load]);

  // Embedded: keep the "other channels" row fresh.
  useEffect(() => {
    if (!embedded) return;
    const id = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/tv/guide", { cache: "no-store" });
        if (!res.ok) return;
        const d = (await res.json()) as { items: { channel: TvChannelDTO; program: TvSlotDTO | null }[] };
        setItems(d.items.map((x) => ({ slug: x.channel.slug, number: x.channel.number, name: x.channel.name, hue: x.channel.hue, title: x.program ? stripTitle(x.program) : x.channel.tagline })));
      } catch {}
    }, 60_000);
    return () => clearInterval(id);
  }, [embedded]);

  // OSD (channel number) fades out a few seconds after a switch.
  useEffect(() => {
    const show = window.setTimeout(() => setOsd(true), 0);
    const hide = window.setTimeout(() => setOsd(false), 4500);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [channel.slug]);

  const tune = useCallback(
    async (slug: string) => {
      if (slug === channel.slug) return;
      setSwitching(true);
      setGuideOpen(false);
      try {
        document.cookie = `mirage_tv_ch=${slug}; path=/; max-age=${30 * 86400}; samesite=lax`;
        const [d] = await Promise.all([load(slug), new Promise((r) => setTimeout(r, 380))]);
        setPrevChannel(channel.slug);
        setData(d);
        if (!embedded) window.history.replaceState(null, "", `/tv/${slug}`);
        else playerRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      } catch {
        toast(t.common.error, "error");
      } finally {
        setSwitching(false);
      }
    },
    [channel.slug, load, t.common.error, toast, embedded],
  );

  const step = useCallback(
    (dir: 1 | -1) => {
      const i = channels.findIndex((c) => c.slug === channel.slug);
      const next = channels[(i + dir + channels.length) % channels.length];
      if (next) void tune(next.slug);
    },
    [channels, channel.slug, tune],
  );

  const toggleFs = useCallback(() => {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      orientation?.unlock?.();
      return;
    }
    const el = embedded ? playerRef.current : root.current;
    if (el?.requestFullscreen) {
      void el
        .requestFullscreen()
        .then(() => {
          // phones: a horizontal show turns the screen sideways, like YouTube
          if (matchMedia("(pointer: coarse)").matches && slot.video?.orientation !== "VERTICAL") return orientation?.lock?.("landscape");
        })
        .catch(() => {});
    } else {
      // iPhone Safari: only a <video> can go fullscreen
      (el?.querySelector("video") as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null)?.webkitEnterFullscreen?.();
    }
  }, [embedded, slot.video?.orientation]);

  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  const unmute = useCallback(() => {
    setMuted(false);
    try {
      sessionStorage.setItem("tv-sound", "1");
    } catch {}
  }, []);
  const onBlocked = useCallback(() => setMuted(true), []);

  // Remote control on the keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (walled || el.closest("input,textarea,[role=dialog]") || e.metaKey || e.ctrlKey || e.altKey) return;
      // On the home page the arrows keep scrolling; ←/→ switch channels there.
      const upKeys = embedded ? ["ArrowRight"] : ["ArrowUp", "PageUp"];
      const downKeys = embedded ? ["ArrowLeft"] : ["ArrowDown", "PageDown"];
      if (upKeys.includes(e.key)) {
        e.preventDefault();
        step(1);
      } else if (downKeys.includes(e.key)) {
        e.preventDefault();
        step(-1);
      } else if (e.key === "m" || e.key === "M" || e.key === "ь" || e.key === "Ь") {
        if (muted) unmute();
        else setMuted(true);
      } else if (e.key === "f" || e.key === "F" || e.key === "а" || e.key === "А") toggleFs();
      else if (e.key === "g" || e.key === "G" || e.key === "п" || e.key === "П") setGuideOpen((o) => !o);
      else if ((e.key === "c" || e.key === "C" || e.key === "с" || e.key === "С") && social) setChatOpen(!chatOpen);
      else if (e.key === "Backspace" && prevChannel) void tune(prevChannel);
      else if (/^\d$/.test(e.key)) {
        // Typing a channel number, like on a real remote.
        digits.current = (digits.current + e.key).slice(-2);
        setTyped(digits.current);
        setOsd(true);
        clearTimeout(digitTimer.current);
        digitTimer.current = window.setTimeout(() => {
          const n = Number(digits.current);
          digits.current = "";
          setTyped("");
          const c = channels.find((x) => x.number === n);
          if (c) void tune(c.slug);
        }, 1100);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, muted, unmute, toggleFs, social, channels, tune, prevChannel, embedded, walled, chatOpen, setChatOpen]);

  // Hide the controls when the mouse rests; on a phone a tap brings them back (like any video player).
  useEffect(() => {
    let id = 0;
    const wake = () => {
      setIdle(false);
      clearTimeout(id);
      id = window.setTimeout(() => setIdle(true), 3000);
    };
    wake();
    window.addEventListener("mousemove", wake);
    window.addEventListener("keydown", wake);
    window.addEventListener("touchstart", wake, { passive: true });
    return () => {
      clearTimeout(id);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("keydown", wake);
      window.removeEventListener("touchstart", wake);
    };
  }, []);

  // Swipe up/down on the picture switches channels (theatre on phones; not on the home page where it would fight scrolling).
  const touch = useRef<{ y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => (touch.current = { y: e.touches[0].clientY, t: Date.now() });
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    if (embedded || !s || Date.now() - s.t > 600) return;
    const dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dy) > 70) step(dy < 0 ? 1 : -1);
  };

  // Sleep timer: after N minutes the picture fades to "Good night" and the sound stops.
  useEffect(() => {
    if (!sleepMin) return;
    const id = window.setTimeout(() => {
      setAsleep(true);
      setMuted(true);
      setSleepMin(0);
    }, sleepMin * 60_000);
    return () => clearTimeout(id);
  }, [sleepMin]);
  const cycleSleep = () => {
    const i = SLEEP_STEPS.indexOf(sleepMin as (typeof SLEEP_STEPS)[number]);
    const next = SLEEP_STEPS[(i + 1) % SLEEP_STEPS.length];
    setSleepMin(next);
    toast(next ? fmt(t.tv.live2.sleepSet, { m: next }) : t.tv.live2.sleepOff);
  };

  const mute24h = useCallback(
    async (messageId: string) => {
      const r = await muteFromChatAction(messageId);
      toast(r.ok ? "Muted 24h" : t.common.error, r.ok ? "ok" : "error");
    },
    [toast, t.common.error],
  );

  const like = useCallback(async () => {
    if (!viewer.loggedIn) return toast(t.tv.chat.login, "error");
    if (!slot.clipId) return;
    const r = await toggleTvLikeAction(slot.clipId);
    if (r.ok) setData((d) => (d.slot.clipId === slot.clipId ? { ...d, slot: { ...d.slot, liked: r.liked, likes: r.likes } as TvSlotDTO } : d));
  }, [viewer.loggedIn, slot.clipId, toast, t.tv.chat.login]);

  const clockText = useClockText(clock);
  const hideUi = idle && !guideOpen && !sheet;
  const silent = muted || walled || asleep;
  const sheetProps = useMemo(
    () => ({ slug: channel.slug, loggedIn: viewer.loggedIn, coins, onCoins: setCoins, userName: viewer.name }),
    [channel.slug, viewer.loggedIn, coins, viewer.name],
  );
  const openOrder = () => setSheet("order");
  const tickerOn = channel.ticker && social;

  const chatProps = {
    slug: channel.slug,
    messages: chat.messages,
    loggedIn: viewer.loggedIn,
    onSent: chat.reload,
    onSuperchat: () => setSheet("superchat"),
    pinned: chat.pinned,
    isAdmin: viewer.admin,
    onMute: mute24h,
    onReact: react,
    coins: viewer.loggedIn ? coins : undefined,
    onCoins: setCoins,
  };

  // ───── the picture with everything layered over it (shared by both layouts) ─────
  const picture = (
    <>
      <div className="tv-scanlines tv-vignette absolute inset-0">
        <Stage
          slot={slot}
          channel={channel}
          clock={clock}
          muted={silent}
          volume={volume}
          kids={viewer.kids}
          onBlocked={onBlocked}
          onOrder={openOrder}
          onLike={like}
          loggedIn={viewer.loggedIn}
          onQuizAnswered={onQuizAnswered}
          shoutouts={social ? shoutouts : []}
          onGame={() => setGame(true)}
          frozen={walled}
          timeRef={videoTime}
          speak={!silent && voice}
          minimal={embedded}
        />
      </div>
      {silent && !walled && slot.video && <LiveCaptions key={slot.id} slot={slot} timeRef={videoTime} compact={embedded} />}
      {social && <ReactionsLayer items={floating.items} />}
      {social && <PinnedBanner pinned={chat.pinned} />}
      {!walled && slot.series && <FunnelCta key={slot.id} slot={slot} clock={clock} channel={channel.slug} corner={!embedded} />}
      {social && chat.poll && slot.kind !== "QUIZ" && (
        <div className={clsx("absolute right-3 z-[18] transition-opacity md:right-6", embedded ? "top-14" : "top-[max(76px,calc(env(safe-area-inset-top)+70px))] md:right-8 md:top-24", chat.pinned && "max-md:top-[150px]")}>
          <PollCard key={chat.poll.id} poll={chat.poll} clock={clock} loggedIn={viewer.loggedIn} onVoted={chat.setPoll} />
        </div>
      )}
      {!viewer.kids && <AlertsBar alerts={chat.alerts} top={embedded ? 0 : undefined} />}
      {!viewer.kids && chat.pip && slot.kind !== "NEWS" && !walled && <PipMascot pip={chat.pip} clock={clock} speak={!silent && voice} />}
      {buddyOn && (fs || !embedded) && !walled && !asleep && (
        <BuddyCompanion
          buddy={buddyDef(viewer.buddy?.buddy ?? "").id}
          outfit={viewer.buddy?.outfit ?? {}}
          slot={slot}
          channelKind={channel.kind}
          reaction={lastReaction}
          gold={goldPing}
          messages={chat.messages}
          controls={!hideUi}
          makeRoom={!!chat.pip && slot.kind !== "NEWS"}
          onHide={() => setBuddyOn(false)}
          className={embedded ? "bottom-[calc(var(--tv-ui-full)+6px)]" : "bottom-[calc(var(--tv-ui-full)+64px)] md:bottom-[calc(var(--tv-ui-full)+6px)]"}
        />
      )}
      {switching && (
        <div className="absolute inset-0 z-[30] bg-black">
          <Noise />
        </div>
      )}
      {muted && !walled && !asleep && (
        <div className={clsx("absolute inset-x-0 z-[25] flex justify-center", slot.kind === "HOST" || slot.kind === "NEWS" || slot.kind === "CHART" ? "top-[16%] md:top-[12%]" : "top-[38%] md:top-[42%]")}>
          <UnmuteButton onClick={unmute} />
        </div>
      )}
      {/* Phones & tablets: TikTok-live chat over the picture */}
      {social && !composer && !walled && <ChatOverlay messages={chat.messages} onWrite={() => setComposer(true)} onReact={react} lift={embedded ? 12 : 172} />}
      <Guide open={guideOpen} onClose={() => setGuideOpen(false)} current={channel} next={data.next} clock={clock} onPick={tune} />
      {walled && <div aria-hidden className="absolute inset-0 z-[60] bg-black/30 backdrop-blur-[16px]" />}
    </>
  );

  const mobileComposer = social && composer && (
    <ChatPanel {...chatProps} onClose={() => setComposer(false)} className="animate-fade-up fixed inset-x-0 bottom-0 z-[55] h-[62dvh] rounded-t-2xl border-t border-white/10 !bg-[#0e0e10]/90 backdrop-blur-xl lg:hidden" />
  );

  const sheets = (
    <>
      {social && (
        <>
          <OrderSheet open={sheet === "order"} onClose={() => setSheet(null)} {...sheetProps} />
          <TickerSheet open={sheet === "ticker"} onClose={() => setSheet(null)} {...sheetProps} onSent={chat.reload} />
          <SuperchatSheet open={sheet === "superchat"} onClose={() => setSheet(null)} slug={channel.slug} loggedIn={viewer.loggedIn} coins={coins} onCoins={setCoins} />
        </>
      )}
      <GameOverlay open={game} onClose={() => setGame(false)} loggedIn={viewer.loggedIn} onGold={addGold} />
      {asleep && <SleepScreen onWake={() => (setAsleep(false), unmute())} />}
      <HardLoginWall open={walled} />
    </>
  );

  // ───────────── home page: stream layout ─────────────
  if (embedded) {
    return (
      <div ref={root} className="flex w-full select-none bg-bg" style={{ ["--tv-ui-full" as string]: `${(tickerOn ? 38 : 0) + 56}px`, ["--tv-ui-idle" as string]: `${tickerOn ? 38 : 0}px`, ["--tv-react" as string]: "0px" }}>
        <div className="min-w-0 flex-1">
          <div
            ref={playerRef}
            className={clsx("tv-root group/player relative w-full overflow-hidden bg-black max-lg:h-[64dvh] lg:aspect-video lg:max-h-[calc(100dvh-var(--header-h)-118px)]", booting && "tv-power-on", hideUi && "tv-idle cursor-none")}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {picture}
            {/* Top-left: LIVE + channel number (big for a moment after a switch) */}
            <div className={clsx("pointer-events-none absolute left-3 top-3 z-[20] flex items-start gap-2 transition-opacity duration-500 md:left-4 md:top-4", hideUi && !osd && "opacity-0")}>
              <span className="rounded bg-[#e91916] px-1.5 py-0.5 text-xs font-black uppercase tracking-wider text-white">{t.tv.live}</span>
              <div className="tv-flicker">
                <div className={clsx("tv-osd leading-none transition-all duration-500", osd ? "text-4xl md:text-5xl" : "text-2xl")}>{typed ? typed.padEnd(2, "-") : String(channel.number).padStart(2, "0")}</div>
                {osd && <div className="tv-osd mt-0.5 text-base uppercase">{channel.name}</div>}
              </div>
            </div>
            {/* Desktop: chat collapsed → bring it back from the corner of the player */}
            {social && !chatOpen && (
              <button type="button" onClick={() => setChatOpen(true)} aria-label={t.v3.live.showChat} title={t.v3.live.showChat} className="absolute right-3 top-3 z-[21] hidden h-10 w-10 items-center justify-center rounded-lg bg-black/60 text-white ring-1 ring-white/15 backdrop-blur hover:bg-black/80 lg:flex">
                <MessageCircle size={19} />
              </button>
            )}
            {/* Bottom: music ticker + hover control bar */}
            <div className="absolute inset-x-0 bottom-0 z-[20]">
              {tickerOn && <TickerBar items={chat.tickers} onCompose={() => setSheet("ticker")} />}
              <div className={clsx("flex items-center gap-1 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-2 pb-2 pt-6 transition-opacity duration-300 md:px-3", hideUi && "pointer-events-none opacity-0")}>
                <CtrlBtn label={t.tv.chDown} onClick={() => step(-1)}>
                  <ChevronDown size={20} />
                </CtrlBtn>
                <span className="tv-osd w-7 text-center text-xl">{String(channel.number).padStart(2, "0")}</span>
                <CtrlBtn label={t.tv.chUp} onClick={() => step(1)}>
                  <ChevronUp size={20} />
                </CtrlBtn>
                <CtrlBtn label={muted ? t.tv.unmute : t.tv.mute} onClick={() => (muted ? unmute() : setMuted(true))}>
                  {muted || volume === 0 ? <VolumeX size={20} /> : volume < 0.5 ? <Volume1 size={20} /> : <Volume2 size={20} />}
                </CtrlBtn>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setVolume(v);
                    if (v > 0 && muted) unmute();
                    if (v === 0) setMuted(true);
                  }}
                  aria-label={t.v3.home.volume}
                  className="mr-1 hidden h-1 w-20 accent-white md:block"
                />
                <CtrlBtn label={voice ? t.tv.voiceOn : t.tv.voiceOff} onClick={() => setVoice(!voice)} active={voice}>
                  {voice ? <Mic size={18} /> : <MicOff size={18} />}
                </CtrlBtn>
                {prevChannel && (
                  <CtrlBtn label={t.tv.live2.lastChannel} onClick={() => void tune(prevChannel)} className="max-sm:hidden">
                    <History size={18} />
                  </CtrlBtn>
                )}
                <span className="tv-osd ml-1 hidden items-center gap-1.5 text-lg md:flex">{clockText}</span>
                <div className="ml-auto flex items-center gap-1">
                  <CtrlBtn label={sleepMin ? fmt(t.tv.live2.sleepSet, { m: sleepMin }) : t.tv.live2.sleep} onClick={cycleSleep} active={!!sleepMin} className="max-sm:hidden">
                    <Moon size={17} />
                  </CtrlBtn>
                  <CtrlBtn label={t.tv.guide} onClick={() => setGuideOpen(true)}>
                    <LayoutList size={18} />
                  </CtrlBtn>
                  {fs && (
                    <CtrlBtn label={buddyOn ? t.buddy.hide : t.buddy.show} onClick={() => setBuddyOn(!buddyOn)} active={buddyOn}>
                      <Smile size={18} />
                    </CtrlBtn>
                  )}
                  <CtrlBtn label={fs ? t.tv.exitFullscreen : t.tv.fullscreen} onClick={toggleFs}>
                    {fs ? <Minimize size={18} /> : <Maximize size={18} />}
                  </CtrlBtn>
                </div>
              </div>
            </div>
          </div>
          <TvInfoBar channel={channel} slot={slot} next={data.next} clock={clock} viewers={chat.viewers} onOrder={openOrder} onGuide={() => setGuideOpen(true)} social={social} />
          {viewer.kids && <p className="px-4 pb-3 text-sm text-muted md:px-6">{t.tv.familyHint}</p>}
          <ChannelStrip items={items} current={channel.slug} onPick={(s) => void tune(s)} />
          {below}
        </div>
        {social && (
          <div className={clsx("sticky top-[var(--header-h)] hidden h-[calc(100dvh-var(--header-h))] shrink-0 overflow-hidden border-l border-white/10 transition-[width] duration-300 ease-out lg:block", chatOpen ? "w-[340px]" : "w-0 border-l-0")} aria-hidden={!chatOpen}>
            <ChatPanel {...chatProps} onClose={() => setChatOpen(false)} collapse className="h-full w-[340px]" />
          </div>
        )}
        {mobileComposer}
        {sheets}
      </div>
    );
  }

  // ───────────── /tv/[slug]: full-screen theatre ─────────────
  return (
    <div
      ref={root}
      className={clsx("tv-root fixed inset-0 flex select-none overflow-hidden bg-black", hideUi && "tv-idle cursor-none")}
      style={{
        ["--tv-ui-full" as string]: `${(tickerOn ? 38 : 0) + 62}px`,
        ["--tv-ui-idle" as string]: `${tickerOn ? 38 : 0}px`,
        ["--tv-react" as string]: "0px",
      }}
    >
      <div className={clsx("relative min-w-0 flex-1", booting && "tv-power-on")} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {picture}

        {/* Top bar: channel OSD, clock, guide, exit */}
        <div className={clsx("absolute inset-x-0 top-0 z-[20] flex items-start justify-between gap-3 px-4 pt-[max(14px,env(safe-area-inset-top))] transition-opacity duration-500 md:px-8 md:pt-6", hideUi && !osd && "md:opacity-0")}>
          <div className="tv-flicker min-w-0">
            <div className={clsx("tv-osd leading-none transition-all duration-500", osd ? "text-5xl md:text-7xl" : "text-3xl md:text-4xl")}>
              {typed ? typed.padEnd(2, "-") : String(channel.number).padStart(2, "0")}
            </div>
            <div className={clsx("tv-osd mt-1 truncate uppercase transition-all duration-500", osd ? "text-xl opacity-100 md:text-2xl" : "text-base opacity-70")}>{channel.name}</div>
            {osd && channel.tagline && <div className="mt-1 hidden max-w-md text-sm text-white/70 md:block">{channel.tagline}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {chat.viewers > 0 && (
              <span className="flex h-10 items-center gap-1.5 rounded-full bg-black/55 px-3 text-sm font-semibold ring-1 ring-white/15 backdrop-blur" title={fmt(t.tv.live2.viewers, { n: chat.viewers })}>
                <Eye size={16} className="text-[#ff6b6b]" /> {chat.viewers}
              </span>
            )}
            {viewer.loggedIn && !viewer.kids && (
              <Link href="/me/wallet" title={t.tv.live2.gold} className="hidden h-10 items-center gap-1.5 rounded-full bg-black/55 px-3 text-sm font-semibold text-coin ring-1 ring-white/15 backdrop-blur sm:flex">
                <Gem size={15} /> {chat.gold ?? gold}
              </Link>
            )}
            <span className="tv-osd hidden items-center gap-1.5 text-2xl md:flex">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#ff3b3b] shadow-[0_0_10px_#ff3b3b]" />
              {t.tv.live} {clockText}
            </span>
            <IconBtn label={t.tv.guide} onClick={() => setGuideOpen(true)}>
              <LayoutList size={19} />
            </IconBtn>
            <Link href="/" aria-label={t.v3.nav.live} title={t.v3.nav.live} className="flex h-10 items-center gap-2 rounded-full bg-black/55 px-3.5 text-sm font-semibold ring-1 ring-white/15 backdrop-blur hover:bg-black/75">
              <Clapperboard size={17} /> <span className="hidden sm:inline">MIRAGE</span>
            </Link>
          </div>
        </div>

        {/* Desktop: chat collapsed → a floating button brings the column back */}
        {social && !chatOpen && (
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            aria-label={t.v3.live.showChat}
            title={t.v3.live.showChat}
            className="absolute bottom-[calc(var(--tv-ui-bottom,0px)+86px)] right-6 z-[21] hidden h-14 w-14 items-center justify-center rounded-full bg-[#9147ff] text-white shadow-[0_10px_40px_-8px_rgba(145,71,255,.7)] transition-transform hover:scale-105 lg:flex"
          >
            <MessageCircle size={24} />
          </button>
        )}

        {/* Bottom: ticker + remote */}
        <div className="absolute inset-x-0 bottom-0 z-[20] pb-[env(safe-area-inset-bottom)]">
          {tickerOn && <TickerBar items={chat.tickers} onCompose={() => setSheet("ticker")} />}
          <div className={clsx("flex items-center gap-2 bg-gradient-to-t from-black/90 to-black/40 px-3 py-2.5 transition-opacity duration-500 md:px-8", hideUi && "md:pointer-events-none md:opacity-0")}>
            <div className="flex items-center gap-1 rounded-full bg-white/[.07] p-1 ring-1 ring-white/10">
              <IconBtn label={t.tv.chDown} onClick={() => step(-1)} plain>
                <ChevronDown size={20} />
              </IconBtn>
              <span className="tv-osd w-8 text-center text-xl">{String(channel.number).padStart(2, "0")}</span>
              <IconBtn label={t.tv.chUp} onClick={() => step(1)} plain>
                <ChevronUp size={20} />
              </IconBtn>
            </div>
            {prevChannel && (
              <IconBtn label={t.tv.live2.lastChannel} onClick={() => void tune(prevChannel)} className="max-sm:hidden">
                <History size={18} />
              </IconBtn>
            )}
            <IconBtn label={muted ? t.tv.unmute : t.tv.mute} onClick={() => (muted ? unmute() : setMuted(true))}>
              {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
            </IconBtn>
            <IconBtn label={voice ? t.tv.voiceOn : t.tv.voiceOff} onClick={() => setVoice(!voice)} active={voice}>
              {voice ? <Mic size={18} /> : <MicOff size={18} />}
            </IconBtn>
            <IconBtn label={buddyOn ? t.buddy.hide : t.buddy.show} onClick={() => setBuddyOn(!buddyOn)} active={buddyOn}>
              <Smile size={19} />
            </IconBtn>
            <IconBtn label={fs ? t.tv.exitFullscreen : t.tv.fullscreen} onClick={toggleFs} className="max-sm:hidden">
              {fs ? <Minimize size={18} /> : <Maximize size={18} />}
            </IconBtn>
            <IconBtn label={sleepMin ? fmt(t.tv.live2.sleepSet, { m: sleepMin }) : t.tv.live2.sleep} onClick={cycleSleep} active={!!sleepMin} className="max-sm:hidden">
              <Moon size={17} />
            </IconBtn>
            <div className="ml-auto flex items-center gap-2">
              {social && (
                <button type="button" onClick={openOrder} title={t.v3.live.breakInHint} className="flex h-10 items-center gap-2 rounded-full bg-black/55 px-3.5 text-sm font-semibold ring-1 ring-white/15 backdrop-blur hover:bg-black/75">
                  <Sparkles size={16} className="text-coin" /> <span className="max-sm:hidden">{t.v3.home.order}</span>
                </button>
              )}
              {tickerOn && (
                <IconBtn label={t.tv.ticker.cta} onClick={() => setSheet("ticker")}>
                  <MessageSquareText size={18} />
                </IconBtn>
              )}
            </div>
          </div>
          {viewer.kids && <p className="bg-black/80 px-4 pb-2 text-center text-xs text-white/60">{t.tv.familyHint}</p>}
        </div>
      </div>

      {/* Desktop chat column: collapses smoothly, the picture takes the whole width */}
      {social && (
        <div className={clsx("hidden shrink-0 overflow-hidden transition-[width] duration-300 ease-out lg:block", chatOpen ? "w-[340px]" : "w-0")} aria-hidden={!chatOpen}>
          <ChatPanel {...chatProps} onClose={() => setChatOpen(false)} collapse className="h-full w-[340px] border-l border-white/10" />
        </div>
      )}
      {mobileComposer}
      {sheets}
    </div>
  );
}

function useClockText(clock: Clock) {
  const [s, setS] = useState("");
  useEffect(() => {
    const tick = () => setS(hhmm(clock()));
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 10_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [clock]);
  return s;
}

/** Player control (stream style: flat, white, square hover). */
function CtrlBtn({ label, onClick, children, active, className }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-white/15", active ? "text-[#7dffb2]" : "text-white", className)}>
      {children}
    </button>
  );
}

function IconBtn({ label, onClick, children, active, plain, className }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean; plain?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
        plain ? "hover:bg-white/10" : active ? "bg-[#7dffb2] text-black" : "bg-black/55 ring-1 ring-white/15 backdrop-blur hover:bg-black/75",
        className,
      )}
    >
      {children}
    </button>
  );
}
