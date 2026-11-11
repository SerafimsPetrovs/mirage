import Link from "next/link";
import clsx from "clsx";
import { prisma } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { fmt, pick, plural } from "@/i18n/shared";
import { listClips } from "@/lib/tv-admin";
import { ClipForm } from "@/components/tv/tv-admin-ui";
import { ClipAdminActions } from "@/components/tv/tv-admin-ui2";

const TONE: Record<string, string> = { PENDING: "bg-vip/15 text-vip", APPROVED: "bg-ok/15 text-ok", REJECTED: "bg-white/10 text-muted" };

/** All TV clips: filter, preview, rename, take off/put on air, break in, delete; upload a new one. */
export default async function AdminTvClips({ searchParams }: { searchParams: Promise<{ ch?: string; status?: string; q?: string }> }) {
  const [{ t, locale }, sp] = await Promise.all([getI18n(), searchParams]);
  const m = t.tv.adm2;
  const [channels, clips] = await Promise.all([
    prisma.tvChannel.findMany({ orderBy: { number: "asc" } }),
    listClips({ channelId: sp.ch || undefined, status: sp.status || undefined, q: sp.q?.slice(0, 60) || undefined }),
  ]);
  const href = (p: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries({ ch: sp.ch, status: sp.status, q: sp.q, ...p }).filter(([, v]) => v) as [string, string][]);
    return `/admin/tv/clips${q.size ? `?${q}` : ""}`;
  };
  const chip = (active: boolean) => clsx("shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold ring-1", active ? "bg-white text-black ring-white" : "text-muted ring-line hover:text-text");

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap items-center gap-2" action="/admin/tv/clips">
        {sp.ch && <input type="hidden" name="ch" value={sp.ch} />}
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        <input name="q" defaultValue={sp.q} placeholder={m.search} aria-label={m.search} className="h-10 w-64 rounded-xl border border-line bg-surface-2 px-3 text-sm" />
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          <Link href={href({ status: undefined })} className={chip(!sp.status)}>
            {m.all}
          </Link>
          {(["APPROVED", "PENDING", "REJECTED"] as const).map((s) => (
            <Link key={s} href={href({ status: s })} className={chip(sp.status === s)}>
              {m.statusL[s]}
            </Link>
          ))}
        </div>
      </form>
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        <Link href={href({ ch: undefined })} className={chip(!sp.ch)}>
          {m.all}
        </Link>
        {channels.map((c) => (
          <Link key={c.id} href={href({ ch: c.id })} className={chip(sp.ch === c.id)}>
            {String(c.number).padStart(2, "0")} · {pick(c, "name", locale)}
          </Link>
        ))}
      </div>

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {clips.map((c) => (
          <li key={c.id} className="overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
            <video src={`/api/tv/clip/${c.id}`} muted playsInline preload="metadata" controls className="aspect-video w-full bg-black" />
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 font-semibold">{c.artist ? `${c.artist} — ${c.title}` : c.title}</p>
                <span className={clsx("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", TONE[c.status])}>{m.statusL[c.status as keyof typeof m.statusL] ?? c.status}</span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {String(c.channel.number).padStart(2, "0")} {pick(c.channel, "name", locale)} · {t.tv.kinds[c.kind as keyof typeof t.tv.kinds]} · {c.durationSec}s · {`${c.plays} ${plural(c.plays, m.plays, locale)}`}
                {c.kind === "MUSIC" && ` · ${`${c._count.likes} ${plural(c._count.likes, m.likes, locale)}`}`}
                {c.sponsorName && ` · ${fmt(t.tv.sponsor, { name: c.sponsorName })}`}
                {c.creator && ` · ${c.creator.name}`}
              </p>
              <div className="mt-3">
                <ClipAdminActions clip={{ id: c.id, title: c.title, status: c.status }} />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <section>
        <h2 className="mb-3 font-display text-xl font-bold">{t.tv.admin.addClip}</h2>
        <ClipForm admin channels={channels.map((c) => ({ id: c.id, name: `${c.number} · ${pick(c, "name", locale)}` }))} />
      </section>
    </div>
  );
}
