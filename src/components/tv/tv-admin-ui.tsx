"use client";
import clsx from "clsx";
import { fmt } from "@/i18n/shared";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, EyeOff, RefreshCw, X } from "lucide-react";
import { btn } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { Uploader } from "@/components/studio/uploader";
import { createTvClipAction, hideTvItemAction, moderateTvClipAction, moderateTvOrderAction, rebuildTvChannelAction } from "@/app/actions/tv-admin";

export function OrderModeration({ orderId }: { orderId: string }) {
  const { t } = useI18n();
  const a = t.tv.admin;
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reason, setReason] = useState("");
  const run = (decision: "approve" | "reject") =>
    start(async () => {
      const r = await moderateTvOrderAction(orderId, decision, reason);
      if (!r.ok) toast(t.common.error, "error");
      router.refresh();
    });
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={a.rejectReason} aria-label={a.rejectReason} className="h-9 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-sm" />
      <button type="button" disabled={pending} onClick={() => run("approve")} className={btn("primary", "sm")}>
        <Check size={15} /> {a.approve}
      </button>
      <button type="button" disabled={pending} onClick={() => run("reject")} className={btn("danger", "sm")}>
        <X size={15} /> {a.reject}
      </button>
    </div>
  );
}

export function ClipModeration({ clipId }: { clipId: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (d: "approve" | "reject") =>
    start(async () => {
      const r = await moderateTvClipAction(clipId, d);
      if (!r.ok) toast(t.common.error, "error");
      router.refresh();
    });
  return (
    <div className="mt-3 flex gap-2">
      <button type="button" disabled={pending} onClick={() => run("approve")} className={btn("primary", "sm")}>
        <Check size={15} /> {t.tv.admin.approve}
      </button>
      <button type="button" disabled={pending} onClick={() => run("reject")} className={btn("danger", "sm")}>
        <X size={15} /> {t.tv.admin.reject}
      </button>
    </div>
  );
}

export function RebuildButton({ channelId }: { channelId: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      title={t.tv.admin.rebuildHint}
      disabled={pending}
      onClick={() => start(async () => toast((await rebuildTvChannelAction(channelId)).ok ? t.tv.admin.rebuilt : t.common.error))}
      className={btn("glass", "sm")}
    >
      <RefreshCw size={14} className={pending ? "animate-spin" : ""} /> {t.tv.admin.rebuild}
    </button>
  );
}

export function HideButton({ kind, id }: { kind: "message" | "ticker"; id: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await hideTvItemAction(kind, id);
          router.refresh();
        })
      }
      aria-label={t.tv.admin.hide}
      title={t.tv.admin.hide}
      className="rounded-lg p-1.5 text-muted hover:bg-white/8 hover:text-text"
    >
      <EyeOff size={15} />
    </button>
  );
}

