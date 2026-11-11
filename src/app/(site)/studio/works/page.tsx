import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { Clapperboard, Tv } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/shared";
import { worksRegistry, type WorkStatus } from "@/lib/studio-hub";
import { LocalTime } from "@/components/ui/local-time";
import { btn } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.v3.studio.works.title };
}

const TONE: Record<WorkStatus["kind"], string> = {
  MODERATION: "bg-vip/15 text-vip",
  QUEUED: "bg-[#7dffb2]/15 text-[#7dffb2]",
  ROTATION: "bg-sky-400/15 text-sky-300",
  APPROVED: "bg-ok/15 text-ok",
  REJECTED: "bg-white/10 text-muted",
  PUBLISHED: "bg-accent/15 text-accent",
  DRAFT: "bg-white/10 text-muted",
};

/** Single registry of everything the creator made, with a human status. */
export default async function WorksPage() {
  const [{ t, locale }, user] = await Promise.all([getI18n(), requireUser("/studio/works")]);
  const w = t.v3.studio.works;
  const rows = await worksRegistry(user, locale);
  const label = (s: WorkStatus) => {
    switch (s.kind) {
      case "QUEUED":
        return (
          <>
            {w.QUEUED} <LocalTime ms={s.at} withDay={false} />
          </>
        );
      case "ROTATION":
        return fmt(w.ROTATION, { n: s.plays });
      case "PUBLISHED":
        return fmt(w.PUBLISHED, { n: s.episodes }) + (s.scheduled ? " · " + fmt(w.scheduled, { n: s.scheduled }) : "");
      default:
        return w[s.kind];
    }
  };
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">{w.title}</h1>
          <p className="mt-2 text-muted">{w.sub}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/studio/tv" className={btn("glass", "sm")}>
            <Tv size={15} /> {t.v3.studio.nav.upload}
          </Link>
          <Link href="/studio/series/new" className={btn("primary", "sm")}>
            <Clapperboard size={15} /> {t.studio.newSeries}
          </Link>
        </div>
      </header>
      {!rows.length ? (
        <p className="rounded-3xl bg-surface p-10 text-center text-muted ring-1 ring-line">{w.empty}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
          {rows.map((r) => (
            <li key={r.type + ":" + r.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", r.type === "SERIES" ? "bg-accent/15 text-accent" : "bg-[#7dffb2]/15 text-[#7dffb2]")}>
                  {r.type === "SERIES" ? <Clapperboard size={17} /> : <Tv size={17} />}
                </span>
                <div className="min-w-0">
                  {r.href ? (
                    <Link href={r.href} className="block truncate font-semibold hover:underline">
                      {r.title}
                    </Link>
                  ) : (
                    <div className="truncate font-semibold">{r.title}</div>
                  )}
                  <div className="text-xs text-muted">
                    {w.type[r.type]}
                    {r.sub ? " · " + r.sub : ""}
                  </div>
                </div>
              </div>
              <span className={clsx("self-start rounded-full px-3 py-1 text-xs font-semibold sm:self-auto", TONE[r.status.kind])}>{label(r.status)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
