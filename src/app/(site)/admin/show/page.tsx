import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { Clapperboard, Crown, Mic2, Vote } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { topSupporters } from "@/lib/show";
import { getI18n } from "@/i18n/server";
import { fmt, formatDate, pick } from "@/i18n/shared";
import { btn } from "@/components/ui/button";
import { ClosePollButton, CameoActions, GiftCameoForm, ScriptEditor, WriteScriptButton } from "@/components/admin/show-admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.show.adminTitle };
}

const card = "rounded-3xl bg-surface p-5 ring-1 ring-line md:p-6";

export default async function AdminShowPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const admin = await requireRole(["ADMIN"], "/admin/show");
  const { t, locale } = await getI18n();
  const { id } = await searchParams;
  const shows = await prisma.series.findMany({
    where: { interactive: true },
    orderBy: { updatedAt: "desc" },
    select: { id: true, titleRu: true, titleEn: true, _count: { select: { episodes: true } } },
  });
  if (!shows.length) return <p className={clsx(card, "text-sm text-muted")}>{t.show.noShow}</p>;
  const sel = shows.find((s) => s.id === id) ?? shows[0];

  const [poll, pending, queued, top, draft, published, jobs] = await Promise.all([
    prisma.poll.findFirst({ where: { seriesId: sel.id }, orderBy: { createdAt: "desc" }, include: { options: { include: { _count: { select: { votes: true } } } } } }),
    prisma.cameo.findMany({ where: { seriesId: sel.id, status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { user: { select: { name: true, email: true } } } }),
    prisma.cameo.findMany({ where: { seriesId: sel.id, status: "APPROVED" }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, kind: true } }),
    topSupporters(sel.id, 30, 8),
    prisma.showScript.findFirst({ where: { seriesId: sel.id, episodeId: null }, orderBy: { createdAt: "desc" } }),
    prisma.showScript.findMany({ where: { seriesId: sel.id, episodeId: { not: null } }, orderBy: { number: "desc" }, take: 10 }),
    prisma.generationJob.findMany({ where: { userId: admin.id }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  const boosts = poll ? await prisma.pollBoost.groupBy({ by: ["optionId"], where: { pollId: poll.id }, _sum: { votes: true } }) : [];
  const boostMap = new Map(boosts.map((b) => [b.optionId, b._sum.votes ?? 0]));
  const options = (poll?.options ?? []).map((o) => ({ id: o.id, label: o.labelRu, votes: o._count.votes + (boostMap.get(o.id) ?? 0) }));
  const total = Math.max(1, options.reduce((a, o) => a + o.votes, 0));
  const leader = [...options].sort((a, b) => b.votes - a.votes)[0];
  const nextNumber = sel._count.episodes + 1;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
          <Mic2 className="text-accent" /> {t.show.adminTitle}
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">{t.show.adminSub}</p>
        {shows.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {shows.map((s) => (
              <Link key={s.id} href={`/admin/show?id=${s.id}`} className={btn(s.id === sel.id ? "primary" : "glass", "sm")}>
                {pick(s, "title", locale)}
              </Link>
            ))}
          </div>
        )}
        <p className="mt-3 text-sm">
          <b>{pick(sel, "title", locale)}</b> <span className="text-muted">· {fmt(t.show.episodesCount, { n: sel._count.episodes })}</span>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 1. Poll */}
        <section className={card}>
          <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <Vote size={20} className="text-accent" /> {t.show.poll}
          </h3>
          {!poll ? (
            <p className="text-sm text-muted">{t.show.noPoll}</p>
          ) : (
            <>
              <p className="font-medium">{poll.questionRu}</p>
              <p className="mb-3 text-xs text-muted">{poll.closesAt < new Date() ? t.show.closedLabel : fmt(t.show.closes, { date: formatDate(poll.closesAt, locale) })}</p>
              <ul className="space-y-2">
                {options.map((o) => (
                  <li key={o.id}>
                    <div className="mb-1 flex justify-between gap-2 text-sm">
                      <span className="truncate">
                        {o.label} {o.id === leader?.id && o.votes > 0 && <span className="text-xs font-semibold text-ok">· {t.show.winner}</span>}
                      </span>
                      <span className="tabular-nums text-muted">{o.votes}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${(o.votes / total) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              {poll.closesAt > new Date() && <ClosePollButton pollId={poll.id} />}
            </>
          )}
        </section>

        {/* 2. Cameos */}
        <section className={card}>
          <h3 className="mb-3 font-display text-lg font-semibold">{t.show.cameos}</h3>
          {pending.length === 0 ? (
            <p className="text-sm text-muted">{t.show.noCameos}</p>
          ) : (
            <ul className="divide-y divide-line">
              {pending.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="truncate text-xs text-muted">{c.user ? `${c.user.name} · ${c.user.email}` : "—"} · {fmt(t.show.coins, { n: c.coins })}</p>
                  </div>
                  <CameoActions id={c.id} />
                </li>
              ))}
            </ul>
          )}
          <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-muted">{t.show.queue}</p>
          <div className="flex flex-wrap gap-1.5">
            {queued.length === 0 ? <span className="text-sm text-muted">—</span> : queued.map((c) => (
              <span key={c.id} className="rounded-full bg-ok/15 px-2.5 py-1 text-xs text-ok">{c.name}</span>
            ))}
          </div>
          <GiftCameoForm seriesId={sel.id} />
        </section>
      </div>

      {/* 3. Top supporters */}
      <section className={card}>
        <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
          <Crown size={20} className="text-coin" /> {t.show.topSupporters}
        </h3>
        {top.length === 0 ? (
          <p className="text-sm text-muted">—</p>
        ) : (
          <ol className="grid gap-2 sm:grid-cols-2">
            {top.map((u, i) => (
              <li key={u.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2">
                <span className="w-5 text-right font-display font-bold text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{u.name}</span>
                <span className="text-xs tabular-nums text-coin">{fmt(t.show.coins, { n: u.coins })}</span>
                <GiftCameoForm seriesId={sel.id} userId={u.id} name={u.name} compact />
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* 4. Writers' room */}
      <section className={card}>
        {draft ? (
          <ScriptEditor
            seriesId={sel.id}
            script={{ id: draft.id, number: draft.number, title: draft.title, content: draft.content, pollQuestion: draft.pollQuestion, optionA: draft.optionA, optionB: draft.optionB, caption: draft.caption }}
            jobs={jobs.map((j) => ({ id: j.id, prompt: j.prompt, status: j.status, provider: j.provider, error: j.error, createdAt: j.createdAt.toISOString() }))}
          />
        ) : (
          <div className="flex flex-col items-start gap-3">
            <h3 className="font-display text-lg font-semibold">{fmt(t.show.script, { n: nextNumber })}</h3>
            <WriteScriptButton seriesId={sel.id} number={nextNumber} />
          </div>
        )}
        <Link href="/studio/generate" className={btn("ghost", "sm", "mt-4")}>
          <Clapperboard size={15} /> {t.show.openStudio}
        </Link>
      </section>

      {published.length > 0 && (
        <section className={card}>
          <h3 className="mb-3 font-display text-lg font-semibold">{t.show.history}</h3>
          <ul className="divide-y divide-line">
            {published.map((p) => (
              <li key={p.id} className="py-2.5 text-sm">
                <Link href={`/watch/${p.episodeId}`} className="font-semibold hover:text-accent">
                  {p.number}. {p.title}
                </Link>
                <p className="line-clamp-2 text-xs text-muted">{p.content.split("\n")[0]}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
