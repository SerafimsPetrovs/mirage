import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { Flame, Upload } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { fmt, pick } from "@/i18n/shared";
import { channelBuffers, type ChannelBuffer } from "@/lib/tv-control";
import { btn } from "@/components/ui/button";
import { MascotAlert } from "@/components/studio-hub/mascot-alert";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.v3.studio.bounty.title };
}

const ZONE = {
  GREEN: { bar: "bg-[#3ddc84]", chip: "bg-[#3ddc84]/15 text-[#3ddc84] ring-[#3ddc84]/30", dot: "🟢" },
  YELLOW: { bar: "bg-[#ffc83d]", chip: "bg-[#ffc83d]/15 text-[#ffc83d] ring-[#ffc83d]/30", dot: "🟡" },
  RED: { bar: "bg-[#ff3b3b]", chip: "bg-[#ff3b3b]/15 text-[#ff6b6b] ring-[#ff3b3b]/40", dot: "🔴" },
} as const;

function Bar({ label, value, zone }: { label: string; value: number; zone: ChannelBuffer["zone"] }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="tabular-nums">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/8" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={clsx("h-full rounded-full", ZONE[zone].bar)} style={{ width: `${Math.max(3, value * 100)}%` }} />
      </div>
    </div>
  );
}

/** Bounty hub: how stocked every channel is for 24/48 h, and what a clip earns where. */
export default async function BountyPage() {
  const [{ t, locale }, buffers] = await Promise.all([getI18n(), channelBuffers()]);
  const b = t.v3.studio.bounty;
  const hot = buffers.filter((x) => x.zone === "RED");
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold">{b.title}</h1>
        <p className="mt-2 max-w-3xl text-muted">{b.sub}</p>
      </header>

      <MascotAlert
        hot={hot.length > 0}
        title={hot.length ? fmt(b.hotAlert, { channels: hot.map((h) => pick(h, "name", locale)).join(", ") }) : b.calm}
        text={hot.length ? fmt(b.hotAlertText, { m: Math.max(...hot.map((h) => h.shortMin)) }) : ""}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {buffers.map((c) => (
          <article key={c.channelId} className={clsx("rounded-3xl bg-surface p-5 ring-1 md:p-6", c.zone === "RED" ? "ring-[#ff3b3b]/50 shadow-[0_0_60px_-20px_rgba(255,59,59,.6)]" : "ring-line")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="tv-osd text-sm text-muted">CH {String(c.number).padStart(2, "0")}</div>
                <h2 className="truncate font-display text-xl font-bold">{pick(c, "name", locale)}</h2>
              </div>
              <span className={clsx("flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1", ZONE[c.zone].chip, c.zone === "RED" && "animate-pulse")}>
                {c.zone === "RED" ? <Flame size={13} /> : ZONE[c.zone].dot} {b.zones[c.zone]}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              <Bar label={b.h24} value={c.fill24} zone={c.zone} />
              <Bar label={b.h48} value={c.fill48} zone={c.zone} />
            </div>
            <p className="mt-3 text-sm text-muted">
              {fmt(b.fresh, { m: c.freshMin, t: c.targetMin })}
              {c.shortMin > 0 && <span className="text-[#ff8a8a]"> · {fmt(b.short, { m: c.shortMin })}</span>}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <div className="text-sm">
                {c.boosted && <div className="mb-0.5 font-bold text-[#ff6b6b]">🔥 {b.boosted}</div>}
                <span className="font-semibold">{b.rewards[c.zone]}</span>
              </div>
              <Link href={`/studio/tv?channel=${c.slug}`} className={btn(c.zone === "RED" ? "primary" : "glass", "sm")}>
                <Upload size={15} /> {b.upload}
              </Link>
            </div>
          </article>
        ))}
      </div>

      <section className="rounded-3xl bg-surface p-5 ring-1 ring-line md:p-6">
        <h2 className="font-display text-lg font-bold">{b.rulesTitle}</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
          {b.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
