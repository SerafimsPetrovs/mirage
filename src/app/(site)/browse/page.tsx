import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { SearchX } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { listSeries } from "@/lib/catalog";
import { getI18n } from "@/i18n/server";
import { SeriesGrid } from "@/components/media/grid";
import { EmptyState } from "@/components/ui/misc";
import { btn } from "@/components/ui/button";
import { MOODS } from "@/components/media/mood-picker";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.browse.title };
}

type SP = { format?: string; genre?: string; mood?: string; sort?: string };

const GENRES = ["romance", "drama", "revenge", "ceo", "fantasy", "scifi", "thriller", "comedy", "historical", "mystery", "horror", "anime"] as const;

function href(sp: SP, patch: Partial<SP>) {
  const next = { ...sp, ...patch };
  const q = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]);
  const s = q.toString();
  return `/browse${s ? `?${s}` : ""}`;
}

function Chip({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={clsx(
        "shrink-0 rounded-full px-4 py-2 text-sm font-medium ring-1 transition",
        active ? "bg-white text-black ring-white" : "bg-surface text-text/85 ring-line hover:ring-white/25",
      )}
    >
      {children}
    </Link>
  );
}

export default async function BrowsePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { t, locale } = await getI18n();
  const where: Prisma.SeriesWhereInput = {};
  if (sp.format === "vertical") where.orientation = "VERTICAL";
  if (sp.format === "horizontal") where.orientation = "HORIZONTAL";
  if (sp.genre) where.genres = { contains: sp.genre };
  if (sp.mood) where.moods = { contains: sp.mood };

  let items = await listSeries(locale, {
    where,
    orderBy: sp.sort === "new" ? { publishedAt: "desc" } : { views: "desc" },
    take: 60,
  });
  if (sp.sort === "rated") {
    const agg = await prisma.rating.groupBy({ by: ["seriesId"], where: { seriesId: { in: items.map((i) => i.id) } }, _avg: { value: true } });
    const m = new Map(agg.map((a) => [a.seriesId, a._avg.value ?? 0]));
    items = [...items].sort((a, b) => (m.get(b.id) ?? 0) - (m.get(a.id) ?? 0));
  }
  const filtered = !!(sp.format || sp.genre || sp.mood || sp.sort);

  return (
    <div className="px-4 pb-10 pt-[calc(var(--header-h)+24px)] md:px-10">
      <h1 className="font-display text-3xl font-bold md:text-4xl">{sp.mood ? t.moods[sp.mood as keyof typeof t.moods] ?? t.browse.title : t.browse.title}</h1>
      <p className="mt-1 text-muted">{t.browse.sub}</p>

      <div className="mt-6 space-y-3">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          <Chip active={!sp.format} href={href(sp, { format: undefined })}>{t.common.all}</Chip>
          <Chip active={sp.format === "vertical"} href={href(sp, { format: "vertical" })}>{t.home.shorts}</Chip>
          <Chip active={sp.format === "horizontal"} href={href(sp, { format: "horizontal" })}>{t.home.series}</Chip>
          <span className="mx-1 w-px shrink-0 bg-line" />
          <Chip active={!sp.sort} href={href(sp, { sort: undefined })}>{t.browse.popular}</Chip>
          <Chip active={sp.sort === "new"} href={href(sp, { sort: "new" })}>{t.browse.newest}</Chip>
          <Chip active={sp.sort === "rated"} href={href(sp, { sort: "rated" })}>{t.browse.rated}</Chip>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {GENRES.map((g) => (
            <Chip key={g} active={sp.genre === g} href={href(sp, { genre: sp.genre === g ? undefined : g })}>
              {t.genres[g]}
            </Chip>
          ))}
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {MOODS.map(({ key, icon: Icon }) => (
            <Chip key={key} active={sp.mood === key} href={href(sp, { mood: sp.mood === key ? undefined : key })}>
              <span className="inline-flex items-center gap-1.5">
                <Icon size={15} /> {t.moods[key]}
              </span>
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-8">
        {items.length ? (
          <SeriesGrid items={items} t={t} locale={locale} />
        ) : (
          <EmptyState
            mascot="shrug"
            icon={<SearchX size={24} />}
            title={t.browse.empty}
            action={filtered && <Link href="/browse" className={btn("glass", "md")}>{t.browse.reset}</Link>}
          />
        )}
      </div>
    </div>
  );
}
