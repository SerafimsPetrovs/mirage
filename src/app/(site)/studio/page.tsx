import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, Coins, Eye, Film, Plus, Unlock, Wand2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { CREATOR_SHARE } from "@/lib/access";
import { daysAgo, lastNDays } from "@/lib/rewards";
import { posterUrl } from "@/lib/poster";
import { mediaUrl } from "@/lib/files";
import { getI18n } from "@/i18n/server";
import { fmt, formatNumber, pick, plural } from "@/i18n/shared";
import { btn } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { StatusBadge } from "@/components/studio/status-badge";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.studio.title };
}

export default async function StudioPage() {
  const user = await requireRole(["CREATOR", "ADMIN"]);
  const { t, locale } = await getI18n();
  const series = await prisma.series.findMany({
    where: { creatorId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { episodes: true, listItems: true } } },
  });
  const ids = series.map((s) => s.id);
  const [earn, unlocks, earn30] = await Promise.all([
    prisma.creatorEarning.aggregate({ where: { creatorId: user.id }, _sum: { coins: true, credits: true } }),
    prisma.unlock.count({ where: { episode: { seriesId: { in: ids } } } }),
    prisma.creatorEarning.findMany({
      where: { creatorId: user.id, createdAt: { gte: daysAgo(14) } },
      select: { coins: true, createdAt: true },
    }),
  ]);
  const views = series.reduce((a, s) => a + s.views, 0);
  const lists = series.reduce((a, s) => a + s._count.listItems, 0);

  // Earnings per day for the last 14 days
  const days = lastNDays(14);
  const byDay = new Map(days.map((d) => [d, 0]));
  for (const e of earn30) {
    const k = e.createdAt.toISOString().slice(0, 10);
    if (byDay.has(k)) byDay.set(k, byDay.get(k)! + e.coins);
  }
  const maxDay = Math.max(1, ...byDay.values());

  const stats = [
    { label: t.studio.stats.views, value: formatNumber(views, locale), icon: Eye },
    { label: t.studio.stats.unlocks, value: formatNumber(unlocks, locale), icon: Unlock },
    { label: t.studio.cashEarnings, value: formatNumber(earn._sum.coins ?? 0, locale), icon: Coins, coin: true },
    { label: t.studio.creditEarnings, value: formatNumber(earn._sum.credits ?? 0, locale), icon: Wand2 },
    { label: t.studio.stats.followers, value: formatNumber(lists, locale), icon: Bookmark },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">{t.studio.title}</h1>
          <p className="mt-1 text-muted">{t.studio.sub}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/studio/generate" className={btn("vip", "md")}>
            <Wand2 size={18} /> {t.gen.nav}
          </Link>
          <Link href="/studio/series/new" className={btn("primary", "md")}>
            <Plus size={18} /> {t.studio.newSeries}
          </Link>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
        {stats.map(({ label, value, icon: Icon, coin }) => (
          <div key={label} className="rounded-3xl bg-surface p-4 ring-1 ring-line md:p-5">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Icon size={16} className={coin ? "text-coin" : ""} /> {label}
            </div>
            <p className={`mt-2 font-display text-2xl font-bold tabular-nums md:text-3xl ${coin ? "text-coin" : ""}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-3xl bg-surface p-5 ring-1 ring-line">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">{t.studio.cashEarnings} · 14d</p>
          <p className="max-w-xl text-xs text-muted">{fmt(t.studio.earningsSplit, { p: CREATOR_SHARE * 100 })}</p>
        </div>
        <div className="flex h-28 items-end gap-1.5" role="img" aria-label={`${t.studio.stats.earnings}: ${[...byDay.values()].join(", ")}`}>
          {days.map((d) => {
            const v = byDay.get(d)!;
            return (
              <div key={d} className="group relative flex h-full flex-1 flex-col justify-end">
                <div className="w-full rounded-t-md bg-coin/80 transition group-hover:bg-coin" style={{ height: `${Math.max(3, (v / maxDay) * 100)}%`, opacity: v ? 1 : 0.25 }} />
                <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded bg-surface-3 px-1.5 py-0.5 text-[11px] tabular-nums group-hover:block">{v}</span>
              </div>
            );
          })}
        </div>
      </div>

      <h2 className="mb-4 mt-10 font-display text-xl font-semibold">{t.studio.mySeries}</h2>
      {series.length === 0 ? (
        <EmptyState icon={<Film size={24} />} title={t.studio.noSeries} action={<Link href="/studio/series/new" className={btn("primary", "md")}><Plus size={18} /> {t.studio.newSeries}</Link>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {series.map((s) => (
            <Link key={s.id} href={`/studio/series/${s.id}`} className="flex gap-4 rounded-3xl bg-surface p-3 ring-1 ring-line transition hover:ring-white/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={posterUrl({ slug: s.slug, hue: s.hue, posterUrl: mediaUrl(s.posterUrl) })} alt="" className="aspect-[9/16] w-20 shrink-0 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1 py-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-display font-semibold leading-snug">{pick(s, "title", locale)}</p>
                  <StatusBadge status={s.status} label={t.studio.status[s.status]} />
                </div>
                <p className="mt-1 text-sm text-muted">
                  {s._count.episodes} {plural(s._count.episodes, t.common.episodes, locale)} · {formatNumber(s.views, locale)} {t.common.views}
                </p>
                {s.status === "REJECTED" && s.rejectReason && <p className="mt-2 text-xs text-red-300">{fmt(t.studio.rejectReason, { r: s.rejectReason })}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
