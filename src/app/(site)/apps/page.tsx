import { APPS_ENABLED } from "@/lib/features";
import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { Download, Globe } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { fmt, formatNumber, pick } from "@/i18n/shared";
import { AppIcon } from "@/components/apps/app-icon";
import { APP_CATEGORIES } from "@/lib/apps";
import { notFound } from "next/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.v3.apps.title, description: t.v3.apps.sub };
}

/** One-click AI app showcase for people who don't use GitHub, consoles or clouds. */
export default async function AppsPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const [{ t, locale }, user, sp] = await Promise.all([getI18n(), getCurrentUser(), searchParams]);
  if (!APPS_ENABLED || user?.kidsMode) notFound();
  const a = t.v3.apps;
  const cat = (APP_CATEGORIES as readonly string[]).includes(sp.c ?? "") ? sp.c : undefined;
  const apps = await prisma.aiApp.findMany({ where: { active: true, ...(cat ? { category: cat } : {}) }, orderBy: [{ featured: "desc" }, { downloads: "desc" }, { createdAt: "desc" }] });
  const featured = !cat ? apps.filter((x) => x.featured).slice(0, 2) : [];
  // the big cards above already show the featured apps — the list is the rest
  const rest = apps.filter((x) => !featured.includes(x));
  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-[calc(var(--header-h)+28px)] md:px-10">
      <header className="max-w-3xl">
        <h1 className="font-display text-3xl font-bold md:text-5xl">{a.title}</h1>
        <p className="mt-3 text-lg text-muted">{a.sub}</p>
      </header>

      <nav className="no-scrollbar -mx-4 mt-6 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label={a.title}>
        {[undefined, ...APP_CATEGORIES].map((c) => (
          <Link
            key={c ?? "all"}
            href={c ? "/apps?c=" + c : "/apps"}
            className={clsx("flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-semibold", c === cat ? "bg-white text-black" : "bg-white/[.06] text-muted ring-1 ring-white/10 hover:text-text")}
          >
            {c ? a.categories[c] : a.all}
          </Link>
        ))}
      </nav>

      {featured.length > 0 && (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {featured.map((x) => (
            <Link
              key={x.id}
              href={"/apps/" + x.slug}
              className="group relative overflow-hidden rounded-3xl p-6 ring-1 ring-white/10 transition-transform hover:-translate-y-0.5"
              style={{ background: "radial-gradient(90% 140% at 100% 0%, hsl(" + x.hue + " 80% 50% / .45), transparent 60%), var(--surface)" }}
            >
              <AppIcon name={x.name} hue={x.hue} category={x.category} size={72} />
              <h2 className="mt-4 font-display text-2xl font-bold">{x.name}</h2>
              <p className="mt-1 text-white/80">{pick(x, "tagline", locale)}</p>
              <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-black">
                <Download size={16} /> {x.priceCoins ? fmt(a.price, { n: x.priceCoins }) : a.free}
              </span>
            </Link>
          ))}
        </div>
      )}

      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((x) => {
          const available = !!(x.winFile || x.macFile || x.webUrl);
          return (
            <li key={x.id}>
              <Link href={"/apps/" + x.slug} className="flex h-full gap-4 rounded-3xl bg-surface p-4 ring-1 ring-line transition-colors hover:bg-surface-2">
                <AppIcon name={x.name} hue={x.hue} category={x.category} size={60} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold">{x.name}</h3>
                    {!available && <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-muted">{a.soon}</span>}
                  </div>
                  <p className="line-clamp-2 text-sm text-muted">{pick(x, "tagline", locale)}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <span className={clsx("font-bold", x.priceCoins ? "text-coin" : "text-ok")}>{x.priceCoins ? fmt(a.price, { n: x.priceCoins }) : a.free}</span>
                    <span className="text-muted">{a.categories[x.category]}</span>
                    {x.webUrl && <Globe size={13} className="text-muted" />}
                    {x.downloads > 0 && <span className="text-muted">{fmt(a.downloads, { n: formatNumber(x.downloads, locale) })}</span>}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
