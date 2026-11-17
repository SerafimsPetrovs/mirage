/** Music videos end to end: viewer order → review → queue → real ffmpeg render → TvClip with captions; refunds; rights. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { prisma } from "./db";
import { hashPassword } from "./auth";
import { createTrack, moderateTrack, orderTrack, queueRender, saveTimings } from "./music";
import { runOneJob } from "./jobs";
import { MUSIC_ORDER_PRICE } from "./music-rules";
import { TvError } from "./tv";

const tag = Date.now().toString(36);
const audioName = `test-${tag}.mp3`;
const audioRef = `storage:audio/${audioName}`;
let channelId = "";
type U = Awaited<ReturnType<typeof prisma.user.create>>;
let admin: U, viewer: U;
const actor = (u: U) => ({ id: u.id, role: u.role, kidsMode: false });

beforeAll(async () => {
  const dir = path.join(process.cwd(), "storage", "audio");
  fs.mkdirSync(dir, { recursive: true });
  execFileSync(ffmpegPath as string, ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "aevalsrc='0.8*sin(2*PI*60*t)*exp(-25*mod(t\\,0.5))+0.2*sin(2*PI*330*t)':s=22050:d=8", "-b:a", "96k", path.join(dir, audioName)]);
  const pw = await hashPassword("x12345");
  admin = await prisma.user.create({ data: { email: `ma-${tag}@m.test`, name: "Admin", role: "ADMIN", passwordHash: pw } });
  viewer = await prisma.user.create({ data: { email: `mv-${tag}@m.test`, name: "Fan", passwordHash: pw, bonusCoins: 1000 } });
  channelId = (await prisma.tvChannel.create({ data: { slug: `mus-${tag}`, number: 9700 + Math.floor(Math.random() * 200), nameRu: "Муз", nameEn: "Mus", kind: "MUSIC", hostName: "H", hostPersona: "p" } })).id;
});

afterAll(async () => {
  await prisma.tvChannel.deleteMany({ where: { id: channelId } });
  await prisma.user.deleteMany({ where: { email: { endsWith: `-${tag}@m.test` } } });
  fs.rmSync(path.join(process.cwd(), "storage", "audio", audioName), { force: true });
});

const base = () => ({ channelId, title: "Test Song", artist: "Band", audioRef, style: "KARAOKE", rightsOk: true, lyrics: "[Verse]\nfirst line here\nsecond line here" });

describe("music tracks", () => {
  it("refuses tracks without the rights confirmation and viewers creating free drafts", async () => {
    await expect(createTrack(actor(admin), { ...base(), rightsOk: false })).rejects.toMatchObject({ code: "RIGHTS" });
    await expect(createTrack(actor(viewer), base())).rejects.toBeInstanceOf(TvError);
    await expect(createTrack(actor(admin), { ...base(), audioRef: "storage:videos/x.mp4" })).rejects.toMatchObject({ code: "STATE" });
  });

  it("viewer order: paid, reviewed, rejected → coins back", async () => {
    const { track } = await orderTrack(actor(viewer), base());
    expect((await prisma.user.findUniqueOrThrow({ where: { id: viewer.id } })).bonusCoins).toBe(1000 - MUSIC_ORDER_PRICE);
    expect(await queueRender(actor(viewer), track.id)).toBe("REVIEW");
    await moderateTrack(track.id, "reject", "not your song");
    expect((await prisma.musicTrack.findUniqueOrThrow({ where: { id: track.id } })).status).toBe("REJECTED");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: viewer.id } })).bonusCoins).toBe(1000);
    await expect(moderateTrack(track.id, "reject")).rejects.toBeInstanceOf(TvError); // no double refund
  });

  it("approved order renders in the background into an aired music clip with captions", { timeout: 120_000 }, async () => {
    const { track } = await orderTrack(actor(viewer), base());
    await saveTimings(actor(viewer), track.id, [{ t: 1.5, text: "first line here" }, { t: 4, text: "second line here" }]);
    await queueRender(actor(viewer), track.id);
    await moderateTrack(track.id, "approve");
    expect(await prisma.job.count({ where: { kind: "music.render", status: "QUEUED", payload: { contains: track.id } } })).toBe(1);
    // drain the queue (the music handler is registered by importing ./music)
    while (await runOneJob()) {
      /* run */
    }
    const done = await prisma.musicTrack.findUniqueOrThrow({ where: { id: track.id } });
    expect(done.status).toBe("READY");
    expect(done.durationSec).toBe(8);
    expect(Math.abs(done.bpm - 120) < 3 || Math.abs(done.bpm - 60) < 2).toBe(true);
    const clip = await prisma.tvClip.findUniqueOrThrow({ where: { id: done.clipId! } });
    expect(clip).toMatchObject({ kind: "MUSIC", status: "APPROVED", sponsorName: "Fan", channelId });
    expect(clip.captions).toContain("♪ first line here");
    const file = path.join(process.cwd(), clip.videoUrl.replace("storage:", "storage/"));
    expect(fs.statSync(file).size).toBeGreaterThan(10_000);
    fs.rmSync(file, { force: true });
  });

  it("staff tracks skip review; creators' clips wait for moderation", async () => {
    const t = await createTrack(actor(admin), base());
    expect(await queueRender(actor(admin), t.id)).toBe("QUEUED");
    // someone else's track is invisible
    await expect(saveTimings(actor(viewer), t.id, [])).rejects.toMatchObject({ code: "NOT_FOUND" });
    await prisma.job.deleteMany({ where: { payload: { contains: t.id } } });
  });
});
