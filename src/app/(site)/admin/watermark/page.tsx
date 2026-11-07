import type { Metadata } from "next";
import { Fingerprint, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/shared";
import { LeakDetector, ProtectAllButton } from "@/components/admin/watermark-tools";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.wm.title };
}

export default async function WatermarkPage() {
  const { t } = await getI18n();
  const w = t.wm;
  const [refs, assets, sessions] = await Promise.all([
    prisma.episode.findMany({ where: { videoUrl: { not: { startsWith: "http" } } }, distinct: ["videoUrl"], select: { videoUrl: true } }),
    prisma.watermarkAsset.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.watermarkSession.count(),
  ]);
  const by = Object.fromEntries(assets.map((a) => [a.status, a._count._all])) as Record<string, number>;
  const ready = by.READY ?? 0;
  const left = Math.max(0, refs.length - ready - (by.RUNNING ?? 0));

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-surface p-5 ring-1 ring-line md:p-7">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><ShieldCheck size={20} className="text-ok" /> {w.title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{w.how}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            [w.statReady, `${ready} / ${refs.length}`],
            [w.statRunning, by.RUNNING ?? 0],
            [w.statFailed, by.FAILED ?? 0],
            [w.statViewers, sessions],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl bg-surface-2/60 p-4 ring-1 ring-line">
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <ProtectAllButton pending={left} />
          <p className="text-xs text-muted">{fmt(w.protectHint, { n: left })}</p>
        </div>
      </section>

      <section className="rounded-3xl bg-surface p-5 ring-1 ring-line md:p-7">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Fingerprint size={20} className="text-accent" /> {w.detectTitle}</h2>
        <p className="mb-5 mt-2 max-w-3xl text-sm leading-relaxed text-muted">{w.detectSub}</p>
        <LeakDetector />
      </section>
    </div>
  );
}