/** Upload form for a TV clip (studio: goes to moderation; admin: straight to the air). */
export function ClipForm({
  channels,
  admin,
  series = [],
  initialChannel,
}: {
  channels: { id: string; name: string; zone?: string }[];
  admin: boolean;
  series?: { id: string; title: string }[];
  initialChannel?: string;
}) {
  const { t } = useI18n();
  const s = t.tv.studio;
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [channelId, setChannelId] = useState(initialChannel && channels.some((c) => c.id === initialChannel) ? initialChannel : channels[0]?.id ?? "");
  const [seriesId, setSeriesId] = useState("");
  const [lore, setLore] = useState("");
  const [prompts, setPrompts] = useState("");
  const [aiTools, setAiTools] = useState("");
  const [tags, setTags] = useState("");
  const [ageRating, setAgeRating] = useState("12+");
  const [captions, setCaptions] = useState("");
  const p = t.v3.studio.pool;
  const zone = channels.find((c) => c.id === channelId)?.zone;
  const [kind, setKind] = useState<"SHOW" | "BUMPER" | "AD" | "MUSIC">("SHOW");
  const [orientation, setOrientation] = useState<"HORIZONTAL" | "VERTICAL">("HORIZONTAL");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [videoRef, setVideoRef] = useState("");
  const [formKey, setFormKey] = useState(0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await createTvClipAction({ channelId, kind, title, artist, videoRef, orientation, seriesId: seriesId || null, lore, prompts, aiTools, tags, ageRating, captions });
      if (r.ok) {
        toast(admin ? s.added : s.sent);
        setTitle("");
        setArtist("");
        setLore("");
        setPrompts("");
        setCaptions("");
        setVideoRef("");
        setFormKey((k) => k + 1);
        router.refresh();
      } else toast((s.errors as Record<string, string>)[r.error] ?? t.common.error, "error");
    });
  };

  const field = "h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-[15px]";
  return (
    <form onSubmit={submit} className="grid gap-4 rounded-3xl bg-surface p-5 ring-1 ring-line md:grid-cols-2 md:p-6">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">{s.channel}</span>
        <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className={field}>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.zone === "RED" || c.zone === "BOOST" ? "🔥 " : c.zone === "YELLOW" ? "🟡 " : ""}
              {c.name}
            </option>
          ))}
        </select>
        {zone && !admin && (
          <span className={clsx("mt-1.5 block text-xs font-semibold", zone === "RED" || zone === "BOOST" ? "text-[#ff8a8a]" : zone === "YELLOW" ? "text-coin" : "text-ok")}>
            {fmt(p.zoneNow, { zone: t.v3.studio.bounty.rewards[zone === "BOOST" ? "RED" : (zone as "GREEN" | "YELLOW" | "RED")] })}
          </span>
        )}
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">{s.kind}</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={field}>
          {(["SHOW", "BUMPER", "AD", "MUSIC"] as const).map((k) => (
            <option key={k} value={k}>
              {t.tv.kinds[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">{s.title2}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={field} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">{s.orientation}</span>
        <select value={orientation} onChange={(e) => setOrientation(e.target.value as typeof orientation)} className={field}>
          <option value="HORIZONTAL">{t.common.horizontal}</option>
          <option value="VERTICAL">{t.common.vertical}</option>
        </select>
      </label>
      {kind === "MUSIC" && (
        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-muted">{s.artist}</span>
          <input value={artist} onChange={(e) => setArtist(e.target.value)} maxLength={80} className={field} />
        </label>
      )}
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">{p.series}</span>
        <select value={seriesId} onChange={(e) => setSeriesId(e.target.value)} className={field}>
          <option value="">{p.noSeries}</option>
          {series.map((x) => (
            <option key={x.id} value={x.id}>
              {x.title}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-muted">{p.seriesHint}</span>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">{p.rating}</span>
        <select value={ageRating} onChange={(e) => setAgeRating(e.target.value)} className={field}>
          {["0+", "6+", "12+", "16+", "18+"].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <fieldset className="grid gap-4 rounded-2xl bg-surface-2/50 p-4 ring-1 ring-line md:col-span-2 md:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">{p.meta}</legend>
        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-muted">{p.lore}</span>
          <textarea value={lore} onChange={(e) => setLore(e.target.value)} maxLength={1000} rows={2} placeholder={p.lorePh} className={field + " h-auto py-2"} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">{p.tools}</span>
          <input value={aiTools} onChange={(e) => setAiTools(e.target.value)} maxLength={300} placeholder={p.toolsPh} className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">{p.tags}</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} maxLength={300} placeholder={p.tagsPh} className={field} />
        </label>
        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-muted">{p.prompts}</span>
          <textarea value={prompts} onChange={(e) => setPrompts(e.target.value)} maxLength={2000} rows={2} placeholder={p.promptsPh} className={field + " h-auto py-2"} />
        </label>
        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-muted">{p.captions}</span>
          <textarea value={captions} onChange={(e) => setCaptions(e.target.value)} maxLength={20000} rows={3} placeholder={p.captionsPh} className={field + " h-auto py-2 font-mono text-[13px]"} />
          <span className="mt-1 block text-xs text-muted">{p.captionsHint}</span>
        </label>
      </fieldset>
      <div className="md:col-span-2">
        <Uploader key={formKey} kind="video" accept="video/mp4,video/webm,video/quicktime" label={s.video} onDone={setVideoRef} />
      </div>
      <div className="md:col-span-2">
        <button type="submit" disabled={pending || !videoRef || title.trim().length < 2} className={btn("primary", "md")}>
          {admin ? s.submitAdmin : s.submit}
        </button>
      </div>
    </form>
  );
}
