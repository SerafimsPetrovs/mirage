import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { getI18n } from "@/i18n/server";
import { fmt, formatDate } from "@/i18n/shared";
import { getLegalDoc, LEGAL_SLUGS, LEGAL_UPDATED, type LegalSlug } from "@/content/legal";
import { CopyrightForm } from "@/components/legal/copyright-form";

type Props = { params: Promise<{ slug: string }> };

const isSlug = (s: string): s is LegalSlug => (LEGAL_SLUGS as readonly string[]).includes(s);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isSlug(slug)) return {};
  const { locale } = await getI18n();
  return { title: getLegalDoc(slug, locale).title };
}

export default async function LegalPage({ params }: Props) {
  const { slug } = await params;
  if (!isSlug(slug)) notFound();
  const { t, locale } = await getI18n();
  const doc = getLegalDoc(slug, locale);
  const nav: { slug: LegalSlug; label: string }[] = [
    { slug: "terms", label: t.legal.terms },
    { slug: "privacy", label: t.legal.privacy },
    { slug: "creators", label: t.legal.creatorRules },
    { slug: "copyright", label: t.legal.copyright },
  ];
  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 pt-[calc(var(--header-h)+40px)] md:px-10">
      <nav className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {nav.map((n) => (
          <Link
            key={n.slug}
            href={`/legal/${n.slug}`}
            className={clsx(
              "shrink-0 rounded-full px-4 py-2 text-sm ring-1 transition",
              n.slug === slug ? "bg-white text-black ring-white" : "text-muted ring-line hover:text-text",
            )}
          >
            {n.label}
          </Link>
        ))}
      </nav>
      <h1 className="mt-8 font-display text-3xl font-bold md:text-4xl">{doc.title}</h1>
      <p className="mt-2 text-sm text-muted">{fmt(t.legal.updated, { date: formatDate(LEGAL_UPDATED, locale) })}</p>
      <p className="mt-4 rounded-2xl bg-coin/10 px-4 py-3 text-sm text-coin ring-1 ring-coin/30">{t.legal.draft}</p>
      <p className="mt-6 leading-relaxed text-white/85">{doc.intro}</p>
      {doc.sections.map((s) => (
        <section key={s.h} className="mt-8">
          <h2 className="font-display text-lg font-semibold">{s.h}</h2>
          {s.p.map((p) => (
            <p key={p.slice(0, 40)} className="mt-3 text-[15px] leading-relaxed text-muted">
              {p}
            </p>
          ))}
        </section>
      ))}
      {slug === "copyright" && <CopyrightForm />}
    </div>
  );
}
