"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowRight, Loader2, PartyPopper, Users } from "lucide-react";
import { btn, inputCls } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { createPartyAction } from "@/app/actions/party";
import { PARTY_CODE_RE } from "@/lib/party-rules";

/** "Watch together" button: creates a room for a channel or an episode and opens it. */
export function CreatePartyButton({ channelSlug, episodeId, className, compact = false, loggedIn = true }: { channelSlug?: string; episodeId?: string; className?: string; compact?: boolean; loggedIn?: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = () => {
    if (!loggedIn) return router.push(`/register?next=${encodeURIComponent("/party")}`);
    start(async () => {
      const r = await createPartyAction({ channelSlug, episodeId });
      if (r.ok) router.push(`/party/${r.code}`);
      else toast((t.party.errors as Record<string, string>)[r.error] ?? t.common.error, "error");
    });
  };
  return (
    <button type="button" onClick={go} disabled={pending} title={t.party.hubSub} className={className ?? clsx(btn("glass", compact ? "sm" : "md"))}>
      {pending ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} className="text-[#7dffb2]" />} {compact ? t.party.cta : t.party.nav}
    </button>
  );
}

/** Hub form: pick a channel, name the room, go. Plus "join by code". */
export function PartyHubForm({ channels }: { channels: { slug: string; label: string }[] }) {
  const { t } = useI18n();
  const p = t.party;
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [slug, setSlug] = useState(channels[0]?.slug ?? "");
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_280px]">
      <form
        className="rounded-3xl bg-surface p-5 ring-1 ring-line md:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await createPartyAction({ channelSlug: slug, title });
            if (r.ok) router.push(`/party/${r.code}`);
            else toast((p.errors as Record<string, string>)[r.error] ?? t.common.error, "error");
          });
        }}
      >
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <PartyPopper size={20} className="text-accent" /> {p.create}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-muted">
            {p.createTv}
            <select value={slug} onChange={(e) => setSlug(e.target.value)} className={inputCls + " mt-1.5"}>
              {channels.map((c) => (
                <option key={c.slug} value={c.slug}>{c.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-muted">
            {p.titlePh}
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} className={inputCls + " mt-1.5"} />
          </label>
        </div>
        <p className="mt-3 text-xs text-muted">{p.createHint}</p>
        <button disabled={pending || !slug} className={btn("primary", "md", "mt-4")}>
          {pending ? <Loader2 size={17} className="animate-spin" /> : <Users size={17} />} {p.create}
        </button>
      </form>
      <form
        className="rounded-3xl bg-surface p-5 ring-1 ring-line md:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          const c = code.trim().toUpperCase();
          if (PARTY_CODE_RE.test(c)) router.push(`/party/${c}`);
          else toast(p.errors.NOT_FOUND, "error");
        }}
      >
        <h2 className="font-display text-lg font-semibold">{p.code}</h2>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
          placeholder="ABC234"
          aria-label={p.code}
          className={inputCls + " mt-4 text-center font-mono text-lg uppercase tracking-[.4em]"}
        />
        <button className={btn("glass", "md", "mt-3 w-full")}>
          {p.open} <ArrowRight size={16} />
        </button>
      </form>
    </div>
  );
}
