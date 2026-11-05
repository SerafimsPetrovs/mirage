/**
 * Security tests against the real server actions / route handlers and the test database:
 * authorization (roles, ownership, IDOR), brute force limits, Host-header injection,
 * SQL/LIKE injection, mass assignment, upload validation and CSRF origin checks.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// ---- framework mocks: the current user and request headers are controlled by each test
const state = vi.hoisted(() => ({ user: null as null | Record<string, unknown>, headers: new Headers({ host: "localhost:3000" }) }));

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));
vi.mock("next/headers", () => ({
  headers: async () => state.headers,
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));
vi.mock("@/lib/auth", async (orig) => {
  const real = await orig<typeof import("@/lib/auth")>();
  return { ...real, getCurrentUser: async () => state.user, getKidsMode: async () => !!state.user?.kidsMode, createSession: async () => {} };
});

import { prisma } from "@/lib/db";
import { grantCoins } from "@/lib/coins";
import { hashPassword } from "@/lib/auth";
import { createPromo } from "@/lib/promo";
import { searchSeries } from "@/lib/catalog";
import { en } from "@/i18n/en";
import { adjustCoinsAction, deleteSeriesAction, fulfillOrderAction, setChartRankAction, setVipAction, userToolAction } from "@/app/actions/admin-tools";
import { setSeriesFlagsAction, setUserRoleAction } from "@/app/actions/admin";
import { createPromoAction, redeemPromoAction } from "@/app/actions/promo";
import { forgotPasswordAction, loginAction } from "@/app/actions/auth";
import { addSkinAction, saveCharacterAction } from "@/app/actions/studio-extras";
import { adminPayoutAction } from "@/app/actions/payouts";
import { moderateCameoAction, buyCameoAction } from "@/app/actions/show";
import { unlockEpisodeAction } from "@/app/actions/wallet";
import { GET as streamGET } from "@/app/api/stream/[episodeId]/route";
import { POST as uploadPOST } from "@/app/api/studio/upload/route";

const tag = Date.now().toString(36);
type U = Awaited<ReturnType<typeof prisma.user.create>>;
let admin: U, viewer: U, creatorA: U, creatorB: U;
let seriesA: string, seriesB: string, lockedEp: string, draftEp: string, orderId: string;

const as = (u: U | null, extra: Record<string, unknown> = {}) => {
  state.user = u ? { ...u, coins: u.paidCoins + u.bonusCoins, kidsMode: false, sessionId: "s", subscription: null, ...extra } : null;
};
const coins = async (id: string) => {
  const u = await prisma.user.findUniqueOrThrow({ where: { id }, select: { paidCoins: true, bonusCoins: true } });
  return u.paidCoins + u.bonusCoins;
};

beforeAll(async () => {
  const mk = (n: string, role: "VIEWER" | "CREATOR" | "ADMIN", pw = "x") =>
    hashPassword(pw).then((passwordHash) => prisma.user.create({ data: { email: `${n}${tag}@security-test.dev`, name: n, role, passwordHash } }));
  [admin, viewer, creatorA, creatorB] = await Promise.all([mk("adm", "ADMIN"), mk("view", "VIEWER", "right-password"), mk("ca", "CREATOR"), mk("cb", "CREATOR")]);
  await grantCoins(viewer.id, 500, "PURCHASE");
  const base = { descriptionRu: "d", descriptionEn: "d", freeEpisodes: 1, defaultCoinPrice: 30 };
  const a = await prisma.series.create({
    data: { ...base, slug: `sa-${tag}`, titleRu: "A", titleEn: "A", status: "PUBLISHED", interactive: true, creatorId: creatorA.id, episodes: { create: [1, 2].map((number) => ({ number, videoUrl: "demo:v-teal.mp4" })) } },
    include: { episodes: { orderBy: { number: "asc" } } },
  });
  const b = await prisma.series.create({
    data: { ...base, slug: `sb-${tag}`, titleRu: "B", titleEn: "B", status: "DRAFT", creatorId: creatorB.id, episodes: { create: [{ number: 1, videoUrl: "demo:v-rose.mp4" }] } },
    include: { episodes: true },
  });
  seriesA = a.id;
  seriesB = b.id;
  lockedEp = a.episodes[1].id;
  draftEp = b.episodes[0].id;
  orderId = (await prisma.order.create({ data: { userId: viewer.id, kind: "COINS", sku: "coins_100", amountCents: 99, currency: "EUR", provider: "mock" } })).id;
});

afterAll(async () => {
  await prisma.series.deleteMany({ where: { id: { in: [seriesA, seriesB] } } });
  await prisma.user.deleteMany({ where: { id: { in: [admin.id, viewer.id, creatorA.id, creatorB.id] } } });
  await prisma.promoCode.deleteMany({ where: { code: { contains: tag.toUpperCase() } } });
});

beforeEach(() => {
  state.headers = new Headers({ host: "localhost:3000", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}` });
});

describe("authorization: admin-only actions", () => {
  it.each([
    ["viewer", () => viewer],
    ["creator", () => creatorA],
    ["guest", () => null],
  ])("%s gets 'forbidden' and nothing changes", async (_, who) => {
    as(who());
    const before = await coins(viewer.id);
    expect(await adjustCoinsAction(viewer.id, 1000, "paid", "x")).toEqual({ ok: false, error: "forbidden" });
    expect(await setVipAction(viewer.id, 365)).toEqual({ ok: false, error: "forbidden" });
    expect(await setChartRankAction(seriesA, 1)).toEqual({ ok: false, error: "forbidden" });
    expect(await deleteSeriesAction(seriesA, `sa-${tag}`)).toEqual({ ok: false, error: "forbidden" });
    expect(await fulfillOrderAction(orderId)).toEqual({ ok: false, error: "forbidden" });
    expect(await userToolAction(admin.id, "logout")).toEqual({ ok: false, error: "forbidden" });
    expect(await createPromoAction({ code: `HACK${tag}`, kind: "COINS", value: "99999", maxUses: "", expiresDays: "", note: "" })).toEqual({ ok: false, error: "forbidden" });
    expect((await adminPayoutAction("x", "PAID")).ok).toBe(false);
    expect((await moderateCameoAction("x", "approve")).ok).toBe(false);
    await expect(setUserRoleAction(viewer.id, "ADMIN")).rejects.toThrow();
    expect(await coins(viewer.id)).toBe(before);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: viewer.id } })).role).toBe("VIEWER");
    expect(await prisma.series.count({ where: { id: seriesA } })).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("PENDING");
  });
});

describe("authorization: ownership (IDOR)", () => {
  it("a creator can't add fan-service to someone else's series", async () => {
    as(creatorB);
    expect(await addSkinAction(lockedEp, { nameRu: "x", nameEn: "x", emoji: "x", rarity: "common", videoUrl: "storage:videos/a.mp4", price: "10" })).toEqual({ ok: false, error: "forbidden" });
    expect(await saveCharacterAction(seriesA, { nameRu: "x", nameEn: "x", taglineRu: "", taglineEn: "", greetingRu: "", greetingEn: "", persona: "x".repeat(30), age: "25", avatarUrl: "", hue: "1" })).toEqual({ ok: false, error: "forbidden" });
    expect(await prisma.skin.count({ where: { episodeId: lockedEp } })).toBe(0);
  });

  it("stream: locked episode needs access, drafts are hidden, guests get nothing", async () => {
    const get = (id: string) => streamGET(new Request(`http://localhost/api/stream/${id}`), { params: Promise.resolve({ episodeId: id }) });
    as(viewer);
    expect((await get(lockedEp)).status).toBe(403);
    expect((await get(draftEp)).status).toBe(404);
    as(null);
    expect((await get(lockedEp)).status).toBe(403);
    as(creatorA);
    expect((await get(lockedEp)).status).not.toBe(403);
  });

  it("kids mode can't spend coins or buy cameos", async () => {
    as(viewer, { kidsMode: true });
    const before = await coins(viewer.id);
    expect((await unlockEpisodeAction(lockedEp)).ok).toBe(false);
    expect(await buyCameoAction(seriesA, "Kid")).toEqual({ ok: false, error: "kids" });
    expect(await coins(viewer.id)).toBe(before);
  });
});

describe("input validation: mass assignment and enums", () => {
  it("admin flag update rejects unknown fields (e.g. changing the owner)", async () => {
    as(admin);
    await setSeriesFlagsAction(seriesA, { featured: true, creatorId: creatorB.id } as never);
    const s = await prisma.series.findUniqueOrThrow({ where: { id: seriesA } });
    expect(s.creatorId).toBe(creatorA.id);
    expect(s.featured).toBe(false);
  });
  it("role must be a known value", async () => {
    as(admin);
    await setUserRoleAction(viewer.id, "SUPERADMIN" as never);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: viewer.id } })).role).toBe("VIEWER");
  });
  it("coin adjustments reject absurd and non-numeric amounts", async () => {
    as(admin);
    expect((await adjustCoinsAction(viewer.id, 1e12, "paid", "x")).ok).toBe(false);
    expect((await adjustCoinsAction(viewer.id, Number("abc"), "paid", "x")).ok).toBe(false);
    expect((await adjustCoinsAction(viewer.id, 10, "admin" as never, "x")).ok).toBe(false);
  });
});

describe("brute force", () => {
  it("login locks the account after repeated wrong passwords — even the right one is refused for a while", async () => {
    as(null);
    const form = (pw: string) => {
      const f = new FormData();
      f.set("email", viewer.email);
      f.set("password", pw);
      return f;
    };
    for (let i = 0; i < 8; i++) expect((await loginAction(undefined, form("wrong")))?.error).toBe(en.auth.invalid);
    expect((await loginAction(undefined, form("right-password")))?.error).toBe(en.auth.tooMany);
  });

  it("wrong and unknown emails get the same answer (no account enumeration)", async () => {
    as(null);
    const f = new FormData();
    f.set("email", `nobody-${tag}@t.t`);
    f.set("password", "whatever");
    expect((await loginAction(undefined, f))?.error).toBe(en.auth.invalid);
  });

  it("promo codes can't be guessed: 10 wrong codes lock redemption for an hour", async () => {
    await createPromo({ code: `REAL${tag}`.toUpperCase(), kind: "COINS", value: 5, maxUses: null, expiresAt: null, newUsersOnly: false });
    as(creatorA);
    for (let i = 0; i < 10; i++) expect((await redeemPromoAction(`GUESS${i}${tag}`)).ok).toBe(false);
    expect(await redeemPromoAction(`REAL${tag}`)).toEqual({ ok: false, error: "tooMany" });
  });
});

describe("Host-header injection", () => {
  it("password reset links never point to the attacker's Host", async () => {
    as(null);
    state.headers = new Headers({ host: "evil.com", "x-forwarded-for": "10.9.9.9" });
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...a) => void logs.push(a.join(" ")));
    const f = new FormData();
    f.set("email", viewer.email);
    expect((await forgotPasswordAction(undefined, f))?.ok).toBe(true);
    spy.mockRestore();
    const mail = logs.join("\n");
    expect(mail).toContain("http://localhost:3000/reset-password?token=");
    expect(mail).not.toContain("evil.com");
  });
});

describe("SQL / LIKE injection", () => {
  it.each(["' OR 1=1 --", "%", "_", "\" OR \"\"=\"", "A'; DROP TABLE \"User\"; --"])("search %j is treated as text", async (q) => {
    as(null);
    const r = await searchSeries(q, "en", {} as never, 50);
    expect(r.length).toBe(0);
    expect(await prisma.user.count()).toBeGreaterThan(0);
  });
});

describe("uploads", () => {
  const upload = (file: File, headers: Record<string, string>) => {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", "image");
    return uploadPOST(new Request("http://localhost:3000/api/studio/upload", { method: "POST", body: fd, headers: { host: "localhost:3000", ...headers } }));
  };
  it("rejects cross-site requests (CSRF)", async () => {
    as(creatorA);
    expect((await upload(new File(["x"], "a.png"), {})).status).toBe(403);
    expect((await upload(new File(["x"], "a.png"), { origin: "https://evil.com" })).status).toBe(403);
  });
  it("rejects HTML / SVG disguised as an image and non-creators", async () => {
    as(creatorA);
    const res = await upload(new File(["<html><script>alert(1)</script>"], "cat.png"), { origin: "http://localhost:3000" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "BAD_FILE_TYPE" });
    expect((await upload(new File(["<svg/>"], "x.svg"), { origin: "http://localhost:3000" })).status).toBe(400);
    as(viewer);
    expect((await upload(new File(["x"], "a.png"), { origin: "http://localhost:3000" })).status).toBe(403);
  });
});
