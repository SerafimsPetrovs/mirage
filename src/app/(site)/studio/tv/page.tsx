import clsx from "clsx";
import { Tv } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { pick } from "@/i18n/shared";
import { ClipForm } from "@/components/tv/tv-admin-ui";
import { channelBuffers } from "@/lib/tv-control";

const TONE: Record<string, string> = { PENDING: "bg-vip/15 text-vip", APPROVED: "bg-ok/15 text-ok", REJECTED: "bg-white/10 text-muted" };

/** Creators send shows, bumpers, fake ads and music videos to the TV channels. */
export default async function StudioTvPage({ searchParams }: { searchParams: Promise<{ channel?: string }> }) {
  const [{ t, locale }, user, sp] = await Promise.all([getI18n(), requireUser("/studio/tv"), searchParams]);
  const s = t.tv.studio;
  const [channels, mine, series, buffers] = await Promise.all([
    // Family and 18+ channels are filled by the platform only.
    prisma.tvChannel.findMany({ where: { active: true, familyOnly: false, isAdult: false }, orderBy: { number: "asc" } }),
    prisma.tvClip.findMany({ where: { creatorId: user.id, sponsorName: null }, orderBy: { createdAt: "desc" }, take: 30, include: { channel: true } }),
    prisma.series.findMany({ where: user.role === "ADMIN" ? {} : { creatorId: user.id }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, titleRu: true, titleEn: true } }),
    channelBuffers(),
  ]);
  const zoneOf = new Map(buffers.map((b) => [b.channelId, b.boosted ? "BOOST" : b.zone]));
  return (
    <div className="space-y-8">
      <header>
        <h1 className="flex items-center gap-3 font-display text-3xl font-bold">
          <Tv size={28} className="text-[#7dffb2]" /> {t.v3.studio.pool.title}
        </h1>
        <p className="mt-2 max-w-2xl text-muted">{t.v3.studio.pool.sub}</p>
      </header>
      <ClipForm
        admin={user.role === "ADMIN"}
        channels={channels.map((c) => ({ id: c.id, name: `${c.number} · ${pick(c, "name", locale)}`, zone: zoneOf.get(c.id) }))}
        series={series.map((x) => ({ id: x.id, title: pick(x, "title", locale) }))}
        initialChannel={channels.find((c) => c.slug === sp.channel)?.id}
      />
      <section>
        <h2 className="mb-3 font-display text-xl font-bold">{s.mine}</h2>
        {!mine.length ? (
          <p className="rounded-3xl bg-surface p-8 text-center text-muted ring-1 ring-line">{s.empty}</p>
        ) : (
          <ul className="divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">
            {mine.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-semibold">{c.artist ? `${c.artist} — ${c.title}` : c.title}</span>
                  <span className="text-muted">
                    {" "}
                    · {pick(c.channel, "name", locale)} · {t.tv.kinds[c.kind as keyof typeof t.tv.kinds]}
                  </span>
                </span>
                <span className={clsx("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", TONE[c.status])}>{s.status[c.status as keyof typeof s.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
