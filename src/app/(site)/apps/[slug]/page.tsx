import { APPS_ENABLED } from "@/lib/features";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Cpu } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { fmt, formatNumber, pick } from "@/i18n/shared";
import { ownsApp } from "@/lib/apps";
import { AppIcon } from "@/components/apps/app-icon";
import { AppGetButtons } from "@/components/apps/app-get";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const [{ slug }, { locale }] = await Promise.all([params, getI18n()]);
  const app = await prisma.aiApp.findUnique({ where: { slug } });
  return app ? { title: app.name, description: pick(app, "tagline", locale) } : {};
}

export default async function AppPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, { t, locale }, user] = await Promise.all([params, getI18n(), getCurrentUser()]);
  if (!APPS_ENABLED || user?.kidsMode) notFound();
  const app = await prisma.aiApp.findUnique({ where: { slug } });
  if (!app || !app.active) notFound();
  const a = t.v3.apps;
  const owned = app.priceCoins === 0 || (await ownsApp(user?.id, app.id));
  return (
    <div className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px]" style={{ background: "radial-gradient(50% 60% at 20% 0%, hsl(" + app.hue + " 80% 50% / .35), transparent 70%)" }} />
      <div className="relative mx-auto max-w-4xl px-4 pb-12 pt-[calc(var(--header-h)+24px)] md:px-10">
        <Link href="/apps" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
          <ChevronLeft size={16} /> {a.back}
        </Link>
        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
          <AppIcon name={app.name} hue={app.hue} category={app.category} size={104} />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-muted">{a.categories[app.category]}</div>
            <h1 className="font-display text-3xl font-bold md:text-4xl">{app.name}</h1>
            <p className="mt-1 text-lg text-white/80">{pick(app, "tagline", locale)}</p>
            {app.downloads > 0 && <p className="mt-1 text-sm text-muted">{fmt(a.downloads, { n: formatNumber(app.downloads, locale) })}</p>}
          </div>
        </div>
        <div className="mt-8">
          <AppGetButtons
            slug={app.slug}
            price={app.priceCoins}
            owned={owned}
            loggedIn={!!user}
            coins={user?.coins ?? 0}
            win={!!app.winFile}
            mac={!!app.macFile}
            web={app.webUrl || null}
          />
        </div>
        {app.requirements && (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted">
            <Cpu size={16} /> {a.requirements}: {app.requirements}
          </p>
        )}
        <div className="mt-8 whitespace-pre-line rounded-3xl bg-surface p-6 leading-relaxed text-text/90 ring-1 ring-line">{pick(app, "description", locale)}</div>
      </div>
    </div>
  );
}
