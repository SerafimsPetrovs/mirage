import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Music2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getTrackFor } from "@/lib/music";
import { cleanLrc, isMusicStyle, type LrcLine } from "@/lib/music-rules";
import { mediaUrl } from "@/lib/files";
import { getI18n } from "@/i18n/server";
import { fmt, pick } from "@/i18n/shared";
import { TapSync } from "@/components/music/tap-sync";
import { TrackPanel } from "@/components/music/track-panel";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  const tr = user ? await getTrackFor(user, id) : null;
  return { title: tr?.title ?? t.music.myTracks, robots: { index: false } };
}

export default async function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/music/${id}`);
  const tr = await getTrackFor(user, id);
  if (!tr) notFound();
  const { t, locale } = await getI18n();
  const m = t.music;
  const admin = user.role === "ADMIN";
  const clip = tr.clipId ? await prisma.tvClip.findUnique({ where: { id: tr.clipId }, select: { status: true } }) : null;
  let lines: LrcLine[] = [];
  try {
    lines = tr.lrcJson ? cleanLrc(JSON.parse(tr.lrcJson), 0) : [];
  } catch {}
  const editable = ["DRAFT", "FAILED", "READY"].includes(tr.status) && (tr.source !== "ORDER" || admin || tr.status === "DRAFT");
  const fromAdmin = admin && tr.userId !== user.id;
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 pb-10 pt-[calc(var(--header-h)+32px)] md:px-10">
      <Link href={fromAdmin ? "/admin/tv/music" : "/music"} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} /> {fromAdmin ? m.adminTitle : m.myTracks}
      </Link>
      <header className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-line">
          {tr.coverRef ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(tr.coverRef) ?? ""} alt="" className="h-full w-full object-cover" />
          ) : (
            <Music2 size={28} className="text-muted" />
          )}
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold md:text-3xl">{tr.title}</h1>
          <p className="text-muted">
            {tr.artist || "—"} · {pick(tr.channel, "name", locale)}
            {tr.bpm > 0 && <> · {fmt(m.bpm, { n: Math.round(tr.bpm) })}</>}
          </p>
        </div>
      </header>
      <TrackPanel
        id={tr.id}
        status={tr.status as "DRAFT"}
        progress={tr.progress}
        error={tr.error}
        style={isMusicStyle(tr.style) ? tr.style : "KARAOKE"}
        order={tr.source === "ORDER"}
        admin={admin}
        clipApproved={clip?.status === "APPROVED"}
        vertical={tr.orientation === "VERTICAL"}
        version={tr.updatedAt.getTime()}
      />
      <TapSync trackId={tr.id} lyrics={tr.lyrics} initial={lines} editable={editable} />
    </div>
  );
}
