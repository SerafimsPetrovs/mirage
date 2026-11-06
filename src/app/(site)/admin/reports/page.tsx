import Link from "next/link";
import clsx from "clsx";
import { prisma } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { fmt, formatDate, pick } from "@/i18n/shared";
import { getReportQueue, URGENT_REASONS, type ReportReason } from "@/lib/reports";
import { ReportActions } from "@/components/admin/report-actions";

type Target = { title: string; href?: string; body?: string; author?: string } | null;

export default async function AdminReportsPage() {
  const { t, locale } = await getI18n();
  const a = t.report.admin;
  const queue = await getReportQueue();

  const ids = (type: string) => queue.filter((g) => g.targetType === type).map((g) => g.targetId);
  const [series, comments, characters] = await Promise.all([
    prisma.series.findMany({ where: { id: { in: ids("SERIES") } }, select: { id: true, slug: true, titleRu: true, titleEn: true, creator: { select: { name: true } } } }),
    prisma.comment.findMany({
      where: { id: { in: ids("COMMENT") } },
      select: { id: true, body: true, hidden: true, episodeId: true, user: { select: { name: true } } },
    }),
    prisma.character.findMany({
      where: { id: { in: ids("CHARACTER") } },
      select: { id: true, nameRu: true, nameEn: true, series: { select: { titleRu: true, titleEn: true, creator: { select: { name: true } } } } },
    }),
  ]);

  const target = (type: string, id: string): Target => {
    if (type === "SERIES") {
      const s = series.find((x) => x.id === id);
      return s ? { title: pick(s, "title", locale), href: `/series/${s.slug}`, author: s.creator.name } : null;
    }
    if (type === "COMMENT") {
      const c = comments.find((x) => x.id === id);
      return c ? { title: c.user.name, body: c.body, href: `/watch/${c.episodeId}`, author: c.user.name } : null;
    }
    if (type === "CHARACTER") {
      const c = characters.find((x) => x.id === id);
      return c ? { title: `${pick(c, "name", locale)} · ${pick(c.series, "title", locale)}`, href: `/chat/${c.id}`, author: c.series.creator.name } : null;
    }
    return { title: id, href: id };
  };

  if (!queue.length) return <p className="rounded-3xl bg-surface p-10 text-center text-muted ring-1 ring-line">{a.empty}</p>;

  return (
    <div className="space-y-4">
      {queue.map((g) => {
        const tg = target(g.targetType, g.targetId);
        const urgent = g.reports.some((r) => URGENT_REASONS.includes(r.reason as ReportReason));
        const actions =
          g.targetType === "URL"
            ? (["dismiss"] as const)
            : g.targetType === "COMMENT"
              ? (["dismiss", "hide", "ban"] as const)
              : (["dismiss", "unpublish", "ban"] as const);
        return (
          <section key={`${g.targetType}:${g.targetId}`} className={clsx("rounded-3xl bg-surface p-5 ring-1", urgent ? "ring-red-500/50" : "ring-line")}>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-surface-2 px-2.5 py-1 font-semibold">{a.targets[g.targetType as keyof typeof a.targets] ?? g.targetType}</span>
              {urgent && <span className="rounded-full bg-red-500/20 px-2.5 py-1 font-semibold text-red-300">{a.urgent}</span>}
              <span className="text-muted">{fmt(a.count, { n: g.reports.length })}</span>
            </div>
            {tg ? (
              <div className="mt-3">
                <p className="font-semibold">
                  {tg.title}
                  {tg.author && g.targetType !== "COMMENT" && <span className="font-normal text-muted"> · {tg.author}</span>}
                </p>
                {tg.body && <p className="mt-1 break-words rounded-2xl bg-surface-2 px-4 py-3 text-sm">{tg.body}</p>}
                {tg.href && (
                  <Link href={tg.href} className="mt-1 inline-block text-sm text-accent-2 hover:underline">
                    {a.open} →
                  </Link>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">{a.missing}</p>
            )}
            <ul className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
              {g.reports.map((r) => (
                <li key={r.id}>
                  <span className={clsx("font-medium", URGENT_REASONS.includes(r.reason as ReportReason) && "text-red-300")}>
                    {t.report.reasons[r.reason as keyof typeof t.report.reasons] ?? r.reason}
                  </span>
                  <span className="text-muted">
                    {" "}
                    · {r.reporter?.name ?? a.anonymous} · {formatDate(r.createdAt, locale)}
                  </span>
                  {r.contactEmail && (
                    <span className="text-muted">
                      {" "}
                      · {a.contact}: <span className="text-text">{r.contactEmail}</span>
                    </span>
                  )}
                  {r.details && <p className="mt-0.5 whitespace-pre-line break-words text-muted">{r.details}</p>}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <ReportActions targetType={g.targetType} targetId={g.targetId} actions={tg ? [...actions] : ["dismiss"]} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
