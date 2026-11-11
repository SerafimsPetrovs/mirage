import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { channelDTO, ensureDay, listChannels } from "@/lib/tv";
import { utcDay } from "@/lib/rewards";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: `${t.tv.guideTitle} · ${t.tv.brand}` };
}

type Row = { id: string; at: Date; title: string; kind: string };

/** The TV guide: every channel's next programmes (host bumpers and ad breaks left out). */
export default async function TvGuidePage() {
  const [{ t, locale }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  const channels = await listChannels(user);
  const now = new Date();
  await Promise.all(channels.map((c) => ensureDay(c, utcDay(now))));
  const rows = await Promise.all(
    channels.map(async (c) => {
      const slots = await prisma.tvSlot.findMany({
        where: { channelId: c.id, startsAt: { gte: new Date(now.getTime() - 3 * 3600_000), lte: new Date(now.getTime() + 6 * 3600_000) }, kind: { in: ["CLIP", "EPISODE", "CHART", "QUIZ"] } },
        orderBy: { startsAt: "asc" },
        include: { clip: { select: { title: true, artist: true } }, episode: { select: { number: true, series: { select: { titleRu: true, titleEn: true } } } } },
      });
      // Current programme + the next ones; consecutive repeats collapsed.
      const startIdx = Math.max(0, slots.findLastIndex((s) => s.startsAt <= now));
      const list: Row[] = [];
      for (const s of slots.slice(startIdx)) {
        const title =
          s.kind === "CHART"
            ? t.tv.chartTitle
            : s.kind === "QUIZ"
              ? t.tv.live2.quiz.title
              : s.clip
                ? s.clip.artist
                  ? `${s.clip.artist} — ${s.clip.title}`
                  : s.clip.title
                : s.episode
                  ? `${locale === "ru" ? s.episode.series.titleRu || s.episode.series.titleEn : s.episode.series.titleEn || s.episode.series.titleRu} · ${t.tv.episode.replace("{n}", String(s.episode.number))}`
                  : "";
        if (!title || list.at(-1)?.title === title) continue;
        list.push({ id: s.id, at: s.startsAt, title, kind: s.kind });
        if (list.length >= 10) break;
      }
      return { channel: channelDTO(c, locale), list };
    }),
  );
  const fmtTime = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="tv-root min-h-dvh px-4 pb-12 pt-[max(18px,env(safe-area-inset-top))] md:px-10 md:pt-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="tv-osd text-4xl uppercase md:text-6xl">{t.tv.guideTitle}</h1>
          <Link href="/tv" className="flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-semibold hover:bg-white/15">
            <ArrowLeft size={16} /> {t.tv.brand}
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {rows.map(({ channel: c, list }) => (
            <section key={c.slug} className="overflow-hidden rounded-3xl bg-white/[.04] ring-1 ring-white/10">
              <Link href={`/tv/${c.slug}`} className="flex items-center gap-3 px-4 py-3" style={{ background: `linear-gradient(90deg, hsl(${c.hue} 70% 22%), transparent)` }}>
                <span className="tv-osd text-3xl">{String(c.number).padStart(2, "0")}</span>
                <span className="min-w-0">
                  <span className="block truncate font-display font-bold">{c.name}</span>
                  <span className="block truncate text-xs text-white/60">{c.tagline}</span>
                </span>
              </Link>
              <ol className="px-2 pb-2">
                {list.map((r, i) => (
                  <li key={r.id} className={i === 0 ? "rounded-xl bg-[#7dffb2]/10 px-2 py-2" : "px-2 py-1.5"}>
                    <div className="flex gap-2.5 text-sm">
                      <span className="tv-osd w-12 shrink-0 text-base">{fmtTime.format(r.at)}</span>
                      <span className="min-w-0 flex-1 truncate text-white/85">
                        {i === 0 && <span className="mr-1.5 rounded bg-[#ff3b3b] px-1 py-px text-[10px] font-bold text-white">{t.tv.live}</span>}
                        {r.title}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
