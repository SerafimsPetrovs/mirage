import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { prisma } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { fmt, pick } from "@/i18n/shared";
import { channelDTO } from "@/lib/tv";
import { BROADCAST_DELAY_SEC } from "@/lib/tv-control";
import { LiveControl } from "@/components/control/live-control";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.v3.control.title };
}

/** Control room: master/public monitors with the broadcast delay, PANIC, queue, inserts, bounty x2, alerts, teleprompter. */
export default async function LiveControlPage({ searchParams }: { searchParams: Promise<{ ch?: string }> }) {
  const [{ t, locale }, sp] = await Promise.all([getI18n(), searchParams]);
  const c = t.v3.control;
  const channels = await prisma.tvChannel.findMany({ where: { active: true }, orderBy: { number: "asc" } });
  const ch = channels.find((x) => x.slug === sp.ch) ?? channels[0];
  if (!ch) return <p className="text-muted">{c.noSignal}</p>;
  const [clips, series, bank] = await Promise.all([
    prisma.tvClip.findMany({ where: { status: "APPROVED", kind: { in: ["SHOW", "MUSIC", "BUMPER", "AD"] } }, orderBy: { createdAt: "desc" }, take: 200, include: { channel: { select: { nameRu: true, nameEn: true } } } }),
    prisma.series.findMany({
      where: { status: "PUBLISHED", ...(ch.isAdult ? {} : { isAdult: false }), ...(ch.familyOnly ? { isFamilySafe: true } : {}) },
      orderBy: { views: "desc" },
      take: 40,
      select: { titleRu: true, titleEn: true, episodes: { orderBy: { number: "asc" }, take: 6, select: { id: true, number: true, durationSec: true } } },
    }),
    prisma.mascotClip.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const pool = [
    ...clips.map((x) => ({ type: "CLIP" as const, id: x.id, title: x.artist ? x.artist + " — " + x.title : x.title, sub: pick(x.channel, "name", locale), durationSec: x.durationSec })),
    ...series.flatMap((s) => s.episodes.map((e) => ({ type: "EPISODE" as const, id: e.id, title: pick(s, "title", locale) + " · " + e.number, sub: t.common.episode, durationSec: e.durationSec }))),
  ];
  return (
    <div className="space-y-6">
      <header>
        <h2 className="flex items-center gap-3 font-display text-2xl font-bold">
          <span className="h-3 w-3 animate-pulse rounded-full bg-[#ff3b3b] shadow-[0_0_12px_#ff3b3b]" /> {c.title}
        </h2>
        <p className="mt-1 text-muted">{fmt(c.sub, { s: BROADCAST_DELAY_SEC })}</p>
      </header>
      <nav className="flex flex-wrap gap-1.5" aria-label={c.channel}>
        {channels.map((x) => (
          <Link
            key={x.id}
            href={"/admin/live-control?ch=" + x.slug}
            className={clsx("flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-semibold", x.id === ch.id ? "bg-white text-black" : "bg-white/[.06] text-muted ring-1 ring-white/10 hover:text-text")}
          >
            <span className="tv-osd">{String(x.number).padStart(2, "0")}</span> {pick(x, "name", locale)}
          </Link>
        ))}
      </nav>
      <LiveControl
        key={ch.id}
        channel={channelDTO(ch, locale)}
        channelId={ch.id}
        pool={pool}
        bank={bank.map((b) => ({ id: b.id, emotion: b.emotion, durationMs: b.durationMs }))}
        tts={process.env.TTS_PROVIDER === "openai" && !!process.env.TTS_BASE_URL}
      />
    </div>
  );
}
