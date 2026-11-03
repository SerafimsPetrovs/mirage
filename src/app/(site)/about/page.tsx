import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { btn } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.footer.about };
}

export default async function AboutPage() {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-4xl px-4 pb-10 pt-[calc(var(--header-h)+48px)] md:px-10">
      <h1 className="font-display text-4xl font-bold leading-tight md:text-6xl">
        <span className="text-mirage">{t.about.title}</span>
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-white/80">{t.about.lead}</p>
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {t.about.points.map((p, i) => (
          <div key={p.t} className="rounded-3xl bg-surface p-6 ring-1 ring-line">
            <span className="font-display text-sm font-bold text-accent-2">0{i + 1}</span>
            <h2 className="mt-2 font-display text-lg font-semibold">{p.t}</h2>
            <p className="mt-2 text-sm text-muted">{p.d}</p>
          </div>
        ))}
      </div>
      <div className="mt-10 flex gap-3">
        <Link href="/feed" className={btn("primary", "lg")}>{t.home.feedPromoCta}</Link>
        <Link href="/creators" className={btn("glass", "lg")}>{t.footer.creators}</Link>
      </div>
      <section id="terms" className="mt-20 scroll-mt-24 border-t border-line pt-10">
        <h2 className="font-display text-xl font-semibold">{t.about.termsTitle}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">{t.about.terms}</p>
      </section>
    </div>
  );
}
