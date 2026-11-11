import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { APPS_ENABLED } from "@/lib/features";
import { prisma } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { AppEditor } from "@/components/apps/app-editor";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.v3.apps.admin.title };
}

/** Manage the one-click AI app showcase: texts, price, installers for Windows/macOS, web link. */
export default async function AdminAppsPage() {
  if (!APPS_ENABLED) notFound();
  const { t } = await getI18n();
  const apps = await prisma.aiApp.findMany({ orderBy: [{ featured: "desc" }, { createdAt: "desc" }] });
  return (
    <div className="space-y-8">
      <h2 className="font-display text-2xl font-bold">{t.v3.apps.admin.title}</h2>
      <section>
        <h3 className="mb-3 font-semibold">{t.v3.apps.admin.add}</h3>
        <AppEditor />
      </section>
      {apps.map((a) => (
        <details key={a.id} className="rounded-3xl bg-white/[.02] ring-1 ring-line">
          <summary className="cursor-pointer px-5 py-4 font-semibold">
            {a.name} <span className="font-normal text-muted">· /{a.slug} · {a.downloads}↓</span>
          </summary>
          <div className="p-3">
            <AppEditor initial={a} />
          </div>
        </details>
      ))}
    </div>
  );
}
