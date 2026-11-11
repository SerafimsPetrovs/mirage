import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Tv } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser, getKidsMode } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { fmt, formatDate, pick } from "@/i18n/shared";
import { seriesCardSelect, toCard } from "@/lib/catalog";
import { isAdultMode } from "@/lib/spicy";
import { Avatar } from "@/components/ui/misc";
import { SeriesGrid } from "@/components/media/grid";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const u = await prisma.user.findUnique({ where: { id }, select: { name: true, role: true } });
  return u && u.role !== "VIEWER" ? { title: u.name } : {};
}

/** Public creator profile (linked from the broadcast's "ℹ️ What's going on?" card). Viewers have no public page. */
export default async function CreatorProfile({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { t, locale }, viewer, kids] = await Promise.all([params, getI18n(), getCurrentUser(), getKidsMode()]);
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, bio: true, avatarHue: true, role: true, banned: true, createdAt: true } });
  if (!u || u.banned || u.role === "VIEWER") notFound();
  const adult = isAdultMode(viewer);
  const [series, clips] = await Promise.all([
    prisma.series.findMany({
      where: { creatorId: u.id, status: "PUBLISHED", ...(kids ? { isFamilySafe: true } : adult ? {} : { isAdult: false }) },
      orderBy: { views: "desc" },
      select: seriesCardSelect,
    }),
    kids ? [] : prisma.tvClip.findMany({ where: { creatorId: u.id, status: "APPROVED", channel: { isAdult: false, familyOnly: false, active: true } }, orderBy: { plays: "desc" }, take: 12, include: { channel: { select: { nameRu: true, nameEn: true, slug: true } } } }),
  ]);
  const p = t.v3.profile;
  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-[calc(var(--header-h)+32px)] md:px-10">
      <header className="flex items-center gap-5">
        <Avatar name={u.name} hue={u.avatarHue} size={84} />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-accent">{p.creator}</div>
          <h1 className="truncate font-display text-3xl font-bold">{u.name}</h1>
          <p className="text-sm text-muted">{fmt(p.since, { date: formatDate(u.createdAt, locale) })}</p>
        </div>
      </header>
      {u.bio && <p className="mt-5 max-w-2xl whitespace-pre-line text-text/85">{u.bio}</p>}
      {!series.length && !clips.length && <p className="mt-10 text-muted">{p.empty}</p>}
      {series.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-xl font-bold">{p.series}</h2>
          <SeriesGrid items={series.map((s) => toCard(s, locale))} t={t} locale={locale} />
        </section>
      )}
      {clips.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold">
            <Tv size={20} className="text-[#7dffb2]" /> {p.clips}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {clips.map((c) => (
              <li key={c.id} className="rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
                <div className="truncate font-semibold">{c.artist ? c.artist + " — " + c.title : c.title}</div>
                <div className="text-xs text-muted">
                  {pick(c.channel, "name", locale)} · ▶ {c.plays}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
