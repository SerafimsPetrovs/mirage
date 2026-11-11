import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./db";
import { grantCoins } from "./coins";
import { ensureDay, postMessage, TvError } from "./tv";
import { addReaction, answerQuiz, ensurePoll, finishGame, liveFeed, postSuperchat, quizResult, startGame, touchPresence, viewersNow, votePoll, watchBeat } from "./tv-live";
import { airIdea, breakIn, channelSchedule, deleteClip, filmIdea, muteFromMessage, muteUser, saveChannel, syncFactory, techBreak, tvDashboard, updateClip } from "./tv-admin";
import { GOLD_EARN } from "./gold-rules";
import { POLL_SEC, SUPERCHAT_TIERS } from "./tv-rules";
import { utcDay } from "./rewards";
import { resetRateLimit } from "./rate-limit";

process.env.GEN_PROVIDER = "mock";

const tag = Date.now().toString(36);
const ids = { users: [] as string[], channel: "" };
type U = NonNullable<Parameters<typeof postMessage>[0]>;
let viewer: U;
let other: U;
let adminId: string;

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
const gold = async (id: string) => (await prisma.user.findUniqueOrThrow({ where: { id }, select: { gold: true } })).gold;
const channel = () => prisma.tvChannel.findUniqueOrThrow({ where: { id: ids.channel } });

async function user(name: string): Promise<U> {
  const u = await prisma.user.create({ data: { email: `${name}${tag}@t.t`, name, passwordHash: "x" } });
  ids.users.push(u.id);
  return { id: u.id, name, role: "VIEWER", kidsMode: false, showAdult: false, adultConfirmedAt: null };
}

beforeAll(async () => {
  viewer = await user("lv");
  other = await user("lo");
  adminId = (await user("la")).id;
  await grantCoins(viewer.id, 1000, "PURCHASE");
  const ch = await prisma.tvChannel.create({ data: { slug: `live-${tag}`, number: 950, nameRu: "Live", nameEn: "Live", kind: "ABSURD", hostName: "H" } });
  ids.channel = ch.id;
  await prisma.tvClip.createMany({
    data: ["One", "Two", "Three", "Four"].map((title) => ({ channelId: ch.id, kind: "SHOW", title, videoUrl: "demo:h-dusk.mp4", durationSec: 14, status: "APPROVED" })),
  });
  await ensureDay(ch, utcDay());
});

