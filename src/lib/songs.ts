import "server-only";
import { prisma } from "./db";
import { resolveMediaPath } from "./files";
import { analyzeAudio } from "./music-render";
import { createTrack, queueRender } from "./music";
import { rateLimit } from "./rate-limit";
import { normalizeText } from "./tv-rules";
import { TvError } from "./tv";
import { AI_TOOLS, BLOCKED_TOOLS, clampHook, feedScore, SONG_GENRES, type AiTool } from "./song-rules";

type User = { id: string; role: string; kidsMode: boolean; banned?: boolean } | null;

export class SongError extends Error {
  constructor(public code: "AUTH" | "KIDS" | "INVALID" | "RIGHTS" | "SUNO_FREE" | "RATE" | "NOT_FOUND" | "TOO_SHORT") {
    super(code);
  }
}

function need(user: User) {
  if (!user || user.banned) throw new SongError("AUTH");
  if (user.kidsMode) throw new SongError("KIDS");
  return user;
}

export type SongInput = {
  title: string;
  artist: string;
  genre: string;
  audioRef: string;
  coverRef?: string | null;
  lyrics?: string;
  hookStart: number;
  aiTool: string;
  rightsOk: boolean;
};

/** Anyone signed in publishes a song (rights confirmed; free-plan Suno refused). */
export async function createSong(rawUser: User, i: SongInput) {
  const user = need(rawUser);
  if (!rateLimit(`song-create:${user.id}`, 10, 24 * 3600_000).allowed) throw new SongError("RATE");
  const title = normalizeText(String(i.title ?? "")).slice(0, 100);
  if (title.length < 1) throw new SongError("INVALID");
  if (!/^storage:audio\/[\w.-]+$/.test(i.audioRef)) throw new SongError("INVALID");
  if (i.coverRef && !/^storage:images\/[\w.-]+$/.test(i.coverRef)) throw new SongError("INVALID");
  if (!(AI_TOOLS as readonly string[]).includes(i.aiTool)) throw new SongError("INVALID");
  if (BLOCKED_TOOLS.includes(i.aiTool as AiTool)) throw new SongError("SUNO_FREE");
  if (!i.rightsOk) throw new SongError("RIGHTS");
  const file = resolveMediaPath(i.audioRef);
  if (!file) throw new SongError("INVALID");
  const { duration, bpm } = await analyzeAudio(file).catch(() => {
    throw new SongError("INVALID");
  });
  if (duration < HOOK_MIN_SONG) throw new SongError("TOO_SHORT");
  const hook = clampHook(Number(i.hookStart), duration);
  return prisma.song.create({
    data: {
      userId: user.id,
      title,
      artist: normalizeText(String(i.artist ?? "")).slice(0, 80),
      genre: (SONG_GENRES as readonly string[]).includes(i.genre) ? i.genre : "other",
      audioRef: i.audioRef,
      coverRef: i.coverRef || null,
      lyrics: String(i.lyrics ?? "").slice(0, 8000),
      durationSec: Math.round(duration),
      bpm,
      hookStart: hook.start,
      hookLen: hook.len,
      aiTool: i.aiTool,
    },
  });
}
const HOOK_MIN_SONG = 20;

const songSelect = {
  id: true,
  title: true,
  artist: true,
  genre: true,
  coverRef: true,
  durationSec: true,
  hookStart: true,
  hookLen: true,
  aiTool: true,
  saves: true,
  hookPlays: true,
  createdAt: true,
  airedTrackId: true,
  user: { select: { id: true, name: true } },
} as const;

