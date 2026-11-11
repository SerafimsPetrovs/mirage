"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clapperboard, Pencil, Plus, Sparkles, Trash2, Tv, VolumeX, Wand2, Zap } from "lucide-react";
import { btn } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import {
  addIdeaAction,
  airIdeaAction,
  breakInAction,
  deleteIdeaAction,
  deleteTvClipAction,
  filmIdeaAction,
  muteTvUserAction,
  rewriteHostsAction,
  saveTvChannelAction,
  suggestIdeasAction,
  techBreakAction,
  updateTvClipAction,
} from "@/app/actions/tv-admin";

function useAdminAction() {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText?: string, errors?: Record<string, string>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        if (okText) toast(okText);
        router.refresh();
      } else toast((r.error && errors?.[r.error]) || t.common.error, "error");
    });
  return { pending, run, t };
}

export function MuteControls({ userId, compact, unmute }: { userId: string; compact?: boolean; unmute?: boolean }) {
  const { pending, run, t } = useAdminAction();
  const m = t.tv.adm2;
  if (unmute)
    return (
      <button type="button" disabled={pending} onClick={() => run(() => muteTvUserAction(userId, 0))} className={btn("glass", "sm")}>
        {m.unmute}
      </button>
    );
  const opts: [string, number | null][] = [
    [m.mute1h, 1],
    [m.mute24h, 24],
    [m.muteForever, null],
  ];
  return (
    <span className="flex items-center gap-0.5">
      {!compact && <VolumeX size={14} className="text-muted" />}
      {opts.map(([label, h]) => (
        <button
          key={label}
          type="button"
          disabled={pending}
          title={`Mute: ${label}`}
          onClick={() => run(() => muteTvUserAction(userId, h))}
          className="rounded-lg px-1.5 py-1 text-[11px] font-semibold text-red-300/80 hover:bg-red-500/10"
        >
          {label}
        </button>
      ))}
    </span>
  );
}

export type ChannelFormValue = {
  id?: string;
  slug: string;
  number: number;
  nameRu: string;
  nameEn: string;
  taglineRu: string;
  taglineEn: string;
  kind: string;
  genres: string;
  hue: number;
  hostName: string;
  hostPersona: string;
  familyOnly: boolean;
  isAdult: boolean;
  ticker: boolean;
  quiz: boolean;
  active: boolean;
  bufferTargetMin?: number;
};

const EMPTY_CHANNEL: ChannelFormValue = {
  slug: "",
  number: 10,
  nameRu: "",
  nameEn: "",
  taglineRu: "",
  taglineEn: "",
  kind: "ABSURD",
  genres: "",
  hue: 200,
  hostName: "",
  hostPersona: "",
  familyOnly: false,
  isAdult: false,
  ticker: false,
  quiz: true,
  active: true,
};