afterAll(async () => {
  await prisma.tvChannel.deleteMany({ where: { id: ids.channel } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
});

describe("presence and reactions", () => {
  it("counts each viewer once, on one channel at a time", () => {
    const now = Date.now();
    touchPresence("chA", "u1", now);
    touchPresence("chA", "u2", now);
    touchPresence("chA", "u1", now + 1000);
    expect(viewersNow("chA", now + 1000)).toBe(2);
    touchPresence("chB", "u1", now + 2000);
    expect(viewersNow("chA", now + 2000)).toBe(1);
    expect(viewersNow("chA", now + 60_000)).toBe(0);
  });

  it("only known emojis, rate limited", async () => {
    const ch = await channel();
    expect(() => addReaction(viewer, "k", ch, "💩")).toThrow(TvError);
    resetRateLimit(`tvreact:${viewer.id}`);
    for (let i = 0; i < 8; i++) addReaction(viewer, "k", ch, "🔥");
    expect(() => addReaction(viewer, "k", ch, "🔥")).toThrow(TvError);
    const feed = await liveFeed(ch, null, "guest1", 0, { beat: false, titles: (o) => o.title });
    expect(feed.reactions.length).toBeGreaterThanOrEqual(8);
  });
});

describe("super chat", () => {
  it("charges the tier, is pinned on screen, unknown tiers refused", async () => {
    const ch = await channel();
    resetRateLimit(`tvchat:${viewer.id}`);
    expect(await code(postSuperchat(viewer, ch, "hi", 7))).toBe("STATE");
    expect(await code(postSuperchat(other, ch, "hi", 30))).toBe("InsufficientCoinsError");
    const before = await total(viewer.id);
    await postSuperchat(viewer, ch, "Привет всем измерениям!", SUPERCHAT_TIERS[1].coins);
    expect(await total(viewer.id)).toBe(before - SUPERCHAT_TIERS[1].coins);
    const feed = await liveFeed(ch, viewer, "v", 0, { beat: false, titles: (o) => o.title });
    expect(feed.pinned?.text).toBe("Привет всем измерениям!");
    expect(feed.messages.at(-1)?.paid).toBe(SUPERCHAT_TIERS[1].coins);
  });
});

describe("what's next poll", () => {
  it("opens a poll, one vote per viewer (+gold), the winner airs right after the current slot", async () => {
    const ch = await channel();
    const poll = (await ensurePoll(ch))!;
    expect(poll.resolved).toBe(false);
    const options = JSON.parse(poll.options) as { id: string }[];
    expect(options.length).toBe(3);
    const g0 = await gold(viewer.id);
    expect(await votePoll(viewer, poll.id, 2)).toBe(GOLD_EARN.TV_VOTE.amount);
    expect(await gold(viewer.id)).toBe(g0 + GOLD_EARN.TV_VOTE.amount);
    expect(await code(votePoll(viewer, poll.id, 1))).toBe("STATE");
    expect(await code(votePoll(null, poll.id, 1))).toBe("AUTH");
    await votePoll(other, poll.id, 2);
    // Time passes: the poll ends and resolves.
    const later = new Date(poll.endsAt.getTime() + 1000);
    const resolved = await ensurePoll(ch, later);
    expect(resolved?.resolved).toBe(true);
    expect(resolved?.winner).toBe(2);
    const current = await prisma.tvSlot.findFirst({ where: { channelId: ch.id, startsAt: { lte: later } }, orderBy: { startsAt: "desc" } });
    const after = await prisma.tvSlot.findMany({ where: { channelId: ch.id, startsAt: { gt: current!.startsAt } }, orderBy: { startsAt: "asc" }, take: 2 });
    expect(after[0].kind).toBe("HOST");
    expect(after[1].clipId).toBe(options[2].id);
    // No new poll right away.
    const again = await ensurePoll(ch, new Date(later.getTime() + POLL_SEC * 1000));
    expect(again?.id).toBe(poll.id);
  });
});

describe("quiz", () => {
  it("one answer while on air; the answer is revealed only after the end; gold once", async () => {
    const ch = await channel();
    const q = await prisma.tvSlot.findFirstOrThrow({ where: { channelId: ch.id, kind: "QUIZ" }, orderBy: { startsAt: "asc" } });
    const data = JSON.parse(q.data) as { correct: number };
    const during = new Date(q.startsAt.getTime() + 5000);
    const afterEnd = new Date(q.startsAt.getTime() + q.durationSec * 1000 + 1200);
    const justEnded = new Date(q.startsAt.getTime() + q.durationSec * 1000 + 500);
    expect(await code(quizResult(viewer, q.id, during))).toBe("STATE");
    // No peeking right after the end while late answers are still accepted.
    expect(await code(quizResult(viewer, q.id, justEnded))).toBe("STATE");
    expect(await code(answerQuiz(viewer, q.id, data.correct, new Date(q.startsAt.getTime() - 5000)))).toBe("STATE");
    await answerQuiz(viewer, q.id, data.correct, during);
    expect(await code(answerQuiz(viewer, q.id, 0, during))).toBe("STATE");
    await answerQuiz(other, q.id, (data.correct + 1) % 4, during);
    const g0 = await gold(viewer.id);
    const r = await quizResult(viewer, q.id, afterEnd);
    expect(r).toMatchObject({ correct: data.correct, mine: data.correct, gold: GOLD_EARN.TV_QUIZ.amount, total: 2, right: 1 });
    expect((await quizResult(viewer, q.id, afterEnd)).gold).toBe(0);
    expect(await gold(viewer.id)).toBe(g0 + GOLD_EARN.TV_QUIZ.amount);
    expect((await quizResult(other, q.id, afterEnd)).gold).toBe(0);
  });
});

describe("watching and the mini game", () => {
  it("gold every 10 minutes of heartbeats, nothing for spam beats", async () => {
    const t0 = Date.now();
    expect(await watchBeat(viewer.id, new Date(t0))).toBe(0);
    expect(await watchBeat(viewer.id, new Date(t0 + 5000))).toBe(0);
    let got = 0;
    for (let i = 1; i <= 11; i++) got += await watchBeat(viewer.id, new Date(t0 + i * 60_000));
    expect(got).toBe(GOLD_EARN.TV_WATCH.amount);
  });

  it("a round must really last; good score pays once", async () => {
    resetRateLimit(`tvgame:${viewer.id}`);
    const g = await startGame(viewer);
    expect(await code(finishGame(viewer, g.id, 30, new Date(g.startedAt.getTime() + 3000)))).toBe("ok");
    // too fast → no gold, and the round is closed
    expect(await code(finishGame(viewer, g.id, 30, new Date(g.startedAt.getTime() + 21_000)))).toBe("STATE");
    resetRateLimit(`tvgame:${viewer.id}`);
    const g2 = await startGame(viewer);
    expect(await code(startGame(viewer))).toBe("RATE");
    const r = await finishGame(viewer, g2.id, 15, new Date(g2.startedAt.getTime() + 21_000));
    expect(r).toEqual({ verdict: "ok", gold: GOLD_EARN.TV_GAME.amount });
    expect(await code(finishGame(other, g2.id, 15))).toBe("STATE");
  });
});

describe("admin", () => {
  it("muted viewers can't chat; mute from a message hides it", async () => {
    const ch = await channel();
    resetRateLimit(`tvchat:${other.id}`);
    const m = await postMessage(other, ch, "spam spam");
    await muteFromMessage(m.id);
    expect((await prisma.tvMessage.findUniqueOrThrow({ where: { id: m.id } })).hidden).toBe(true);
    expect(await code(postMessage(other, ch, "hello again"))).toBe("MUTED");
    await muteUser(other.id, 0);
    expect(await code(postMessage(other, ch, "hello again"))).toBe("ok");
  });

  it("technical break replaces a slot in place; break-in airs a clip next", async () => {
    const ch = await channel();
    const now = new Date();
    const next = await prisma.tvSlot.findFirstOrThrow({ where: { channelId: ch.id, kind: "CLIP", startsAt: { gt: now } }, orderBy: { startsAt: "asc" } });
    await techBreak(next.id, now);
    const pulled = await prisma.tvSlot.findUniqueOrThrow({ where: { id: next.id } });
    expect(pulled).toMatchObject({ kind: "HOST", clipId: null, durationSec: next.durationSec, startsAt: next.startsAt });
    const clip = await prisma.tvClip.findFirstOrThrow({ where: { channelId: ch.id, title: "Four" } });
    await breakIn(clip.id, now);
    const sched = await channelSchedule(ch.id, now);
    const idx = sched.findIndex((s) => s.onAir);
    expect(sched[idx + 2]?.title).toBe("Four");
  });

  it("taking a clip off the air removes it from the rest of today", async () => {
    const ch = await channel();
    const clip = await prisma.tvClip.findFirstOrThrow({ where: { channelId: ch.id, title: "Three" } });
    await updateClip(clip.id, { status: "REJECTED" });
    const future = await prisma.tvSlot.count({ where: { channelId: ch.id, clipId: clip.id, startsAt: { gt: new Date(Date.now() + 120_000) } } });
    expect(future).toBe(0);
    await deleteClip(clip.id);
    expect(await prisma.tvClip.findUnique({ where: { id: clip.id } })).toBeNull();
  });

  it("channel numbers and addresses are unique", async () => {
    const base = { slug: `x-${tag}`, number: 950, nameRu: "X", nameEn: "X", taglineRu: "", taglineEn: "", kind: "ABSURD" as const, genres: "", hue: 1, hostName: "H", hostPersona: "", familyOnly: false, isAdult: false, ticker: false, quiz: true, active: true };
    expect(await code(saveChannel(base))).toBe("LIMIT");
    expect(await code(saveChannel({ ...base, number: 951, familyOnly: true, isAdult: true }))).toBe("STATE");
    const ch = await saveChannel({ ...base, number: 951, genres: " Comedy , drama," });
    expect(ch.genres).toBe("comedy,drama");
    await prisma.tvChannel.delete({ where: { id: ch.id } });
  });

  it("factory: film an idea, it becomes ready, one click puts it on air", async () => {
    const ch = await channel();
    const item = await prisma.tvFactoryItem.create({ data: { channelId: ch.id, title: "Sock ad", prompt: "a sock that folds itself", kind: "AD" } });
    const job = await filmIdea(item.id, adminId);
    expect(job.cost).toBe(0);
    await syncFactory(Date.now() + 60_000);
    expect((await prisma.tvFactoryItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("READY");
    const clip = await airIdea(item.id);
    expect(clip).toMatchObject({ status: "APPROVED", kind: "AD", channelId: ch.id });
    expect(await code(airIdea(item.id))).toBe("STATE");
  });

  it("dashboard sums TV revenue", async () => {
    const d = await tvDashboard();
    expect(d.revenue.find((r) => r.reason === "TV_SUPERCHAT")!.coins).toBeGreaterThanOrEqual(SUPERCHAT_TIERS[1].coins);
    expect(d.channels.some((c) => c.id === ids.channel)).toBe(true);
  });
});
