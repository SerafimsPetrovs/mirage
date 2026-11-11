import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./db";
import { grantCoins } from "./coins";
import {
  buyTicker,
  channelFor,
  chatFeed,
  createOrder,
  ensureDay,
  listChannels,
  moderateOrder,
  onAir,
  postMessage,
  rebuildRestOfDay,
  reportMessage,
  syncOrders,
  toggleLike,
  TvError,
} from "./tv";
import { DAY_SEC, TV_CHAT_HIDE_AFTER_REPORTS, TV_CHAT_PER_MIN, TV_ORDER_MAX_OPEN, TV_ORDER_PRICE, TV_TICKER_PRICE } from "./tv-rules";
import { utcDay } from "./rewards";
import { resetRateLimit } from "./rate-limit";

process.env.GEN_PROVIDER = "mock";

const tag = Date.now().toString(36);
const ids = { users: [] as string[], channels: [] as string[], series: "" };
type U = NonNullable<Parameters<typeof postMessage>[0]>;
let viewer: U;
let other: U;
let kid: U;
let grown: U;

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof TvError ? e.code : e instanceof Error ? e.constructor.name : String(e);
  }
};
const total = async (id: string) => {
  const u = await prisma.user.findUniqueOrThrow({ where: { id }, select: { paidCoins: true, bonusCoins: true } });
  return u.paidCoins + u.bonusCoins;
};
const channel = (slug: string) => prisma.tvChannel.findUniqueOrThrow({ where: { slug: `${slug}-${tag}` } });

async function user(name: string, extra: Partial<U> = {}): Promise<U> {
  const u = await prisma.user.create({ data: { email: `${name}${tag}@t.t`, name, passwordHash: "x" } });
  ids.users.push(u.id);
  return { id: u.id, name, role: "VIEWER", kidsMode: false, showAdult: false, adultConfirmedAt: null, ...extra };
}

beforeAll(async () => {
  viewer = await user("tvv");
  other = await user("tvo");
  kid = { ...(await user("tvk")), kidsMode: true };
  grown = await user("tvg", { showAdult: true, adultConfirmedAt: new Date() });
  await grantCoins(viewer.id, 1000, "PURCHASE");

  const creator = await user("tvc");
  ids.series = (
    await prisma.series.create({
      data: {
        slug: `tvs-${tag}`, titleRu: "Сериал", titleEn: "Show", descriptionRu: "d", descriptionEn: "d", status: "PUBLISHED", genres: `g${tag}`, freeEpisodes: 2, creatorId: creator.id,
        episodes: { create: [1, 2, 3].map((n) => ({ number: n, videoUrl: "demo:v-teal.mp4", durationSec: 600 })) },
      },
    })
  ).id;

  const base = { hostName: "Host", hostPersona: "p", kind: "ABSURD" };
  for (const [slug, n, extra] of [
    ["main", 901, { genres: `g${tag}`, ticker: true }],
    ["fam", 902, { familyOnly: true, kind: "KIDS" }],
    ["night", 903, { isAdult: true, kind: "NIGHT" }],
  ] as const) {
    const ch = await prisma.tvChannel.create({ data: { slug: `${slug}-${tag}`, number: n, nameRu: slug, nameEn: slug, ...base, ...extra } });
    ids.channels.push(ch.id);
  }
  const main = await channel("main");
  await prisma.tvClip.createMany({
    data: [
      { channelId: main.id, kind: "SHOW", title: "Show A", videoUrl: "demo:h-dusk.mp4", durationSec: 14, status: "APPROVED" },
      { channelId: main.id, kind: "MUSIC", title: "Song", artist: "Band", videoUrl: "demo:h-ocean.mp4", durationSec: 14, status: "APPROVED" },
      { channelId: main.id, kind: "SHOW", title: "Pending", videoUrl: "demo:h-ember.mp4", durationSec: 14, status: "PENDING" },
    ],
  });
});

