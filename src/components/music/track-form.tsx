"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AudioLines, Check, Circle, Coins, Disc3, ImagePlus, Loader2, Mic2, Sparkles, Tv, Waves, X } from "lucide-react";
import { btn, inputCls, labelCls, textareaCls } from "@/components/ui/button";
import { Uploader } from "@/components/studio/uploader";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { createTrackAction } from "@/app/actions/music";
import { MUSIC_MAX_IMAGES, MUSIC_ORDER_PRICE, MUSIC_STYLES, type MusicStyle } from "@/lib/music-rules";

const STYLE_ICON: Record<MusicStyle, React.ReactNode> = {
  KARAOKE: <Mic2 size={20} />,
  BARS: <AudioLines size={20} />,
  WAVE: <Waves size={20} />,
  CIRCLE: <Circle size={20} />,
  CQT: <Disc3 size={20} />,
  VHS: <Tv size={20} />,
  SLIDESHOW: <ImagePlus size={20} />,
  AI: <Sparkles size={20} />,
};

/** Small CSS "thumbnail" so every style is recognisable before rendering. */
function StylePreview({ style }: { style: MusicStyle }) {
  const bars = [40, 70, 55, 90, 65, 35, 80, 50, 60, 30];
  return (
    <div className="relative h-14 w-full overflow-hidden rounded-xl bg-gradient-to-br from-[#2a1450] to-[#0d0718]">
      {style === "KARAOKE" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span className="h-1.5 w-16 rounded-full bg-gradient-to-r from-accent from-60% to-white/80 to-60%" />
          <span className="h-1 w-10 rounded-full bg-white/30" />
        </div>
      )}
      {(style === "BARS" || style === "CQT") && (
        <div className="absolute inset-x-2 bottom-0 flex items-end gap-[3px]">
          {bars.map((h, i) => (
            <span key={i} className={clsx("flex-1 rounded-t-sm", style === "CQT" ? "bg-gradient-to-t from-[#3ee6c8] to-[#ffc83d]" : "bg-accent")} style={{ height: `${h * (style === "CQT" ? 0.35 : 0.5)}px` }} />
          ))}
        </div>
      )}
      {style === "WAVE" && (
        <svg viewBox="0 0 100 40" className="absolute inset-0 h-full w-full" aria-hidden>
          <path d="M0 20 Q10 5 20 20 T40 20 T60 20 T80 20 T100 20" fill="none" stroke="#3ee6c8" strokeWidth="2.5" style={{ filter: "drop-shadow(0 0 4px #3ee6c8)" }} />
        </svg>
      )}
      {style === "CIRCLE" && (
        <svg viewBox="0 0 100 40" className="absolute inset-0 h-full w-full" aria-hidden>
          <ellipse cx="50" cy="20" rx="16" ry="14" fill="none" stroke="#ff2e63" strokeWidth="1.5" />
          <ellipse cx="50" cy="20" rx="12" ry="16" fill="none" stroke="#ff7aa0" strokeWidth="1" transform="rotate(30 50 20)" />
        </svg>
      )}
      {style === "VHS" && (
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,.35)_0_1px,transparent_1px_3px)]">
          <span className="absolute left-2 top-1.5 font-mono text-[10px] font-bold text-white/80">▶ PLAY</span>
        </div>
      )}
      {style === "SLIDESHOW" && (
        <div className="absolute inset-0 flex">
          <span className="flex-1 bg-gradient-to-br from-[#ffb547] to-[#ff2e63]" />
          <span className="flex-1 bg-gradient-to-br from-[#7c5cff] to-[#3ee6c8]" />
          <span className="flex-1 bg-gradient-to-br from-[#3ee6c8] to-[#1d1747]" />
        </div>
      )}
      {style === "AI" && <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,#ff2e63_0,transparent_45%),radial-gradient(circle_at_70%_60%,#7c5cff_0,transparent_50%)]" />}
    </div>
  );
}

export type ChannelOption = { id: string; name: string };

/**
 * New music track: song + cover (+ slideshow pictures) + lyrics + style.
 * `order` = a viewer pays MUSIC_ORDER_PRICE coins and the track goes to moderation; staff create a free draft.
 */