export function ChannelEditor({ initial }: { initial?: ChannelFormValue }) {
  const { pending, run, t } = useAdminAction();
  const m = t.tv.adm2;
  const [v, setV] = useState<ChannelFormValue>(initial ?? EMPTY_CHANNEL);
  const set = <K extends keyof ChannelFormValue>(k: K, x: ChannelFormValue[K]) => setV((o) => ({ ...o, [k]: x }));
  const field = "h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-[15px]";
  const text = (k: "slug" | "nameRu" | "nameEn" | "taglineRu" | "taglineEn" | "genres" | "hostName", max = 140) => (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{m.f[k]}</span>
      <input value={v[k]} maxLength={max} onChange={(e) => set(k, e.target.value)} className={field} />
    </label>
  );
  const flag = (k: "familyOnly" | "isAdult" | "ticker" | "quiz" | "active") => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={v[k]} onChange={(e) => set(k, e.target.checked)} className="h-4 w-4 accent-[#7dffb2]" /> {m.f[k]}
    </label>
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveTvChannelAction(v), m.channelSaved, { LIMIT: m.channelClash, STATE: m.channelClash });
      }}
      className="grid gap-4 rounded-3xl bg-surface p-5 ring-1 ring-line md:grid-cols-2 md:p-6"
    >
      {text("nameRu", 40)}
      {text("nameEn", 40)}
      {text("slug", 30)}
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">{m.f.number}</span>
        <input type="number" min={1} max={99} value={v.number} onChange={(e) => set("number", Number(e.target.value))} className={field} />
      </label>
      {text("taglineRu")}
      {text("taglineEn")}
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">{m.f.kind}</span>
        <select value={v.kind} onChange={(e) => set("kind", e.target.value)} className={field}>
          {Object.entries(m.kinds).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-muted">
          {m.f.hue} <span className="h-4 w-8 rounded" style={{ background: `hsl(${v.hue} 80% 55%)` }} />
        </span>
        <input type="range" min={0} max={360} value={v.hue} onChange={(e) => set("hue", Number(e.target.value))} className="h-11 w-full accent-[#7dffb2]" />
      </label>
      <div className="md:col-span-2">{text("genres", 300)}</div>
      {text("hostName", 40)}
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">{t.v3.studio.bounty.target}</span>
        <input type="number" min={1} max={1440} value={v.bufferTargetMin ?? 120} onChange={(e) => set("bufferTargetMin", Math.max(1, Number(e.target.value) || 1))} className={field} />
      </label>
      <label className="block md:col-span-2">
        <span className="mb-1.5 block text-sm font-medium text-muted">{m.f.hostPersona}</span>
        <textarea value={v.hostPersona} maxLength={600} rows={3} onChange={(e) => set("hostPersona", e.target.value)} className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-[15px]" />
      </label>
      <div className="flex flex-wrap gap-x-5 gap-y-2 md:col-span-2">
        {flag("active")}
        {flag("quiz")}
        {flag("ticker")}
        {flag("familyOnly")}
        {flag("isAdult")}
      </div>
      <div className="md:col-span-2">
        <button type="submit" disabled={pending || !v.nameEn || !v.slug || !v.hostName} className={btn("primary", "md")}>
          {m.channelSave}
        </button>
      </div>
    </form>
  );
}

export function RewriteButton({ channelId }: { channelId: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await rewriteHostsAction(channelId);
          const ok = r.ok && "rewritten" in r && r.rewritten;
          toast(r.ok ? (ok ? t.tv.adm2.rewritten : t.tv.adm2.rewriteFail) : t.common.error, ok ? "ok" : "error");
        })
      }
      className={btn("glass", "sm")}
    >
      <Sparkles size={14} className={pending ? "animate-pulse" : ""} /> {t.tv.adm2.rewrite}
    </button>
  );
}

export function TechBreakButton({ slotId }: { slotId: string }) {
  const { pending, run, t } = useAdminAction();
  return (
    <button type="button" disabled={pending} title={t.tv.adm2.techBreakHint} onClick={() => run(() => techBreakAction(slotId))} className="rounded-lg px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/10">
      {t.tv.adm2.techBreak}
    </button>
  );
}

export function BreakInButton({ clipId }: { clipId: string }) {
  const { pending, run, t } = useAdminAction();
  return (
    <button type="button" disabled={pending} title={t.tv.adm2.breakInHint} onClick={() => run(() => breakInAction(clipId), t.tv.adm2.breakInDone)} className={btn("glass", "sm")}>
      <Zap size={14} className="text-coin" /> {t.tv.adm2.breakIn}
    </button>
  );
}

