/** Broadcast moments: cut the last seconds of a clip on air into a shareable mp4 + thumbnail; nothing to cut on host cards. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "./db";
import { createMoment } from "./moments";
import { runOneJob } from "./jobs";
import { TvError } from "./tv";

const tag = Date.now().toString(36);
let slug = "";
let user: Awaited<ReturnType<typeof prisma.user.create>>;
const viewer = () => ({ ...user, kidsMode: false });

beforeAll(async () => {
  user = await prisma.user.create({ data: { email: `mo-${tag}@m.test`, name: "Cutter", passwordHash: "x" } });
  const ch = await prisma.tvChannel.create({ data: { slug: `mom-${tag}`, number: 9600 + Math.floor(Math.random() * 99), nameRu: "М", nameEn: "M", kind: "ABSURD", hostName: "H", hostPersona: "p" } });
  slug = ch.slug;
  const clip = await prisma.tvClip.create({ data: { channelId: ch.id, title: "Funny bit", videoUrl: "demo:h-ocean.mp4", durationSec: 14, status: "APPROVED" } });
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  // a host card first, then the clip that started 10 s ago
  await prisma.tvSlot.create({ data: { channelId: ch.id, day, startsAt: new Date(now - 60_000), durationSec: 50, kind: "HOST" } });
  await prisma.tvSlot.create({ data: { channelId: ch.id, day, startsAt: new Date(now - 10_000), durationSec: 14, kind: "CLIP", clipId: clip.id } });
});

afterAll(async () => {
  await prisma.tvChannel.deleteMany({ where: { slug } });
  await prisma.user.deleteMany({ where: { id: user.id } });
});

describe("moments", () => {
  it("cuts the clip on air into a shareable video", { timeout: 60_000 }, async () => {
    const m = await createMoment(viewer(), slug, Date.now());
    expect(m.startSec).toBe(0);
    expect(m.durationSec).toBeGreaterThan(9);
    while (await runOneJob()) {
      /* drain */
    }
    const done = await prisma.tvMoment.findUniqueOrThrow({ where: { id: m.id } });
    expect(done.status).toBe("READY");
    for (const ref of [done.videoRef!, done.thumbRef!]) {
      const file = path.join(process.cwd(), "storage", ref.replace("storage:", ""));
      expect(fs.statSync(file).size).toBeGreaterThan(1000);
      fs.rmSync(file, { force: true });
    }
  });

  it("refuses host cards, guests and family mode", async () => {
    // only admins can rewind the air: an admin clipping 30 s back lands on the host card…
    await expect(createMoment({ ...viewer(), role: "ADMIN" }, slug, Date.now() - 30_000)).rejects.toMatchObject({ code: "STATE" });
    // …a viewer's past time is ignored, they always clip "now"
    const m = await createMoment(viewer(), slug, Date.now() - 30_000);
    expect(m.title).toBe("Funny bit");
    await prisma.job.deleteMany({ where: { payload: { contains: m.id } } });
    await prisma.tvMoment.delete({ where: { id: m.id } });
    await expect(createMoment(null, slug, Date.now())).rejects.toBeInstanceOf(TvError);
    await expect(createMoment({ ...viewer(), kidsMode: true }, slug, Date.now())).rejects.toMatchObject({ code: "AUTH" });
  });
});
