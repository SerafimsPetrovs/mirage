import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./db";
import { recordAudience } from "./tv-live";
import { tvAnalytics } from "./tv-analytics";

const tag = Date.now().toString(36);
let channelId = "";

afterAll(async () => {
  await prisma.tvChannelStat.deleteMany({ where: { channelId } });
  await prisma.tvChannel.deleteMany({ where: { id: channelId } });
});

describe("channel analytics", () => {
  it("counts watched minutes per hour and shows them per channel", async () => {
    channelId = (await prisma.tvChannel.create({ data: { slug: `an-${tag}`, number: 9800 + Math.floor(Math.random() * 99), nameRu: "А", nameEn: "A", kind: "ABSURD", hostName: "H", hostPersona: "p" } })).id;
    const at = new Date(Date.UTC(2026, 10, 17, 20, 5));
    await recordAudience(channelId, at);
    await recordAudience(channelId, at);
    await recordAudience(channelId, new Date(Date.UTC(2026, 10, 17, 21, 0)));
    const a = await tvAnalytics(7, new Date(Date.UTC(2026, 10, 18)));
    const ch = a.channels.find((c) => c.id === channelId)!;
    expect(ch.minutes).toBe(3);
    expect(a.hourly[20]).toBeGreaterThanOrEqual(2);
    expect(a.hourly[21]).toBeGreaterThanOrEqual(1);
  });
});
