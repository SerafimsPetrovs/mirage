import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Radio, Scissors } from "lucide-react";
import { prisma } from "@/lib/db";
import { mediaUrl } from "@/lib/files";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/shared";
import { btn } from "@/components/ui/button";
import { MomentView } from "@/components/tv/moment-view";

type Props = { params: Promise<{ id: string }> };

const load = (id: string) =>
  prisma.tvMoment.findUnique({ where: { id: id.slice(0, 40) }, include: { user: { select: { name: true } } } });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [m, { t }] = await Promise.all([load(id), getI18n()]);
  if (!m) return {};
  const image = mediaUrl(m.thumbRef);
  return {
    title: `${m.title} — ${t.moments.title}`,
    description: t.moments.shareText,
    openGraph: { type: "video.other", title: m.title, description: t.moments.shareText, images: image ? [{ url: image, width: 1200, height: 675 }] : undefined, videos: m.videoRef ? [{ url: `/api/moment/${m.id}` }] : undefined },
    twitter: { card: "summary_large_image", title: m.title, images: image ? [image] : undefined },
  };
}

/** Public page of a broadcast moment: the clip, who cut it, share, and "watch live" (the growth loop). */
export default async function MomentPage({ params }: Props) {
  const { id } = await params;
  const [m, { t }] = await Promise.all([load(id), getI18n()]);
  if (!m) notFound();
  if (m.status === "READY") void prisma.tvMoment.update({ where: { id: m.id }, data: { views: { increment: 1 } } }).catch(() => {});
  const ch = await prisma.tvChannel.findUnique({ where: { slug: m.channelSlug }, select: { nameEn: true, nameRu: true } });
  return (
    <div className="mx-auto max-w-4xl px-4 pb-12 pt-[calc(var(--header-h)+28px)] md:px-10">
      <p className="flex items-center gap-2 text-sm font-semibold text-accent">
        <Scissors size={16} /> {t.moments.title}
      </p>
      <h1 className="mt-1 font-display text-2xl font-bold md:text-3xl">{m.title}</h1>
      <p className="mt-1 text-sm text-muted">
        {fmt(t.moments.from, { channel: ch?.nameEn ?? m.channelSlug })} · {m.user.name} · {fmt(t.moments.views, { n: m.views })}
      </p>
      <div className="mt-5">
        <MomentView id={m.id} status={m.status} title={m.title} image={mediaUrl(m.thumbRef)} />
      </div>
      <Link href={`/?ch=${encodeURIComponent(m.channelSlug)}`} className={btn("glass", "lg", "mt-6")}>
        <Radio size={18} className="text-[#ff3b3b]" /> {t.moments.watchLive}
      </Link>
    </div>
  );
}