afterAll(async () => {
  await prisma.tvChannel.deleteMany({ where: { id: { in: ids.channels } } });
  await prisma.series.deleteMany({ where: { id: ids.series } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
});

describe("channel visibility", () => {
  it("family mode sees only the family channel, 18+ needs 18+ mode", async () => {
    const mine = (list: { slug: string }[]) => list.map((c) => c.slug).filter((s) => s.endsWith(tag)).sort();
    expect(mine(await listChannels(viewer))).toEqual([`main-${tag}`]);
    expect(mine(await listChannels(kid))).toEqual([`fam-${tag}`]);
    expect(mine(await listChannels(grown))).toEqual([`main-${tag}`, `night-${tag}`]);
    expect(await channelFor(`night-${tag}`, viewer)).toBeNull();
    expect(await channelFor(`main-${tag}`, kid)).toBeNull();
    expect(await channelFor(`main-${tag}`, null)).not.toBeNull();
  });
});

describe("schedule", () => {
  it("builds a whole day once (concurrent callers share it) with only free episodes and approved clips", async () => {
    const ch = await channel("main");
    const day = utcDay();
    const [a, b] = await Promise.all([ensureDay(ch, day), ensureDay(ch, day)]);
    expect([a, b]).toEqual([true, true]); // same shared build
    expect(await ensureDay(ch, day)).toBe(false);
    const slots = await prisma.tvSlot.findMany({ where: { channelId: ch.id, day }, orderBy: { startsAt: "asc" }, include: { episode: true, clip: true } });
    const secs = slots.reduce((s, x) => s + x.durationSec, 0);
    expect(secs).toBe(DAY_SEC);
    expect(slots.filter((s) => s.episode).every((s) => s.episode!.number <= 2)).toBe(true);
    expect(slots.some((s) => s.clip?.title === "Pending")).toBe(false);
    // Demo episode files are 14 s long: the slot uses the real length, not the stored 600 s.
    expect(slots.filter((s) => s.kind === "EPISODE").every((s) => s.durationSec <= 15)).toBe(true);
  });

  it("what's on air is the same for everyone and has a programme guide", async () => {
    const ch = await channel("main");
    const at = new Date();
    const a = await onAir(ch, "en", viewer.id, at);
    const b = await onAir(ch, "en", null, at);
    expect(a.slot.id).toBe(b.slot.id);
    expect(a.next.length).toBeGreaterThan(3);
    expect(a.slot.startsAt).toBeLessThanOrEqual(at.getTime());
  });

  it("rebuilding the rest of the day keeps the slot on air", async () => {
    const ch = await channel("main");
    const now = new Date();
    const before = await prisma.tvSlot.findFirst({ where: { channelId: ch.id, startsAt: { lte: now } }, orderBy: { startsAt: "desc" } });
    await rebuildRestOfDay(ch.id, now);
    const after = await prisma.tvSlot.findFirst({ where: { channelId: ch.id, startsAt: { lte: now } }, orderBy: { startsAt: "desc" } });
    expect(after?.id).toBe(before?.id);
    const day = await prisma.tvSlot.findMany({ where: { channelId: ch.id, day: utcDay(now) }, orderBy: { startsAt: "asc" } });
    for (let i = 1; i < day.length; i++) expect(day[i].startsAt.getTime()).toBe(day[i - 1].startsAt.getTime() + day[i - 1].durationSec * 1000);
  });
});

describe("chat and ticker", () => {
  it("guests and family mode can't chat; links are refused; rate limited", async () => {
    const ch = await channel("main");
    expect(await code(postMessage(null, ch, "hi"))).toBe("AUTH");
    expect(await code(postMessage(kid, ch, "hi"))).toBe("KIDS");
    expect(await code(postMessage(viewer, ch, "see www.spam.com"))).toBe("links");
    resetRateLimit(`tvchat:${viewer.id}`);
    for (let i = 0; i < TV_CHAT_PER_MIN; i++) expect(await code(postMessage(viewer, ch, `msg ${i}`))).toBe("ok");
    expect(await code(postMessage(viewer, ch, "one more"))).toBe("RATE");
    const feed = await chatFeed(ch, viewer.id);
    expect(feed.messages).toHaveLength(TV_CHAT_PER_MIN);
    expect(feed.messages.every((m) => m.mine)).toBe(true);
  });

  it("a message disappears after enough reports (one per user)", async () => {
    const ch = await channel("main");
    const m = await prisma.tvMessage.findFirstOrThrow({ where: { channelId: ch.id } });
    for (let i = 0; i < 5; i++) await reportMessage(other, m.id);
    expect((await prisma.tvMessage.findUniqueOrThrow({ where: { id: m.id } })).reports).toBe(1);
    for (let i = 1; i < TV_CHAT_HIDE_AFTER_REPORTS; i++) await reportMessage(await user(`rep${i}`), m.id);
    expect((await prisma.tvMessage.findUniqueOrThrow({ where: { id: m.id } })).hidden).toBe(true);
  });

  it("ticker costs coins, is filtered and only on ticker channels", async () => {
    const ch = await channel("main");
    const fam = await channel("fam");
    const before = await total(viewer.id);
    expect(await code(buyTicker(viewer, ch, "сука"))).toBe("banned");
    expect(await code(buyTicker(viewer, fam, "привет"))).toBe("NO_TICKER");
    expect(await code(buyTicker(other, ch, "привет"))).toBe("InsufficientCoinsError");
    await buyTicker(viewer, ch, "Привет Маше из Риги");
    expect(await total(viewer.id)).toBe(before - TV_TICKER_PRICE);
    expect((await chatFeed(ch, null)).tickers.map((t) => t.text)).toEqual(["Привет Маше из Риги"]);
  });

  it("likes toggle on music videos only", async () => {
    const song = await prisma.tvClip.findFirstOrThrow({ where: { title: "Song", channelId: ids.channels[0] } });
    const show = await prisma.tvClip.findFirstOrThrow({ where: { title: "Show A", channelId: ids.channels[0] } });
    expect(await toggleLike(viewer, song.id)).toEqual({ liked: true, likes: 1 });
    expect(await toggleLike(viewer, song.id)).toEqual({ liked: false, likes: 0 });
    expect(await code(toggleLike(viewer, show.id))).toBe("NOT_FOUND");
  });
});

describe("put something on air", () => {
  it("charges, generates, goes to review; rejection refunds", async () => {
    const ch = await channel("main");
    const before = await total(viewer.id);
    const { order } = await createOrder(viewer, ch, "Реклама зубной пасты для драконов");
    expect(order.status).toBe("GENERATING");
    expect(await total(viewer.id)).toBe(before - TV_ORDER_PRICE);
    // Mock generation finishes after ~20–35 s: pretend time passed.
    await syncOrders({ id: order.id }, Date.now() + 60_000);
    expect((await prisma.tvOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("REVIEW");
    await moderateOrder(order.id, "reject", "nope");
    await moderateOrder(order.id, "reject").catch(() => {}); // a second reject must not refund twice
    expect(await total(viewer.id)).toBe(before);
  });

  it("approved order becomes a sponsored clip and airs in the next ad break", async () => {
    const ch = await channel("main");
    const { order } = await createOrder(viewer, ch, "Межгалактическая реклама супа");
    await syncOrders({ id: order.id }, Date.now() + 60_000);
    await moderateOrder(order.id, "approve");
    const approved = await prisma.tvOrder.findUniqueOrThrow({ where: { id: order.id }, include: { clip: true } });
    expect(approved.status).toBe("APPROVED");
    expect(approved.clip?.sponsorName).toBe("tvv");
    // Put an ad break on air right now and ask what's on.
    const now = new Date();
    const brk = await prisma.tvSlot.findFirstOrThrow({ where: { channelId: ch.id, kind: "BREAK", startsAt: { gt: now } }, orderBy: { startsAt: "asc" } });
    const air = await onAir(ch, "en", null, new Date(brk.startsAt.getTime() + 1000));
    expect(air.slot.kind).toBe("BREAK");
    expect(air.slot.sponsor).toBe("tvv");
    expect((await prisma.tvOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("AIRED");
    // Every viewer of that break sees the same clip, the order is not aired twice.
    const again = await onAir(ch, "en", viewer.id, new Date(brk.startsAt.getTime() + 2000));
    expect(again.slot.clipId).toBe(air.slot.clipId);
  });

  it("limits open orders and refuses bad ideas and the family channel", async () => {
    const ch = await channel("main");
    const fam = await channel("fam");
    expect(await code(createOrder(viewer, ch, "http://x.com ad"))).toBe("links");
    expect(await code(createOrder(kid, fam, "сказка про кота"))).toBe("KIDS");
    const open = await prisma.tvOrder.count({ where: { userId: viewer.id, status: { in: ["GENERATING", "REVIEW", "APPROVED"] } } });
    for (let i = open; i < TV_ORDER_MAX_OPEN; i++) await createOrder(viewer, ch, `Идея номер ${i} про роботов`);
    expect(await code(createOrder(viewer, ch, "Ещё одна идея про роботов"))).toBe("LIMIT");
  });

  it("a failed generation returns the coins", async () => {
    const ch = await channel("main");
    await grantCoins(other.id, TV_ORDER_PRICE, "PURCHASE");
    const { order, job } = await createOrder(other, ch, "Документалка о грибах-телепатах");
    await prisma.generationJob.update({ where: { id: job.id }, data: { status: "FAILED", error: "boom" } });
    await syncOrders({ id: order.id });
    expect((await prisma.tvOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("FAILED");
    expect(await total(other.id)).toBe(TV_ORDER_PRICE);
  });
});
