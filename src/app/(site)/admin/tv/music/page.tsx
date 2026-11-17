import Link from "next/link";
import clsx from "clsx";
import { Music2, Plus } from "lucide-react";
import { listTracks } from "@/lib/music";
import { getI18n } from "@/i18n/server";
import { fmt, formatDate, pick } from "@/i18n/shared";
import { btn } from "@/components/ui/button";
import { MusicReviewCard } from "@/components/music/music-admin";

/** Music videos: viewer orders waiting for review + every track and its build status. */
export default async function AdminMusicPage() {
  const { t, locale } = await getI18n();
  const m = t.music;
  const tracks = await listTracks();
  const review = tracks.filter((x) => x.status === "REVIEW");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold">{m.adminTitle}</h2>
          <p className="mt-1 text-sm text-muted">{m.adminSub}</p>
        </div>
        <Link href="/music/new" className={btn("primary", "md")}>
          <Plus size={18} /> {m.newTrack}
        </Link>
      </div>
      {review.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {review.map((r) => (
            <MusicReviewCard key={r.id} id={r.id} title={r.title} artist={r.artist} lyrics={r.lyrics} from={fmt(m.from, { name: r.user.name })} />
          ))}
        </div>
      )}
      {tracks.length === 0 ? (
        <p className="rounded-3xl bg-surface p-8 text-center text-muted ring-1 ring-line">{m.noTracks}</p>
      ) : (
        <ul className="divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">
          {tracks.map((tr) => (
            <li key={tr.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Music2 size={18} className="shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {tr.title} <span className="text-muted">— {tr.artist || "—"}</span>
                </p>
                <p className="text-xs text-muted">
                  {pick(tr.channel, "name", locale)} · {m.styles[tr.style as keyof typeof m.styles] ?? tr.style} · {tr.user.name} · {formatDate(tr.createdAt, locale)}
                  {tr.source === "ORDER" && ` · ${tr.coins} 🪙`}
                </p>
              </div>
              <span
                className={clsx(
                  "rounded-full px-2.5 py-1 text-xs font-semibold",
                  tr.status === "READY" ? "bg-ok/15 text-ok" : tr.status === "REVIEW" ? "bg-coin/15 text-coin" : tr.status === "FAILED" || tr.status === "REJECTED" ? "bg-red-500/15 text-red-300" : "bg-white/10 text-muted",
                )}
              >
                {m.statuses[tr.status as keyof typeof m.statuses] ?? tr.status}
                {tr.status === "RENDERING" && ` ${tr.progress}%`}
              </span>
              <Link href={`/music/${tr.id}`} className={btn("glass", "sm")}>
                {m.open}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