export function ClipAdminActions({ clip }: { clip: { id: string; title: string; status: string } }) {
  const { pending, run, t } = useAdminAction();
  const m = t.tv.adm2;
  const [title, setTitle] = useState(clip.title);
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setEditing(false);
            run(() => updateTvClipAction(clip.id, { title }));
          }}
          className="flex gap-1.5"
        >
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} aria-label={m.rename} className="h-9 w-48 rounded-lg border border-line bg-surface-2 px-2 text-sm" />
          <button type="submit" aria-label={t.common.save} className={btn("primary", "sm")}>
            <Check size={14} />
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="rounded-lg p-1.5 text-muted hover:bg-white/8 hover:text-text" title={m.rename} aria-label={m.rename}>
          <Pencil size={14} />
        </button>
      )}
      {clip.status === "APPROVED" ? (
        <>
          <BreakInButton clipId={clip.id} />
          <button type="button" disabled={pending} onClick={() => run(() => updateTvClipAction(clip.id, { status: "REJECTED" }))} className="rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-white/8">
            {m.offAir}
          </button>
        </>
      ) : (
        <button type="button" disabled={pending} onClick={() => run(() => updateTvClipAction(clip.id, { status: "APPROVED" }))} className="rounded-lg px-2 py-1 text-xs font-semibold text-[#7dffb2] hover:bg-white/8">
          {m.toAir}
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => window.confirm(m.removeConfirm) && run(() => deleteTvClipAction(clip.id))}
        className="rounded-lg p-1.5 text-red-300/70 hover:bg-red-500/10 hover:text-red-300"
        title={m.remove}
        aria-label={m.remove}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function SuggestIdeasButton({ channelId }: { channelId: string }) {
  const { pending, run, t } = useAdminAction();
  return (
    <button type="button" disabled={pending} onClick={() => run(() => suggestIdeasAction(channelId), t.tv.adm2.suggested)} className={btn("vip", "md")}>
      <Wand2 size={17} className={pending ? "animate-spin" : ""} /> {t.tv.adm2.suggest}
    </button>
  );
}

export function IdeaForm({ channelId }: { channelId: string }) {
  const { pending, run, t } = useAdminAction();
  const m = t.tv.adm2;
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState("SHOW");
  const field = "h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-[15px]";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const r = await addIdeaAction(channelId, title, prompt, kind);
          if (r.ok) {
            setTitle("");
            setPrompt("");
          }
          return r;
        });
      }}
      className="grid gap-3 rounded-3xl bg-surface p-5 ring-1 ring-line md:grid-cols-[1fr_160px]"
    >
      <h3 className="font-semibold md:col-span-2">{m.ownIdea}</h3>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={m.ideaTitle} aria-label={m.ideaTitle} maxLength={120} className={field} />
      <select value={kind} onChange={(e) => setKind(e.target.value)} className={field} aria-label={t.tv.studio.kind}>
        {(["SHOW", "BUMPER", "AD", "MUSIC"] as const).map((k) => (
          <option key={k} value={k}>
            {t.tv.kinds[k]}
          </option>
        ))}
      </select>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={m.ideaPrompt} aria-label={m.ideaPrompt} maxLength={900} rows={2} className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-[15px] md:col-span-2" />
      <div>
        <button type="submit" disabled={pending || prompt.trim().length < 5} className={btn("primary", "md")}>
          <Plus size={16} /> {m.addIdea}
        </button>
      </div>
    </form>
  );
}

export function FactoryItemActions({ item }: { item: { id: string; status: string } }) {
  const { pending, run, t } = useAdminAction();
  const m = t.tv.adm2;
  return (
    <div className="flex flex-wrap gap-2">
      {(item.status === "DRAFT" || item.status === "FAILED") && (
        <button type="button" disabled={pending} onClick={() => run(() => filmIdeaAction(item.id))} className={btn("primary", "sm")}>
          <Clapperboard size={14} /> {m.film}
        </button>
      )}
      {item.status === "READY" && (
        <button type="button" disabled={pending} onClick={() => run(() => airIdeaAction(item.id))} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#7dffb2] px-3.5 text-sm font-semibold text-black">
          <Tv size={14} /> {m.air}
        </button>
      )}
      {item.status !== "ADDED" && item.status !== "GENERATING" && (
        <button type="button" disabled={pending} onClick={() => run(() => deleteIdeaAction(item.id))} className="rounded-lg p-2 text-red-300/70 hover:bg-red-500/10" aria-label={m.remove} title={m.remove}>
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

/** Refreshes the page every few seconds while something is being filmed. */
export function AutoRefresh({ active, ms = 6000 }: { active: boolean; ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => router.refresh(), ms);
    return () => clearInterval(id);
  }, [active, ms, router]);
  return null;
}
