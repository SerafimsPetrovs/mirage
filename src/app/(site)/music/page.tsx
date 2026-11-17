import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { Music2, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listTracks } from "@/lib/music";
import { getI18n } from "@/i18n/server";
import { formatDate } from "@/i18n/shared";
import { btn } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { mediaUrl } from "@/lib/files";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.music.myTracks };
}

export default async function MyTracksPage() {
  const user = await requireUser("/music");
  const { t, locale } = await getI18n();
  const m = t.music;
  const tracks = await listTracks({ userId: user.id });
  return (
    <div className="mx-auto max-w-4xl px-4 pb-10 pt-[calc(var(--header-h)+32px)] md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">{m.myTracks}</h1>
          <p className="mt-1 text-sm text-muted">{m.newSub}</p>
        </div>
        <Link href="/music/new" className={btn("primary", "md")}>
          <Plus size={18} /> {m.newTrack}
        </Link>
      </div>
      {tracks.length === 0 ? (
        <div className="mt-8">
          <EmptyState mascot="want-you" icon={<Music2 size={24} />} title={m.noTracks} action={<Link href="/music/new" className={btn("primary", "md")}>{m.newTrack}</Link>} />
        </div>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {tracks.map((tr) => (
            <li key={tr.id}>
              <Link href={`/music/${tr.id}`} className="flex items-center gap-4 rounded-2xl bg-surface p-3 ring-1 ring-line transition hover:ring-white/20">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-2">
                  {tr.coverRef ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(tr.coverRef) ?? ""} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Music2 size={22} className="text-muted" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{tr.title}</p>
                  <p className="truncate text-sm text-muted">
                    {tr.artist || "—"} · {m.styles[tr.style as keyof typeof m.styles] ?? tr.style}
                  </p>
                  <p className="mt-1 text-xs text-muted">{formatDate(tr.createdAt, locale)}</p>
                </div>
                <span
                  className={clsx(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                    tr.status === "READY" ? "bg-ok/15 text-ok" : tr.status === "FAILED" || tr.status === "REJECTED" ? "bg-red-500/15 text-red-300" : "bg-white/10 text-muted",
                  )}
                >
                  {m.statuses[tr.status as keyof typeof m.statuses] ?? tr.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
