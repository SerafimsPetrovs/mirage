/** Song feed: publish with a hook, rights rules (free Suno refused), feed without repeats, ♥, weekly chart, to the air. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { prisma } from "./db";
import { createSong, hookHeard, sendSongToAir, songChart, songFeed, SongError, toggleSave } from "./songs";
import { clampHook, feedScore, peaks } from "./song-rules";

const tag = Date.now().toString(36);
const audioName = `song-${tag}.mp3`;
const audioRef = `storage:audio/${audioName}`;
type U = Awaited<ReturnType<typeof prisma.user.create>>;
let author: U, fan: U, admin: U;
let channelId = "";
const as = (u: U) => ({ ...u, kidsMode: false });
const base = () => ({ title: "Hooky", artist: "Band", genre: "pop", audioRef, hookStart: 10, aiTool: "SUNO_PAID", rightsOk: true });

beforeAll(async () => {
  const dir = path.join(process.cwd(), "storage", "audio");
  fs.mkdirSync(dir, { recursive: true });
  execFileSync(ffmpegPath as string, ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=f=330:d=40", "-b:a", "64k", path.join(dir, audioName)]);
  author = await prisma.user.create({ data: { email: `sa-${tag}@s.test`, name: "Author", passwordHash: "x" } });
  fan = await prisma.user.create({ data: { email: `sf-${tag}@s.test`, name: "Fan", passwordHash: "x" } });
  admin = await prisma.user.create({ data: { email: `sx-${tag}@s.test`, name: "Admin", role: "ADMIN", passwordHash: "x" } });
  channelId = (await prisma.tvChannel.create({ data: { slug: `sch-${tag}`, number: 9900 + Math.floor(Math.random() * 99), nameRu: "М", nameEn: "M", kind: "MUSIC", hostName: "H", hostPersona: "p" } })).id;
});

afterAll(async () => {
  await prisma.tvChannel.deleteMany({ where: { id: channelId } });
  await prisma.user.deleteMany({ where: { email: { endsWith: `-${tag}@s.test` } } });
  fs.rmSync(path.join(process.cwd(), "storage", "audio", audioName), { force: true });
});

describe("song rules", () => {
  it("keeps the hook inside the song", () => {
    expect(clampHook(100, 40)).toEqual({ start: 25, len: 15 });
    expect(clampHook(-5, 40).start).toBe(0);
    expect(clampHook(3, 10)).toEqual({ start: 0, len: 10 });
  });
  it("ranks hooks people keep over hooks people only hear", () => {
    const old = new Date(Date.now() - 10 * 86400_000);
    expect(feedScore({ saves: 20, hookPlays: 100, createdAt: old })).toBeGreaterThan(feedScore({ saves: 1, hookPlays: 100, createdAt: old }));
    expect(feedScore({ saves: 0, hookPlays: 0, createdAt: new Date() })).toBeGreaterThan(feedScore({ saves: 0, hookPlays: 0, createdAt: old }));
  });
  it("makes waveform peaks", () => {
    const p = peaks(new Float32Array([0, 0.5, -1, 0.25]), 2);
    expect(p).toHaveLength(2);
    expect(Math.max(...p)).toBe(1);
  });
});

describe("songs", () => {
  it("publishes with the rights rules", { timeout: 30_000 }, async () => {
    const code = async (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof SongError ? e.code : String(e)));
    expect(await code(createSong(as(author), { ...base(), aiTool: "SUNO_FREE" }))).toBe("SUNO_FREE");
    expect(await code(createSong(as(author), { ...base(), rightsOk: false }))).toBe("RIGHTS");
    expect(await code(createSong(null, base()))).toBe("AUTH");
    const s = await createSong(as(author), base());
    expect(s.durationSec).toBe(40);
    expect(s.hookStart).toBe(10);
  });

  it("feed skips heard hooks; ♥ saves; chart counts the week; admin puts it on air", { timeout: 30_000 }, async () => {
    const s = await prisma.song.findFirstOrThrow({ where: { userId: author.id } });
    const first = await songFeed(as(fan));
    expect(first.some((x) => x.id === s.id)).toBe(true);
    await hookHeard(as(fan), s.id);
    await hookHeard(as(fan), s.id); // counted once
    expect((await prisma.song.findUniqueOrThrow({ where: { id: s.id } })).hookPlays).toBe(1);
    expect(await toggleSave(as(fan), s.id)).toBe(true);
    expect((await songChart()).find((x) => x.song.id === s.id)?.week).toBe(1);
    expect(await toggleSave(as(fan), s.id)).toBe(false);
    expect((await prisma.song.findUniqueOrThrow({ where: { id: s.id } })).saves).toBe(0);
    await toggleSave(as(fan), s.id);
    await expect(sendSongToAir(as(fan), s.id, channelId)).rejects.toBeInstanceOf(SongError);
    const trackId = await sendSongToAir(as(admin), s.id, channelId);
    const track = await prisma.musicTrack.findUniqueOrThrow({ where: { id: trackId } });
    expect(track).toMatchObject({ status: "QUEUED", audioRef, channelId });
    expect(await sendSongToAir(as(admin), s.id, channelId)).toBe(trackId); // idempotent
    await prisma.job.deleteMany({ where: { payload: { contains: trackId } } });
  });
});
