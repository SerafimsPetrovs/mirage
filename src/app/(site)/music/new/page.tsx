import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Music2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { musicChannels } from "@/lib/music";
import { getI18n } from "@/i18n/server";
import { pick } from "@/i18n/shared";
import { TrackForm } from "@/components/music/track-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.music.newTitle };
}

/** Staff create a free draft; viewers (or anyone with ?order=1) order a moderated, paid music video. */
export default async function NewTrackPage({ searchParams }: { searchParams: Promise<{ order?: string; ch?: string }> }) {
  const user = await requireUser("/music/new");
  if (user.kidsMode) notFound();
  const sp = await searchParams;
  const { t, locale } = await getI18n();
  const m = t.music;
  const staff = user.role === "ADMIN" || user.role === "CREATOR";
  const order = !staff || sp.order === "1";
  const all = (await musicChannels()).map((c) => ({ id: c.id, slug: c.slug, name: pick(c, "name", locale) }));
  if (!all.length) notFound();
  // an order started from a channel goes to that channel
  const channels = sp.ch ? [...all.filter((c) => c.slug === sp.ch), ...all.filter((c) => c.slug !== sp.ch)] : all;
  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 pt-[calc(var(--header-h)+32px)] md:px-10">
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent ring-1 ring-accent/30">
          <Music2 size={26} />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">{order ? m.orderTitle : m.newTitle}</h1>
          <p className="mt-1 text-sm text-muted">{order ? m.orderSub : m.newSub}</p>
        </div>
      </div>
      <TrackForm channels={channels.map(({ id, name }) => ({ id, name }))} order={order} balance={user.coins} />
    </div>
  );
}
