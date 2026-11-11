import Link from "next/link";
import clsx from "clsx";
import { prisma } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { fmt, pick } from "@/i18n/shared";
import { RebuildButton } from "@/components/tv/tv-admin-ui";
import { ChannelEditor, RewriteButton } from "@/components/tv/tv-admin-ui2";

/** Channels: create, edit, switch off; rebuild the schedule or let the showrunner rewrite today's host lines. */
export default async function AdminTvChannels({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const [{ t, locale }, sp] = await Promise.all([getI18n(), searchParams]);
  const m = t.tv.adm2;
  const channels = await prisma.tvChannel.findMany({ orderBy: { number: "asc" }, include: { _count: { select: { clips: { where: { status: "APPROVED" } } } } } });
  const editing = sp.edit === "new" ? null : channels.find((c) => c.id === sp.edit);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link href="/admin/tv/channels?edit=new" className="inline-flex h-10 items-center rounded-2xl bg-[#7dffb2] px-4 text-sm font-semibold text-black">
          + {m.channelNew}
        </Link>
      </div>

      {(sp.edit === "new" || editing) && (
        <section>
          <h2 className="mb-3 font-display text-xl font-bold">{editing ? `${m.channelEdit}: ${pick(editing, "name", locale)}` : m.channelNew}</h2>
          <ChannelEditor
            key={editing?.id ?? "new"}
            initial={
              editing
                ? {
                    id: editing.id,
                    slug: editing.slug,
                    number: editing.number,
                    nameRu: editing.nameRu,
                    nameEn: editing.nameEn,
                    taglineRu: editing.taglineRu,
                    taglineEn: editing.taglineEn,
                    kind: editing.kind,
                    genres: editing.genres,
                    hue: editing.hue,
                    hostName: editing.hostName,
                    hostPersona: editing.hostPersona,
                    familyOnly: editing.familyOnly,
                    isAdult: editing.isAdult,
                    ticker: editing.ticker,
                    quiz: editing.quiz,
                    active: editing.active,
                    bufferTargetMin: editing.bufferTargetMin,
                  }
                : undefined
            }
          />
        </section>
      )}

      <ul className="grid gap-3 md:grid-cols-2">
        {channels.map((c) => (
          <li key={c.id} className={clsx("rounded-3xl bg-surface p-5 ring-1 ring-line", !c.active && "opacity-60")}>
            <div className="flex items-start gap-4">
              <span className="tv-osd w-12 shrink-0 text-center text-4xl" style={{ color: `hsl(${c.hue} 85% 70%)` }}>
                {String(c.number).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/tv/${c.slug}`} className="font-display text-lg font-bold hover:underline">
                    {pick(c, "name", locale)}
                  </Link>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold">{m.kinds[c.kind as keyof typeof m.kinds] ?? c.kind}</span>
                  {!c.active && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">{m.off}</span>}
                  {c.isAdult && <span className="rounded-full bg-accent/80 px-2 py-0.5 text-[11px] font-bold">18+</span>}
                  {c.familyOnly && <span className="rounded-full bg-sky-500/30 px-2 py-0.5 text-[11px]">{m.f.familyOnly}</span>}
                </div>
                <p className="mt-0.5 line-clamp-1 text-sm text-muted">{pick(c, "tagline", locale)}</p>
                <p className="mt-1 text-xs text-muted">
                  {c.hostName} · {fmt(t.tv.admin.clipsCount, { n: c._count.clips })} {c.genres && `· ${c.genres}`}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/admin/tv/channels?edit=${c.id}`} className="inline-flex h-9 items-center rounded-xl bg-white/8 px-3.5 text-sm font-semibold hover:bg-white/12">
                {m.channelEdit}
              </Link>
              <Link href={`/admin/tv/schedule?ch=${c.id}`} className="inline-flex h-9 items-center rounded-xl bg-white/8 px-3.5 text-sm font-semibold hover:bg-white/12">
                {m.tabs.schedule}
              </Link>
              <RebuildButton channelId={c.id} />
              <RewriteButton channelId={c.id} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
