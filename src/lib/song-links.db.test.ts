/** Songs ↔ series: authors tag songs in their episodes; songs link back only to episodes the viewer may watch. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { prisma } from "./db";
import { episodeSongs, firstUses, SongLinkError, songForClip, songUses, tagSong, untagSong } from "./song-links";
import { analyzeClipBeats, clipBeatMap } from "./clip-beats";
import { parseBeatMap } from "./music-rules";

const tag = Date.now().toString(36);
type U = Awaited<ReturnType<typeof prisma.user.create>>;
let creator: U, other: U, admin: U;
let eps: string[] = [];
let adultEp = "";
let songId = "";
let song2 = "";
const audioName = `link-${tag}.mp3`;

beforeAll(async () => {
  creator = await prisma.user.create({ data: { email: `lc-${tag}@l.test`, name: "C", role: "CREATOR", passwordHash: "x" } });
  other = await prisma.user.create({ data: { email: `lo-${tag}@l.test`, name: "O", role: "CREATOR", passwordHash: "x" } });
  admin = await prisma.user.create({ data: { email: `la-${tag}@l.test`, name: "A", role: "ADMIN", passwordHash: "x" } });
  const s = await prisma.series.create({
    data: {
      slug: `ln-${tag}`, titleRu: "Сериал", titleEn: "Show", descriptionRu: "", descriptionEn: "", status: "PUBLISHED", creatorId: creator.id,
      episodes: {
        create: [
          { number: 1, videoUrl: "demo:v-teal.mp4", durationSec: 120 },
          { number: 2, videoUrl: "demo:v-teal.mp4", durationSec: 120, publishAt: new Date(Date.now() + 86400_000) },
        ],
      },
    },
    include: { episodes: { orderBy: { number: "asc" } } },
  });
  eps = s.episodes.map((e) => e.id);
  const a = await prisma.series.create({
    data: { slug: `lna-${tag}`, titleRu: "18", titleEn: "18", descriptionRu: "", descriptionEn: "", status: "PUBLISHED", isAdult: true, creatorId: creator.id, episodes: { create: [{ number: 1, videoUrl: "demo:v-teal.mp4" }] } },
    include: { episodes: true },
  });
  adultEp = a.episodes[0].id;
  songId = (await prisma.song.create({ data: { userId: other.id, title: "Theme", artist: "Band", audioRef: "storage:audio/x.mp3", durationSec: 60 } })).id;
  song2 = (await prisma.song.create({ data: { userId: other.id, title: "Outro", artist: "", audioRef: "storage:audio/y.mp3", durationSec: 60 } })).id;
});

afterAll(async () => {
  await prisma.series.deleteMany({ where: { creatorId: creator.id } });
  await prisma.user.deleteMany({ where: { email: { endsWith: `-${tag}@l.test` } } });
  fs.rmSync(path.join(process.cwd(), "storage", "audio", audioName), { force: true });
});

describe("song links", () => {
  it("only the series author (or an admin) tags songs, inside the episode", async () => {
    const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof SongLinkError ? e.code : String(e)));
    expect(await code(tagSong(other, { episodeId: eps[0], songId, atSec: 10 }))).toBe("AUTH");
    expect(await code(tagSong(creator, { episodeId: eps[0], songId, atSec: 500 }))).toBe("INVALID");
    expect(await code(tagSong(creator, { episodeId: eps[0], songId: "nope", atSec: 10 }))).toBe("NOT_FOUND");
    await tagSong(creator, { episodeId: eps[0], songId: song2, atSec: 90, lenSec: 20 });
    await tagSong(creator, { episodeId: eps[0], songId, atSec: 10 });
    await tagSong(creator, { episodeId: eps[0], songId, atSec: 12, lenSec: 40 }); // re-tag moves it
    await tagSong(admin, { episodeId: eps[1], songId, atSec: 5 });
    await tagSong(creator, { episodeId: adultEp, songId, atSec: 5 });
    const list = await episodeSongs(eps[0]);
    expect(list.map((x) => [x.title, x.atSec, x.lenSec])).toEqual([["Theme", 12, 40], ["Outro", 90, 20]]);
    expect(list[1].artist).toBe("O"); // falls back to the uploader's name
  });

  it("a song links only to released, non-18+ episodes", async () => {
    const uses = await songUses(songId, null, "en");
    expect(uses).toHaveLength(1);
    expect(uses[0]).toMatchObject({ episodeId: eps[0], number: 1, seriesTitle: "Show", atSec: 12 });
    expect((await firstUses([songId, song2], null, "ru")).get(songId)?.seriesTitle).toBe("Сериал");
    // a hidden song disappears from the episode
    await prisma.song.update({ where: { id: song2 }, data: { status: "HIDDEN" } });
    expect((await episodeSongs(eps[0])).map((x) => x.title)).toEqual(["Theme"]);
    const use = await prisma.songUse.findFirstOrThrow({ where: { songId, episodeId: eps[0] } });
    await expect(untagSong(other, use.id)).rejects.toBeInstanceOf(SongLinkError);
    await untagSong(creator, use.id);
    expect(await songUses(songId, null, "en")).toEqual([]);
  });
});

describe("clip beat maps", () => {
  it("queues one analysis for a music clip and stores tempo + drops", { timeout: 60_000 }, async () => {
    const dir = path.join(process.cwd(), "storage", "audio");
    fs.mkdirSync(dir, { recursive: true });
    // 20 s quiet, then a loud kick at 120 BPM
    execFileSync(ffmpegPath as string, [
      "-y", "-loglevel", "error",
      "-f", "lavfi", "-i", "sine=f=3000:d=40",
      "-f", "lavfi", "-i", "sine=f=55:d=40",
      "-filter_complex", "[0]volume=0.05[h];[1]volume='if(gte(t,20),0.9*exp(-8*mod(t,0.5)),0)':eval=frame[k];[h][k]amix=inputs=2:normalize=0",
      "-b:a", "96k", path.join(dir, audioName),
    ]);
    const ch = await prisma.tvChannel.create({ data: { slug: `lb-${tag}`, number: 9500 + Math.floor(Math.random() * 99), nameRu: "М", nameEn: "M", kind: "MUSIC", hostName: "H", hostPersona: "p" } });
    try {
      const clip = await prisma.tvClip.create({ data: { channelId: ch.id, kind: "MUSIC", title: "Banger", videoUrl: `storage:audio/${audioName}`, status: "APPROVED" } });
      expect(clipBeatMap(clip)).toBeNull();
      clipBeatMap(clip);
      expect(await prisma.job.count({ where: { kind: "clip.beats", payload: { contains: clip.id } } })).toBe(1);
      await analyzeClipBeats(clip.id);
      const map = parseBeatMap((await prisma.tvClip.findUniqueOrThrow({ where: { id: clip.id } })).beatJson);
      expect(map).not.toBeNull();
      expect(map!.drops.length).toBeGreaterThanOrEqual(1);
      expect(Math.abs(map!.drops[0].t - 20)).toBeLessThan(1.5);
      expect(clipBeatMap({ id: clip.id, kind: "SHOW", beatJson: "" })).toBeNull();
      // the clip on air knows its song (sent there from the songs chart) → "plays in <series>" on TV
      expect(await songForClip(clip.id)).toBeNull();
      const track = await prisma.musicTrack.create({ data: { channelId: ch.id, userId: admin.id, title: "Theme", audioRef: "storage:audio/x.mp3", status: "READY", clipId: clip.id } });
      await prisma.song.update({ where: { id: songId }, data: { airedTrackId: track.id } });
      expect((await songForClip(clip.id))?.id).toBe(songId);
      await prisma.job.deleteMany({ where: { payload: { contains: clip.id } } });
    } finally {
      await prisma.tvChannel.delete({ where: { id: ch.id } });
    }
  });
});
