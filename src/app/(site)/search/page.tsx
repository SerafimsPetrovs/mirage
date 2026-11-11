import type { Metadata } from "next";
import Link from "next/link";
import { Search, SearchX } from "lucide-react";
import { searchSeries } from "@/lib/catalog";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/shared";
import { SeriesGrid } from "@/components/media/grid";
import { EmptyState } from "@/components/ui/misc";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.search.title };
}

const POPULAR = ["Kling", "Sora", "Veo", "месть", "revenge", "дракон", "ghost", "empress"];

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q: raw = "" } = await searchParams;
  const q = raw.trim().slice(0, 80);
  const { t, locale } = await getI18n();

  const results = q ? await searchSeries(q, locale, t.genres) : null;

  return (
    <div className="px-4 pb-10 pt-[calc(var(--header-h)+24px)] md:px-10">
      <form action="/search" className="relative mx-auto max-w-2xl">
        <Search size={20} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          name="q"
          defaultValue={q}
          autoFocus
          placeholder={t.search.placeholder}
          aria-label={t.search.title}
          className="h-14 w-full rounded-full bg-surface pl-13 pr-5 text-base outline-none ring-1 ring-line transition focus:ring-accent/60"
        />
      </form>

      {!q && (
        <div className="mx-auto mt-8 max-w-2xl">
          <p className="mb-3 text-sm text-muted">{t.search.popular}</p>
          <div className="flex flex-wrap gap-2">
            {POPULAR.map((p) => (
              <Link key={p} href={`/search?q=${encodeURIComponent(p)}`} className="rounded-full bg-surface px-4 py-2 text-sm ring-1 ring-line hover:ring-white/25">
                {p}
              </Link>
            ))}
          </div>
        </div>
      )}

      {results && (
        <div className="mt-10">
          <h1 className="mb-5 font-display text-xl font-semibold">{fmt(t.search.results, { q })}</h1>
          {results.length ? <SeriesGrid items={results} t={t} locale={locale} /> : <EmptyState mascot="shrug" icon={<SearchX size={24} />} title={t.search.none} />}
        </div>
      )}
    </div>
  );
}