/** The next hooks for this viewer: not heard yet, best score first (guests: best of everything). */
export async function songFeed(user: User, exclude: string[] = [], take = 8) {
  const seen = user ? (await prisma.songSeen.findMany({ where: { userId: user.id }, select: { songId: true } })).map((s) => s.songId) : [];
  const skip = new Set([...seen, ...exclude.slice(0, 200)]);
  const pool = await prisma.song.findMany({ where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 400, select: songSelect });
  const now = Date.now();
  let fresh = pool.filter((s) => !skip.has(s.id));
  // everything heard: start over with the best ones (minus this session's)
  if (fresh.length < take) fresh = pool.filter((s) => !exclude.includes(s.id));
  const saved = user ? new Set((await prisma.songSave.findMany({ where: { userId: user.id, songId: { in: fresh.map((s) => s.id) } }, select: { songId: true } })).map((s) => s.songId)) : new Set<string>();
  return fresh
    .map((s) => ({ s, score: feedScore(s, now) * (0.85 + Math.random() * 0.3) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, take)
    .map(({ s }) => ({ ...s, saved: saved.has(s.id) }));
}

export type FeedSong = Awaited<ReturnType<typeof songFeed>>[number];

/** The viewer heard a hook (counted once per viewer). */
export async function hookHeard(user: User, songId: string) {
  if (!user) {
    await prisma.song.updateMany({ where: { id: songId, status: "PUBLISHED" }, data: { hookPlays: { increment: 1 } } });
    return;
  }
  try {
    await prisma.songSeen.create({ data: { userId: user.id, songId } });
    await prisma.song.update({ where: { id: songId }, data: { hookPlays: { increment: 1 } } });
  } catch {
    /* already heard */
  }
}

export async function songPlayed(songId: string) {
  await prisma.song.updateMany({ where: { id: songId, status: "PUBLISHED" }, data: { plays: { increment: 1 } } });
}

/** ♥ = add the whole song to "My music" (toggle). */
export async function toggleSave(rawUser: User, songId: string) {
  const user = need(rawUser);
  const song = await prisma.song.findUnique({ where: { id: songId }, select: { status: true } });
  if (!song || song.status !== "PUBLISHED") throw new SongError("NOT_FOUND");
  const has = await prisma.songSave.findUnique({ where: { userId_songId: { userId: user.id, songId } } });
  if (has) {
    await prisma.$transaction([prisma.songSave.delete({ where: { userId_songId: { userId: user.id, songId } } }), prisma.song.update({ where: { id: songId }, data: { saves: { decrement: 1 } } })]);
    return false;
  }
  await prisma.$transaction([prisma.songSave.create({ data: { userId: user.id, songId } }), prisma.song.update({ where: { id: songId }, data: { saves: { increment: 1 } } })]);
  return true;
}

export async function mySongs(userId: string) {
  const [saved, uploaded] = await Promise.all([
    prisma.songSave.findMany({ where: { userId, song: { status: "PUBLISHED" } }, orderBy: { createdAt: "desc" }, take: 200, include: { song: { select: songSelect } } }),
    prisma.song.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100, select: { ...songSelect, status: true, plays: true } }),
  ]);
  return { saved: saved.map((s) => s.song), uploaded };
}

/** Weekly chart: most ♥ in the last 7 days (ties: hook plays). */
export async function songChart(days = 7, take = 20, now = new Date()) {
  const since = new Date(now.getTime() - days * 86400_000);
  const rows = await prisma.songSave.groupBy({ by: ["songId"], where: { createdAt: { gte: since }, song: { status: "PUBLISHED" } }, _count: { _all: true }, orderBy: { _count: { songId: "desc" } }, take: take * 2 });
  const songs = await prisma.song.findMany({ where: { id: { in: rows.map((r) => r.songId) } }, select: songSelect });
  return rows
    .map((r) => ({ week: r._count._all, song: songs.find((s) => s.id === r.songId)! }))
    .filter((x) => x.song)
    .sort((a, b) => b.week - a.week || b.song.hookPlays - a.song.hookPlays)
    .slice(0, take);
}

export async function getSong(id: string) {
  return prisma.song.findUnique({ where: { id: id.slice(0, 40) }, select: { ...songSelect, lyrics: true, status: true, plays: true, bpm: true } });
}

/** Admin: the chart song goes on air — a music video is rendered for the music channel and scheduled. */
export async function sendSongToAir(admin: { id: string; role: string; kidsMode: boolean }, songId: string, channelId: string, style = "KARAOKE") {
  if (admin.role !== "ADMIN" || admin.kidsMode) throw new SongError("AUTH");
  const s = await prisma.song.findUnique({ where: { id: songId } });
  if (!s || s.status !== "PUBLISHED") throw new SongError("NOT_FOUND");
  if (s.airedTrackId) return s.airedTrackId;
  let track;
  try {
    track = await createTrack(admin, { channelId, title: s.title, artist: s.artist, audioRef: s.audioRef, coverRef: s.coverRef, lyrics: s.lyrics, style, rightsOk: true });
  } catch (e) {
    if (e instanceof TvError) throw new SongError(e.code === "NOT_FOUND" ? "NOT_FOUND" : "INVALID");
    throw e;
  }
  await queueRender(admin, track.id);
  await prisma.song.update({ where: { id: s.id }, data: { airedTrackId: track.id } });
  return track.id;
}

export async function hideSong(admin: { role: string }, songId: string, hidden: boolean) {
  if (admin.role !== "ADMIN") throw new SongError("AUTH");
  await prisma.song.update({ where: { id: songId }, data: { status: hidden ? "HIDDEN" : "PUBLISHED" } });
}
