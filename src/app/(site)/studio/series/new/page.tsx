import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { SeriesForm, emptySeries } from "@/components/studio/series-form";

export default async function NewSeriesPage() {
  const { t } = await getI18n();
  return (
    <div>
      <Link href="/studio" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ChevronLeft size={16} /> {t.studio.title}
      </Link>
      <h1 className="mb-8 font-display text-3xl font-bold">{t.studio.newSeries}</h1>
      <SeriesForm initial={emptySeries} />
    </div>
  );
}
