import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { isAdultMode } from "./spicy";
import { mediaUrl } from "./files";
import { pick, type Locale } from "@/i18n/shared";

/**
 * Songs ↔ series. A series author tags songs from the songs section in their episodes ("plays at 12:30");
 * the player shows "♪ <song> → My music" while it plays, and the song (in the feed, on its page, on the
 * music channel) shows "Plays in <series> · ep. N" → straight to that moment of the episode.
 */

export class SongLinkError extends Error {
  constructor(public code: "AUTH" | "NOT_FOUND" | "INVALID" | "LIMIT") {
    super(code);
  }
}

/** At most this many songs per episode (the chip must stay a small hint, not a playlist). */
export const SONG_USES_PER_EPISODE = 12;

export type SongRef = { id: string; title: string; artist: string; cover: string | null; atSec: number; lenSec: number };
export type SongUseRef = { episodeId: string; number: number; seriesSlug: string; seriesTitle: string; atSec: number };

type Viewer = { role: string; kidsMode: boolean; showAdult?: boolean; adultConfirmedAt?: Date | null } | null;

/** Series this viewer may be sent to (same rules as the catalog). */
function seriesWhere(viewer: Viewer): Prisma.SeriesWhereInput {
  if (viewer?.kidsMode) return { status: "PUBLISHED", isFamilySafe: true };
  const adult = !!viewer && isAdultMode({ ...viewer, showAdult: !!viewer.showAdult, adultConfirmedAt: viewer.adultConfirmedAt ?? null } as Parameters<typeof isAdultMode>[0]);
  return adult ? { status: "PUBLISHED" } : { status: "PUBLISHED", isAdult: false };
}

/** Songs tagged in an episode (published songs only), in the order they play. */
export async function episodeSongs(episodeId: string): Promise<SongRef[]> {
  const uses = await prisma.songUse.findMany({
    where: { episodeId, song: { status: "PUBLISHED" } },
    orderBy: { atSec: "asc" },
    include: { song: { select: { id: true, title: true, artist: true, coverRef: true, user: { select: { name: true } } } } },
  });
  return uses.map((u) => ({ id: u.song.id, title: u.song.title, artist: u.song.artist || u.song.user.name, cover: mediaUrl(u.song.coverRef), atSec: u.atSec, lenSec: u.lenSec }));
}

/** Where a song plays in series this viewer can watch (released episodes only). */
export async function songUses(songId: string, viewer: Viewer, locale: Locale): Promise<SongUseRef[]> {
  const now = new Date();
  const uses = await prisma.songUse.findMany({
    where: { songId, episode: { OR: [{ publishAt: null }, { publishAt: { lte: now } }], series: seriesWhere(viewer) } },
    orderBy: { createdAt: "asc" },
    take: 6,
    include: { episode: { select: { id: true, number: true, series: { select: { slug: true, titleRu: true, titleEn: true } } } } },
  });
  return uses.map((u) => ({ episodeId: u.episode.id, number: u.episode.number, seriesSlug: u.episode.series.slug, seriesTitle: pick(u.episode.series, "title", locale), atSec: u.atSec }));
}

/** The song behind a music video on TV (sent there from the songs chart), if any. */
export async function songForClip(clipId: string) {
  const track = await prisma.musicTrack.findFirst({ where: { clipId }, select: { id: true } });
  if (!track) return null;
  return prisma.song.findFirst({ where: { airedTrackId: track.id, status: "PUBLISHED" }, select: { id: true, title: true, artist: true, user: { select: { name: true } } } });
}

/** Many songs at once (feed cards): songId → first place it plays. */
export async function firstUses(songIds: string[], viewer: Viewer, locale: Locale): Promise<Map<string, SongUseRef>> {
  if (!songIds.length) return new Map();
  const now = new Date();
  const uses = await prisma.songUse.findMany({
    where: { songId: { in: songIds }, episode: { OR: [{ publishAt: null }, { publishAt: { lte: now } }], series: seriesWhere(viewer) } },
    orderBy: { createdAt: "asc" },
    include: { episode: { select: { id: true, number: true, series: { select: { slug: true, titleRu: true, titleEn: true } } } } },
  });
  const out = new Map<string, SongUseRef>();
  for (const u of uses)
    if (!out.has(u.songId))
      out.set(u.songId, { episodeId: u.episode.id, number: u.episode.number, seriesSlug: u.episode.series.slug, seriesTitle: pick(u.episode.series, "title", locale), atSec: u.atSec });
  return out;
}

type Editor = { id: string; role: string };

async function ownEpisode(user: Editor, episodeId: string) {
  const ep = await prisma.episode.findUnique({ where: { id: episodeId }, select: { id: true, durationSec: true, series: { select: { creatorId: true } } } });
  if (!ep) throw new SongLinkError("NOT_FOUND");
  if (user.role !== "ADMIN" && ep.series.creatorId !== user.id) throw new SongLinkError("AUTH");
  return ep;
}

/** Studio: "this song plays in this episode at `atSec` for about `lenSec`". Re-tagging the same song moves it. */
export async function tagSong(user: Editor, input: { episodeId: string; songId: string; atSec: number; lenSec?: number }) {
  const ep = await ownEpisode(user, input.episodeId);
  const song = await prisma.song.findFirst({ where: { id: input.songId, status: "PUBLISHED" }, select: { id: true } });
  if (!song) throw new SongLinkError("NOT_FOUND");
  const atSec = Number(input.atSec);
  const lenSec = Math.round(Math.min(600, Math.max(5, Number(input.lenSec) || 30)));
  if (!isFinite(atSec) || atSec < 0 || (ep.durationSec > 0 && atSec > ep.durationSec + 1)) throw new SongLinkError("INVALID");
  const count = await prisma.songUse.count({ where: { episodeId: ep.id, NOT: { songId: song.id } } });
  if (count >= SONG_USES_PER_EPISODE) throw new SongLinkError("LIMIT");
  return prisma.songUse.upsert({
    where: { songId_episodeId: { songId: song.id, episodeId: ep.id } },
    create: { songId: song.id, episodeId: ep.id, atSec, lenSec, addedById: user.id },
    update: { atSec, lenSec },
  });
}

export async function untagSong(user: Editor, useId: string) {
  const u = await prisma.songUse.findUnique({ where: { id: useId }, select: { episodeId: true } });
  if (!u) return;
  await ownEpisode(user, u.episodeId);
  await prisma.songUse.delete({ where: { id: useId } });
}

/** Studio picker: published songs by title / artist. */
export function findSongs(q: string) {
  const s = q.trim().slice(0, 60);
  return prisma.song.findMany({
    where: { status: "PUBLISHED", ...(s ? { OR: [{ title: { contains: s } }, { artist: { contains: s } }] } : {}) },
    orderBy: s ? { saves: "desc" } : { createdAt: "desc" },
    take: 8,
    select: { id: true, title: true, artist: true, durationSec: true, user: { select: { name: true } } },
  });
}

/** Studio: all tags in a series, per episode. */
export async function seriesSongUses(seriesId: string) {
  return prisma.songUse.findMany({
    where: { episode: { seriesId } },
    orderBy: [{ episode: { number: "asc" } }, { atSec: "asc" }],
    include: { song: { select: { id: true, title: true, artist: true, status: true, user: { select: { name: true } } } }, episode: { select: { number: true } } },
  });
}
