import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./db";
import { grantCoins } from "./coins";
import { buyCameo, moderateCameo, publishScript, ShowError, topSupporters, writeNextScript } from "./show";
import { CAMEO_MAX_OPEN, CAMEO_PRICE } from "./show-rules";

const tag = Date.now().toString(36);
let creatorId: string;
let viewerId: string;
let seriesId: string;

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof ShowError ? e.code : e instanceof Error ? e.constructor.name : String(e);
  }
};
const total = async (id: string) => {
  const u = await prisma.user.findUniqueOrThrow({ where: { id }, select: { paidCoins: true, bonusCoins: true } });
  return u.paidCoins + u.bonusCoins;
};

beforeAll(async () => {
  creatorId = (await prisma.user.create({ data: { email: `sc${tag}@t.t`, name: "C", passwordHash: "x", role: "ADMIN" } })).id;
  viewerId = (await prisma.user.create({ data: { email: `sv${tag}@t.t`, name: "V", passwordHash: "x" } })).id;
  seriesId = (
    await prisma.series.create({
      data: {
        slug: `show-${tag}`, titleRu: "Шоу", titleEn: "Show", descriptionRu: "d", descriptionEn: "d", status: "PUBLISHED", interactive: true, creatorId,
        episodes: { create: [{ number: 1, videoUrl: "demo:v-teal.mp4" }] },
      },
    })
  ).id;
  await grantCoins(viewerId, 1000, "PURCHASE");
});

afterAll(async () => {
  await prisma.series.deleteMany({ where: { id: seriesId } });
  await prisma.user.deleteMany({ where: { id: { in: [creatorId, viewerId] } } });
});

describe("interactive show", () => {
  it("cameo costs coins, needs a clean name and is limited per viewer", async () => {
    expect(await code(buyCameo(viewerId, seriesId, "http://spam"))).toBe("NAME");
    const before = await total(viewerId);
    const c = await buyCameo(viewerId, seriesId, "  Тест  Имя ");
    expect(c.name).toBe("Тест Имя");
    expect(c.status).toBe("PENDING");
    expect(await total(viewerId)).toBe(before - CAMEO_PRICE);
    for (let i = 1; i < CAMEO_MAX_OPEN; i++) await buyCameo(viewerId, seriesId, `Имя${i}`);
    expect(await code(buyCameo(viewerId, seriesId, "Лишний"))).toBe("LIMIT");
  });

  it("rejecting a cameo refunds the coins; approving queues it", async () => {
    const [a, b] = await prisma.cameo.findMany({ where: { seriesId, status: "PENDING" }, orderBy: { createdAt: "asc" } });
    const before = await total(viewerId);
    await moderateCameo(a.id, "reject");
    expect(await total(viewerId)).toBe(before + CAMEO_PRICE);
    expect(await code(moderateCameo(a.id, "reject"))).toBe("STATE");
    await moderateCameo(b.id, "approve");
    expect((await prisma.cameo.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("APPROVED");
  });

  it("writes a script (template without LLM) and publishing airs queued cameos and opens a poll", async () => {
    const sc = await writeNextScript(seriesId);
    expect(sc.number).toBe(2);
    expect(sc.content).toContain("PROMPT:");
    const ep = await publishScript(sc.id, "demo:v-rose.mp4", 5);
    expect(ep.number).toBe(2);
    expect(await prisma.cameo.count({ where: { seriesId, status: "AIRED", episodeId: ep.id } })).toBe(1);
    expect(await prisma.cameo.count({ where: { seriesId, status: "APPROVED" } })).toBe(0);
    const poll = await prisma.poll.findFirstOrThrow({ where: { seriesId }, include: { options: true } });
    expect(poll.options).toHaveLength(2);
    expect(poll.closesAt.getTime()).toBeGreaterThan(Date.now());
    expect(await code(publishScript(sc.id, "demo:v-rose.mp4", 5))).toBe("STATE");
  });

  it("top supporters count cameo spending", async () => {
    const top = await topSupporters(seriesId);
    expect(top[0]?.id).toBe(viewerId);
    expect(top[0]?.coins).toBeGreaterThanOrEqual(CAMEO_PRICE * (CAMEO_MAX_OPEN - 1));
  });
});