export function TrackForm({ channels, order, balance }: { channels: ChannelOption[]; order: boolean; balance: number }) {
  const { t } = useI18n();
  const m = t.music;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [audioRef, setAudio] = useState<string | null>(null);
  const [coverRef, setCover] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [style, setStyle] = useState<MusicStyle>("KARAOKE");
  const [orientation, setOrientation] = useState<"HORIZONTAL" | "VERTICAL">("HORIZONTAL");
  const [channelId, setChannel] = useState(channels[0]?.id ?? "");
  const [rights, setRights] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaderKey, setUploaderKey] = useState(0);

  const errText = (code: string) => (m.errors as Record<string, string>)[code] ?? t.common.error;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!audioRef) return setError(m.errors.needAudio);
    if (!rights) return setError(m.errors.RIGHTS);
    start(async () => {
      const r = await createTrackAction({ channelId, title, artist, audioRef, coverRef, images, lyrics, style, orientation, rightsOk: rights }, order);
      if (r.ok) router.push(`/music/${r.id}`);
      else setError(errText(r.error));
    });
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-[1fr_200px]">
        <div className="space-y-4">
          <div>
            <Uploader kind="audio" endpoint="/api/music/upload" accept=".mp3,.wav,.m4a,.ogg,.flac,audio/*" label={m.audio} onDone={setAudio} />
            <p className="mt-1.5 text-xs text-muted">{m.audioHint}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="mt-title" className={labelCls}>{m.title}</label>
              <input id="mt-title" required minLength={2} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="mt-artist" className={labelCls}>{m.artist}</label>
              <input id="mt-artist" maxLength={80} value={artist} onChange={(e) => setArtist(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>
        <div>
          <Uploader kind="image" endpoint="/api/music/upload" accept="image/*" label={m.cover} onDone={setCover} aspect="aspect-square" />
          <p className="mt-1.5 text-xs text-muted">{m.coverHint}</p>
        </div>
      </div>

      <fieldset>
        <legend className={labelCls}>{m.style}</legend>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {MUSIC_STYLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStyle(s)}
              aria-pressed={style === s}
              className={clsx(
                "rounded-2xl bg-surface-2 p-2.5 text-left ring-1 transition",
                style === s ? "ring-2 ring-accent" : "ring-line hover:ring-white/25",
              )}
            >
              <StylePreview style={s} />
              <span className="mt-2 flex items-center gap-1.5 text-sm font-semibold">
                {STYLE_ICON[s]} {m.styles[s]}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-muted">{m.styleHints[s]}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {(style === "SLIDESHOW" || style === "AI") && (
        <div>
          <p className={labelCls}>{m.images}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {images.map((ref, i) => (
              <div key={ref} className="relative aspect-square overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/media/${ref.slice("storage:".length)}`} alt={`${m.images} ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((x) => x.filter((r) => r !== ref))}
                  aria-label={t.common.delete}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {images.length < MUSIC_MAX_IMAGES && (
              <Uploader
                key={uploaderKey}
                kind="image"
                endpoint="/api/music/upload"
                accept="image/*"
                label=""
                aspect="aspect-square"
                onDone={(ref) => {
                  setImages((x) => [...x, ref].slice(0, MUSIC_MAX_IMAGES));
                  setUploaderKey((k) => k + 1);
                }}
              />
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted">{m.imagesHint}</p>
        </div>
      )}

      <div>
        <label htmlFor="mt-lyrics" className={labelCls}>{m.lyrics}</label>
        <textarea id="mt-lyrics" rows={7} maxLength={8000} value={lyrics} onChange={(e) => setLyrics(e.target.value)} className={textareaCls} />
        <p className="mt-1.5 text-xs text-muted">{m.lyricsHint}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {!order && channels.length > 1 && (
          <div>
            <label htmlFor="mt-ch" className={labelCls}>{m.channel}</label>
            <select id="mt-ch" value={channelId} onChange={(e) => setChannel(e.target.value)} className={inputCls}>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
        <fieldset>
          <legend className={labelCls}>{m.orientation}</legend>
          <div className="flex gap-2">
            {(["HORIZONTAL", "VERTICAL"] as const).map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={orientation === o}
                onClick={() => setOrientation(o)}
                className={clsx("h-12 flex-1 rounded-2xl px-3 text-sm ring-1 transition", orientation === o ? "bg-white text-black ring-white" : "bg-surface-2 text-muted ring-line hover:text-text")}
              >
                {o === "HORIZONTAL" ? m.horizontal : m.vertical}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl bg-surface-2 p-4 text-sm leading-relaxed ring-1 ring-line">
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]" />
        <span>{m.rights}</span>
      </label>

      {order && <p className="flex items-center gap-2 text-sm text-coin"><Coins size={16} /> {fmt(m.orderPrice, { price: MUSIC_ORDER_PRICE })}</p>}
      {error && (
        <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}
      <button disabled={pending || !audioRef || (order && balance < MUSIC_ORDER_PRICE)} className={btn(order ? "coin" : "primary", "lg", "w-full sm:w-auto")}>
        {pending ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
        {order ? fmt(m.createOrder, { price: MUSIC_ORDER_PRICE }) : m.create}
      </button>
    </form>
  );
}
