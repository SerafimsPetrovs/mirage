import Link from "next/link";
import clsx from "clsx";
import { prisma } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { pick } from "@/i18n/shared";
import { channelSchedule } from "@/lib/tv-admin";
import { ensureDay } from "@/lib/tv";
import { utcDay } from "@/lib/rewards";
import { RebuildButton } from "@/components/tv/tv-admin-ui";
import { BreakInButton, TechBreakButton } from "@/components/tv/tv-admin-ui2";

const hhmm = (d: Date, locale: string) => d.toLocaleTimeString(locale === "ru" ? "ru-RU" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Today's schedule of one channel around now: pull a slot ("technical break") or break in with a clip. */
export default async function AdminTvSchedule({ searchParams }: { searchParams: Promise<{ ch?: string }> }) {
  const [{ t, locale }, sp] = await Promise.all([getI18n(), searchParams]);
  const m = t.tv.adm2;
  const channels = await prisma.tvChannel.findMany({ orderBy: { number: "asc" } });
  const ch = channels.find((c) => c.id === sp.ch) ?? channels[0];
  if (!ch) return null;
  await ensureDay(ch, utcDay());
  const [slots, clips] = await Promise.all([
    channelSchedule(ch.id),
    prisma.tvClip.findMany({ where: { channelId: ch.id, status: "APPROVED" }, orderBy: { title: "asc" }, select: { id: true, title: true, artist: true, kind: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        {channels.map((c) => (
          <Link
            key={c.id}
            href={`/admin/tv/schedule?ch=${c.id}`}
            className={clsx("shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold ring-1", c.id === ch.id ? "bg-white text-black ring-white" : "text-muted ring-line hover:text-text")}
          >
            {String(c.number).padStart(2, "0")} · {pick(c, "name", locale)}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold">{pick(ch, "name", locale)}</h2>
            <RebuildButton channelId={ch.id} />
          </div>
          <ol className="divide-y divide-line overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
            {slots.map((s) => (
              <li key={s.id} className={clsx("flex items-center gap-3 px-4 py-2 text-sm", s.onAir && "bg-[#7dffb2]/10", s.past && "opacity-45")}>
                <span className="tv-osd w-20 shrink-0 text-base">{hhmm(s.startsAt, locale)}</span>
                <span className="w-24 shrink-0 text-xs font-semibold text-muted">{m.slotKinds[s.kind as keyof typeof m.slotKinds] ?? s.kind}</span>
                <span className="min-w-0 flex-1 truncate">
                  {s.onAir && <span className="mr-2 rounded bg-[#ff3b3b] px-1.5 py-0.5 text-[10px] font-bold text-white">{m.onAir}</span>}
                  {s.title}
                </span>
                <span className="shrink-0 text-xs text-muted">{s.durationSec}s</span>
                {!s.past && (s.kind === "CLIP" || s.kind === "EPISODE" || s.kind === "BREAK") && <TechBreakButton slotId={s.id} />}
              </li>
            ))}
          </ol>
        </section>
        <section className="min-w-0">
          <h2 className="mb-1 font-display text-xl font-bold">{m.breakIn}</h2>
          <p className="mb-3 text-sm text-muted">{m.breakInHint}</p>
          <ul className="divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">
            {clips.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate">
                  {c.artist ? `${c.artist} — ${c.title}` : c.title} <span className="text-xs text-muted">· {t.tv.kinds[c.kind as keyof typeof t.tv.kinds]}</span>
                </span>
                <BreakInButton clipId={c.id} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
