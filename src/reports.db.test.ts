/** Content reports: viewer reports, auto-hide, copyright form, admin resolution — through the real server actions. */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ user: null as null | Record<string, unknown>, headers: new Headers({ host: "localhost:3000" }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("next/headers", () => ({
  headers: async () => state.headers,
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));
vi.mock("@/lib/auth", async (orig) => {
  const real = await orig<typeof import("@/lib/auth")>();
  return { ...real, getCurrentUser: async () => state.user, getKidsMode: async () => !!state.user?.kidsMode };
});

import { prisma } from "@/lib/db";
import { copyrightNoticeAction, reportAction, resolveReportsAction } from "@/app/actions/reports";
import { addCommentAction } from "@/app/actions/library";
import { getReportQueue } from "@/lib/reports";

const tag = Date.now().toString(36);
type U = Awaited<ReturnType<typeof prisma.user.create>>;
let admin: U, creator: U, troll: U;
const viewers: U[] = [];
let seriesId: string, episodeId: string, characterId: string;

const as = (u: U | null, extra: Record<string, unknown> = {}) => {
  state.user = u ? { ...u, coins: 0, kidsMode: false, sessionId: "s", subscription: null, ...extra } : null;
};
const comment = async (by: U, body = "spam spam") => (await prisma.comment.create({ data: { userId: by.id, episodeId, body } })).id;

beforeAll(async () => {
  const mk = (n: string, role: "VIEWER" | "CREATOR" | "ADMIN" = "VIEWER") =>
    prisma.user.create({ data: { email: `${n}${tag}@reports-test.dev`, name: n, role, passwordHash: "x" } });
  [admin, creator, troll] = await Promise.all([mk("adm", "ADMIN"), mk("cr", "CREATOR"), mk("troll")]);
  for (let i = 0; i < 4; i++) viewers.push(await mk(`v${i}`));
  const s = await prisma.series.create({
    data: {
      slug: `rep-${tag}`, titleRu: "R", titleEn: "R", descriptionRu: "d", descriptionEn: "d", status: "PUBLISHED", creatorId: creator.id,
      episodes: { create: [{ number: 1, videoUrl: "demo:v-teal.mp4" }] },
      characters: { create: [{ nameRu: "C", nameEn: "C", persona: "p", age: 25 }] },
    },
    include: { episodes: true, characters: true },
  });
  seriesId = s.id;
  episodeId = s.episodes[0].id;
  characterId = s.characters[0].id;
});

afterAll(async () => {
  const userIds = [admin, creator, troll, ...viewers].map((u) => u.id);
  await prisma.report.deleteMany({ where: { OR: [{ reporterId: { in: userIds } }, { targetId: { contains: tag } }, { targetId: seriesId }] } });
  await prisma.series.deleteMany({ where: { id: seriesId } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

beforeEach(() => {
  state.headers = new Headers({ host: "localhost:3000", "x-forwarded-for": `10.1.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
});

describe("viewer reports", () => {
  it("guests and kids mode can't report", async () => {
    as(null);
    expect(await reportAction({ targetType: "SERIES", targetId: seriesId, reason: "spam" })).toEqual({ ok: false, error: "auth" });
    as(viewers[0], { kidsMode: true });
    expect(await reportAction({ targetType: "SERIES", targetId: seriesId, reason: "spam" })).toEqual({ ok: false, error: "kids" });
  });

  it("rejects unknown reasons, target types and extra fields", async () => {
    as(viewers[0]);
    expect(await reportAction({ targetType: "SERIES", targetId: seriesId, reason: "because" })).toEqual({ ok: false, error: "invalid" });
    expect(await reportAction({ targetType: "USER", targetId: admin.id, reason: "spam" })).toEqual({ ok: false, error: "invalid" });
    expect(await reportAction({ targetType: "SERIES", targetId: seriesId, reason: "spam", status: "RESOLVED" })).toEqual({ ok: false, error: "invalid" });
    expect(await reportAction({ targetType: "SERIES", targetId: "nope", reason: "spam" })).toEqual({ ok: false, error: "notFound" });
  });

  it("one report per person per target; you can't report yourself", async () => {
    as(viewers[0]);
    expect(await reportAction({ targetType: "CHARACTER", targetId: characterId, reason: "minors", details: "x" })).toEqual({ ok: true });
    expect(await reportAction({ targetType: "CHARACTER", targetId: characterId, reason: "abuse" })).toEqual({ ok: false, error: "duplicate" });
    as(creator);
    expect(await reportAction({ targetType: "SERIES", targetId: seriesId, reason: "spam" })).toEqual({ ok: false, error: "own" });
  });

  it("a comment is hidden automatically after 3 different reports", async () => {
    const id = await comment(troll);
    for (const [i, v] of viewers.slice(0, 3).entries()) {
      as(v);
      expect(await reportAction({ targetType: "COMMENT", targetId: id, reason: "spam" })).toEqual({ ok: true });
      const c = await prisma.comment.findUniqueOrThrow({ where: { id } });
      expect(c.hidden).toBe(i === 2);
    }
  });

  it("urgent reasons go first in the admin queue", async () => {
    const q = await getReportQueue();
    const mine = q.filter((g) => [seriesId, characterId].includes(g.targetId) || g.targetType === "COMMENT");
    expect(mine[0].targetId).toBe(characterId); // "minors" report
  });
});

describe("admin resolution", () => {
  it("only admins can resolve", async () => {
    for (const u of [null, viewers[0], creator]) {
      as(u);
      expect(await resolveReportsAction("CHARACTER", characterId, "dismiss")).toEqual({ ok: false, error: "forbidden" });
    }
    as(admin, { kidsMode: true });
    expect(await resolveReportsAction("CHARACTER", characterId, "dismiss")).toEqual({ ok: false, error: "forbidden" });
  });

  it("rejects unknown actions and 'hide' on a series", async () => {
    as(admin);
    expect(await resolveReportsAction("CHARACTER", characterId, "delete-everything")).toEqual({ ok: false, error: "invalid" });
    expect(await resolveReportsAction("SERIES", seriesId, "hide")).toEqual({ ok: false, error: "badAction" });
  });

  it("unpublishing a reported character takes its series down (no data deleted) and closes reports", async () => {
    as(admin);
    expect(await resolveReportsAction("CHARACTER", characterId, "unpublish")).toEqual({ ok: true });
    expect((await prisma.series.findUniqueOrThrow({ where: { id: seriesId } })).status).toBe("DRAFT");
    expect(await prisma.character.count({ where: { id: characterId } })).toBe(1);
    expect(await prisma.report.count({ where: { targetId: characterId, status: "OPEN" } })).toBe(0);
    expect(await prisma.adminLog.count({ where: { action: "report.unpublish", targetId: characterId } })).toBe(1);
    await prisma.series.update({ where: { id: seriesId }, data: { status: "PUBLISHED" } });
  });

  it("ban hides the comment, bans its author and ends their sessions; admins can't ban themselves", async () => {
    const id = await comment(troll, "abuse");
    await prisma.session.create({ data: { id: `h${tag}`, userId: troll.id, expiresAt: new Date(Date.now() + 86400_000) } });
    as(viewers[3]);
    await reportAction({ targetType: "COMMENT", targetId: id, reason: "abuse" });
    as(admin);
    expect(await resolveReportsAction("COMMENT", id, "ban")).toEqual({ ok: true });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: troll.id } })).banned).toBe(true);
    expect(await prisma.session.count({ where: { userId: troll.id } })).toBe(0);
    expect((await prisma.comment.findUniqueOrThrow({ where: { id } })).hidden).toBe(true);

    const own = await comment(admin, "mine");
    as(viewers[3]);
    await reportAction({ targetType: "COMMENT", targetId: own, reason: "spam" });
    as(admin);
    expect(await resolveReportsAction("COMMENT", own, "ban")).toEqual({ ok: false, error: "badAction" });
  });
});

describe("copyright form (no account)", () => {
  const good = { url: `https://mirage.example/series/rep-${tag}`, name: "Rights Co", email: "legal@rights.example", details: "This is my film, copied without a license.", confirm: true };

  it("stores only the path of a link to our site", async () => {
    as(null);
    expect(await copyrightNoticeAction(good)).toEqual({ ok: true });
    const r = await prisma.report.findFirstOrThrow({ where: { targetType: "URL", targetId: `/series/rep-${tag}` } });
    expect(r.reporterId).toBeNull();
    expect(r.contactEmail).toBe("legal@rights.example");
  });

  it("rejects bad input: no confirmation, javascript: links, protocol-relative links, short details", async () => {
    as(null);
    for (const bad of [
      { ...good, confirm: false },
      { ...good, url: "javascript:alert(1)" },
      { ...good, url: "//evil.example/x" },
      { ...good, details: "short" },
      { ...good, email: "<script>@x" },
      { ...good, extra: 1 },
    ]) {
      expect(await copyrightNoticeAction(bad)).toEqual({ ok: false, error: "invalid" });
    }
  });

  it("is rate-limited per IP", async () => {
    as(null);
    state.headers = new Headers({ host: "localhost:3000", "x-forwarded-for": `10.9.9.${tag.length}` });
    const results = [];
    for (let i = 0; i < 7; i++) results.push((await copyrightNoticeAction({ ...good, url: `/series/rep-${tag}-${i}` })).ok);
    expect(results.filter(Boolean).length).toBe(5);
  });
});

describe("comment spam limit", () => {
  it("allows 6 comments a minute, then tooMany", async () => {
    as(viewers[1]);
    const res = [];
    for (let i = 0; i < 8; i++) res.push(await addCommentAction(episodeId, `hi ${i}`));
    expect(res.filter((r) => r.ok).length).toBe(6);
    expect(res[7]).toEqual({ ok: false, error: "tooMany" });
  });
});
