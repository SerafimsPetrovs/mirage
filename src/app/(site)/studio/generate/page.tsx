import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Sparkles } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { pick } from "@/i18n/shared";
import { listGenerationsAction } from "@/app/actions/generate";
import { GenStudio } from "@/components/studio/gen-studio";
import { genProvider } from "@/lib/video-gen";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.gen.title };
}

export default async function GeneratePage() {
  const user = await requireRole(["CREATOR", "ADMIN"], "/studio/generate");
  const { t, locale } = await getI18n();
  const [{ jobs, credits }, series] = await Promise.all([
    listGenerationsAction(),
    prisma.series.findMany({ where: { creatorId: user.id }, orderBy: { updatedAt: "desc" }, select: { id: true, titleRu: true, titleEn: true } }),
  ]);
  return (
    <div>
      <Link href="/studio" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ChevronLeft size={16} /> {t.studio.title}
      </Link>
      <div className="mb-6 md:mb-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-vip/15 px-3 py-1 text-xs font-semibold text-vip">
          <Sparkles size={13} /> {t.gen.badge}
        </span>
        <h1 className="mt-3 font-display text-3xl font-bold md:text-4xl">{t.gen.title}</h1>
        <p className="mt-1.5 max-w-2xl text-muted">{t.gen.sub}</p>
      </div>
      <GenStudio initialJobs={jobs} initialCredits={credits} series={series.map((s) => ({ id: s.id, title: pick(s, "title", locale) }))} provider={genProvider()} />
    </div>
  );
}
