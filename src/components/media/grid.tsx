import type { SeriesCard } from "@/lib/catalog";
import type { Dict } from "@/i18n/ru";
import type { Locale } from "@/i18n/shared";
import { PosterCard } from "./cards";

export function SeriesGrid({ items, t, locale }: { items: SeriesCard[]; t: Dict; locale: Locale }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-5 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((s, i) => (
        <PosterCard key={s.id} s={s} t={t} locale={locale} priority={i < 6} />
      ))}
    </div>
  );
}
