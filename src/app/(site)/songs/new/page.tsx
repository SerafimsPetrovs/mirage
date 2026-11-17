import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { SongForm } from "@/components/songs/song-form";
import { SongsNav } from "@/components/songs/songs-nav";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.songs.form.title };
}

export default async function NewSongPage() {
  const user = await requireUser("/songs/new");
  if (user.kidsMode) notFound();
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-[calc(var(--header-h)+24px)] md:px-10">
      <SongsNav active="new" />
      <h1 className="font-display text-2xl font-bold md:text-3xl">{t.songs.form.title}</h1>
      <p className="mb-8 mt-1 text-muted">{t.songs.form.sub}</p>
      <SongForm />
    </div>
  );
}
