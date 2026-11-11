import "server-only";
import { Prisma, type TvChannel } from "@prisma/client";
import { prisma } from "./db";
import { spendCoins } from "./coins";
import { earnGold } from "./gold";
import { rateLimit } from "./rate-limit";
import { utcDay } from "./rewards";
import { chatFeed, channelContentForPoll, parseQuiz, rebuildRestOfDay, TvError, tvViewer } from "./tv";
import {
  GAME_GOOD_SCORE,
  POLL_EVERY_SEC,
  POLL_OPTIONS,
  POLL_SEC,
  REACTIONS,
  REACTIONS_PER_10S,
  SUPERCHAT_TIERS,
  HIGHLIGHT_PRICE,
  TV_CHAT_PER_MIN,
  chatTextProblem,
  gameVerdict,
  normalizeText,
  pollWinner,
  seededRandom,
  shuffle,
  superchatTier,
  watchCredit,
  watchRewardsDue,
  type ProgramItem,
} from "./tv-rules";
import { activeAlerts, activePip } from "./tv-control";
import type { TvLiveDTO, TvPinnedDTO, TvPollDTO } from "./tv-types";

type Viewer = Parameters<typeof tvViewer>[0];

/** Answers are accepted until slot end + grace; the right answer is revealed only later (no peeking and answering). */
const QUIZ_ANSWER_GRACE_MS = 800;
const QUIZ_REVEAL_AFTER_MS = 1000;

// ───────────── presence (one Node process; move to Redis when scaling out) ─────────────

const PRESENCE_TTL = 25_000;
const presence = new Map<string, Map<string, number>>();

/** Marks a viewer as watching a channel (the live feed is polled every few seconds). */
export function touchPresence(channelId: string, viewerKey: string, now = Date.now()) {
  let m = presence.get(channelId);
  if (!m) presence.set(channelId, (m = new Map()));
  // A viewer watches one channel at a time.
  for (const [cid, other] of presence) if (cid !== channelId) other.delete(viewerKey);
  m.set(viewerKey, now);
}

export function viewersNow(channelId: string, now = Date.now()) {
  const m = presence.get(channelId);
  if (!m) return 0;
  let n = 0;
  for (const [k, at] of m) {
    if (now - at < PRESENCE_TTL) n++;
    else m.delete(k);
  }
  return n;
}

/** Admin dashboard: viewers per channel right now. */
export function viewersByChannel(now = Date.now()) {
  const out: Record<string, number> = {};
  for (const id of presence.keys()) out[id] = viewersNow(id, now);
  return out;
}

// ───────────── reactions (ephemeral, in memory) ─────────────

type Reaction = { id: string; emoji: string; at: number };
const reactions = new Map<string, Reaction[]>();
let reactionSeq = 0;

export function addReaction(user: Viewer, viewerKey: string, ch: TvChannel, emoji: string, now = Date.now()) {
  if (!(REACTIONS as readonly string[]).includes(emoji)) throw new TvError("STATE");
  if (!rateLimit(`tvreact:${user?.id ?? viewerKey}`, REACTIONS_PER_10S, 10_000).allowed) throw new TvError("RATE");
  const list = (reactions.get(ch.id) ?? []).filter((r) => now - r.at < 15_000);
  list.push({ id: `${now.toString(36)}${(reactionSeq++).toString(36)}`, emoji, at: now });
  reactions.set(ch.id, list.slice(-60));
}

function recentReactions(channelId: string, since: number, now = Date.now()) {
  return (reactions.get(channelId) ?? []).filter((r) => r.at > since && now - r.at < 10_000).map(({ id, emoji }) => ({ id, emoji }));
}

// ───────────── super chat ─────────────

async function requireChatter(user: Viewer) {
  if (!user) throw new TvError("AUTH");
  if (user.kidsMode) throw new TvError("KIDS");
  const u = await prisma.user.findUnique({ where: { id: user.id }, select: { tvMutedUntil: true, banned: true } });
  if (!u || u.banned) throw new TvError("AUTH");
  if (u.tvMutedUntil && u.tvMutedUntil > new Date()) throw new TvError("MUTED");
  return user;
}

export { requireChatter };

/** A paid chat message: highlighted (cheap) or a super chat pinned on screen for a while. Money goes to the platform. */
export async function postSuperchat(user: Viewer, ch: TvChannel, raw: string, coins: number) {
  const u = await requireChatter(user);
  if (ch.familyOnly) throw new TvError("KIDS");
  // A highlighted message (HIGHLIGHT_PRICE) or a pinned super chat tier.
  const tier = coins === HIGHLIGHT_PRICE ? { coins: HIGHLIGHT_PRICE } : SUPERCHAT_TIERS.find((t) => t.coins === coins);
  if (!tier) throw new TvError("STATE");
  const problem = chatTextProblem(raw);
  if (problem) throw new TvError(problem);
  if (!rateLimit(`tvchat:${u.id}`, TV_CHAT_PER_MIN, 60_000).allowed) throw new TvError("RATE");
  const text = normalizeText(raw);
  return prisma.$transaction(async (tx) => {
    const charge = await spendCoins(tx, u.id, tier.coins, "TV_SUPERCHAT", { note: `${ch.slug}: ${text}`.slice(0, 120) });
    await tx.tvMessage.create({ data: { channelId: ch.id, userId: u.id, text, paid: tier.coins } });
    return charge.balance;
  });
}

/** The super chat pinned right now: the most expensive one still within its pin time. */
async function pinnedNow(channelId: string, now: Date): Promise<TvPinnedDTO | null> {
  const longest = Math.max(...SUPERCHAT_TIERS.map((t) => t.pinSec));
  const rows = await prisma.tvMessage.findMany({
    where: { channelId, hidden: false, paid: { gt: 0 }, createdAt: { gte: new Date(now.getTime() - longest * 1000) } },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { user: { select: { name: true } } },
  });
  const live = rows
    .map((m) => ({ m, until: m.createdAt.getTime() + (superchatTier(m.paid)?.pinSec ?? 0) * 1000 }))
    .filter((x) => x.until > now.getTime())
    .sort((a, b) => b.m.paid - a.m.paid || b.m.createdAt.getTime() - a.m.createdAt.getTime());
  const top = live[0];
  return top ? { id: top.m.id, name: top.m.user.name, text: top.m.text, paid: top.m.paid, until: top.until } : null;
}

// ───────────── "What's next?" poll ─────────────

type PollOption = ProgramItem & { titleRu?: string };

const pollLocks = new Map<string, Promise<unknown>>();

/**
 * Keeps the channel's poll cycle going: resolves an ended poll (the winner airs right after the current slot)
 * and opens a new one every POLL_EVERY_SEC. Cheap when nothing changes; safe under concurrent callers.
 */
export async function ensurePoll(ch: TvChannel, now = new Date()) {
  if (ch.familyOnly) return null;
  const running = pollLocks.get(ch.id);
  if (running) await running.catch(() => {});
  const p = (async () => {
    const last = await prisma.tvPoll.findFirst({ where: { channelId: ch.id }, orderBy: { createdAt: "desc" } });
    if (last && !last.resolved && last.endsAt <= now) {
      const won = await prisma.tvPoll.updateMany({ where: { id: last.id, resolved: false }, data: { resolved: true } });
      if (won.count === 1) {
        const opts = JSON.parse(last.options) as PollOption[];
        const counts = await voteCounts(last.id, opts.length);
        const w = pollWinner(counts);
        await prisma.tvPoll.update({ where: { id: last.id }, data: { winner: w } });
        if (opts[w]) await rebuildRestOfDay(ch.id, now, opts[w]).catch((e) => console.error("[tv poll rebuild]", e));
      }
      return prisma.tvPoll.findUnique({ where: { id: last.id } });
    }
    if (last && now.getTime() - last.createdAt.getTime() < POLL_EVERY_SEC * 1000) return last;
    const programs = await channelContentForPoll(ch);
    if (programs.length < 2) return last;
    const options = shuffle(programs, seededRandom(`${ch.id}:${now.getTime()}`)).slice(0, POLL_OPTIONS);
    return prisma.tvPoll.create({ data: { channelId: ch.id, options: JSON.stringify(options), endsAt: new Date(now.getTime() + POLL_SEC * 1000) } });
  })();
  pollLocks.set(ch.id, p);
  try {
    return await p;
  } finally {
    if (pollLocks.get(ch.id) === p) pollLocks.delete(ch.id);
  }
}

async function voteCounts(pollId: string, n: number) {
  const g = await prisma.tvPollVote.groupBy({ by: ["option"], where: { pollId }, _count: { _all: true } });
  return Array.from({ length: n }, (_, i) => g.find((x) => x.option === i)?._count._all ?? 0);
}

async function pollDTO(poll: { id: string; options: string; endsAt: Date; winner: number | null; resolved: boolean; createdAt: Date } | null, userId: string | null, titles: (o: PollOption) => string, now: Date): Promise<TvPollDTO | null> {
  if (!poll) return null;
  // Show a finished poll for one more minute (who won), then hide it until the next one.
  if (poll.resolved && now.getTime() - poll.endsAt.getTime() > 60_000) return null;
  const opts = JSON.parse(poll.options) as PollOption[];
  const [counts, mine] = await Promise.all([
    voteCounts(poll.id, opts.length),
    userId ? prisma.tvPollVote.findUnique({ where: { pollId_userId: { pollId: poll.id, userId } } }) : null,
  ]);
  return { id: poll.id, endsAt: poll.endsAt.getTime(), options: opts.map((o, i) => ({ title: titles(o), votes: counts[i] })), myVote: mine?.option ?? null, winner: poll.resolved ? poll.winner : null };
}

export async function votePoll(user: Viewer, pollId: string, option: number) {
  const u = await requireChatter(user);
  const poll = await prisma.tvPoll.findUnique({ where: { id: pollId }, include: { channel: true } });
  if (!poll || poll.resolved || poll.endsAt <= new Date()) throw new TvError("STATE");
  const opts = JSON.parse(poll.options) as PollOption[];
  if (!Number.isInteger(option) || option < 0 || option >= opts.length) throw new TvError("STATE");
  try {
    await prisma.tvPollVote.create({ data: { pollId, userId: u.id, option } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new TvError("STATE");
    throw e;
  }
  return earnGold(u.id, "TV_VOTE", pollId);
}

// ───────────── quiz ─────────────

/** Answer while the quiz slot is on air (one answer per viewer). */
export async function answerQuiz(user: Viewer, slotId: string, choice: number, now = new Date()) {
  const u = await requireChatter(user);
  const slot = await prisma.tvSlot.findUnique({ where: { id: slotId } });
  const q = slot ? parseQuiz(slot.data) : null;
  if (!slot || slot.kind !== "QUIZ" || !q) throw new TvError("NOT_FOUND");
  const end = slot.startsAt.getTime() + slot.durationSec * 1000;
  // A little grace for network latency; the result is revealed only after this window closed (quizResult).
  if (now < slot.startsAt || now.getTime() > end + QUIZ_ANSWER_GRACE_MS) throw new TvError("STATE");
  if (!Number.isInteger(choice) || choice < 0 || choice >= q.options.length) throw new TvError("STATE");
  try {
    await prisma.tvQuizAnswer.create({ data: { slotId, userId: u.id, choice } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new TvError("STATE");
    throw e;
  }
}

/**
 * After the quiz slot ended: the right answer, how the viewer answered, and gold for a correct answer (once).
 * Before the end nothing is revealed.
 */
export async function quizResult(user: Viewer, slotId: string, now = new Date()) {
  const slot = await prisma.tvSlot.findUnique({ where: { id: slotId } });
  const q = slot ? parseQuiz(slot.data) : null;
  if (!slot || slot.kind !== "QUIZ" || !q) throw new TvError("NOT_FOUND");
  if (now.getTime() < slot.startsAt.getTime() + slot.durationSec * 1000 + QUIZ_REVEAL_AFTER_MS) throw new TvError("STATE");
  const [answers, mine] = await Promise.all([
    prisma.tvQuizAnswer.groupBy({ by: ["choice"], where: { slotId }, _count: { _all: true } }),
    user ? prisma.tvQuizAnswer.findUnique({ where: { slotId_userId: { slotId, userId: user.id } } }) : null,
  ]);
  let gold = 0;
  if (user && mine && mine.choice === q.correct && !mine.rewarded) {
    const r = await prisma.tvQuizAnswer.updateMany({ where: { slotId, userId: user.id, rewarded: false }, data: { rewarded: true } });
    if (r.count === 1) gold = await earnGold(user.id, "TV_QUIZ", slotId);
  }
  const total = answers.reduce((s, a) => s + a._count._all, 0);
  const right = answers.find((a) => a.choice === q.correct)?._count._all ?? 0;
  return { correct: q.correct, mine: mine?.choice ?? null, gold, total, right };
}

// ───────────── watching rewards ─────────────

/** Heartbeat from a logged-in viewer: credits watched seconds and pays gold every 10 minutes (daily cap in GOLD_EARN). */
export async function watchBeat(userId: string, now = new Date()) {
  const day = utcDay(now);
  const key = { userId_day: { userId, day } };
  const row = await prisma.tvWatch.findUnique({ where: key });
  if (!row) {
    await prisma.tvWatch.create({ data: { userId, day, lastBeat: now } }).catch(() => {});
    return 0;
  }
  const credit = watchCredit(row.lastBeat.getTime(), now.getTime());
  // Beats closer than 20 s apart change nothing (several tabs, fast polling).
  if (now.getTime() - row.lastBeat.getTime() < 20_000) return 0;
  const seconds = row.seconds + credit;
  const due = watchRewardsDue(seconds, row.rewarded);
  const upd = await prisma.tvWatch.updateMany({ where: { userId, day, lastBeat: row.lastBeat }, data: { seconds, lastBeat: now, rewarded: row.rewarded + due } });
  if (!upd.count) return 0;
  let gold = 0;
  for (let i = 0; i < due; i++) gold += await earnGold(userId, "TV_WATCH", `${day}:${row.rewarded + i + 1}`);
  return gold;
}

// ───────────── mini game ─────────────

export async function startGame(user: Viewer) {
  const u = await requireChatter(user);
  if (!rateLimit(`tvgame:${u.id}`, 1, 15_000).allowed) throw new TvError("RATE");
  return prisma.tvGame.create({ data: { userId: u.id } });
}

export async function finishGame(user: Viewer, gameId: string, score: number, now = new Date()) {
  if (!user) throw new TvError("AUTH");
  const g = await prisma.tvGame.findUnique({ where: { id: gameId } });
  if (!g || g.userId !== user.id || g.finishedAt) throw new TvError("STATE");
  const verdict = gameVerdict(g.startedAt.getTime(), now.getTime(), score);
  const r = await prisma.tvGame.updateMany({ where: { id: g.id, finishedAt: null }, data: { finishedAt: now, score: verdict === "ok" ? score : 0 } });
  if (!r.count) throw new TvError("STATE");
  if (verdict !== "ok") return { verdict, gold: 0 };
  const gold = score >= GAME_GOOD_SCORE ? await earnGold(user.id, "TV_GAME", g.id) : 0;
  if (gold) await prisma.tvGame.update({ where: { id: g.id }, data: { gold } });
  return { verdict, gold };
}

// ───────────── the live feed ─────────────

/** One poll request = chat + ticker + reactions + viewers + pinned super chat + poll + watch heartbeat. */
export async function liveFeed(ch: TvChannel, user: Viewer, viewerKey: string, since: number, opts: { beat: boolean; titles: (o: PollOption) => string }): Promise<TvLiveDTO> {
  const now = new Date();
  touchPresence(ch.id, user?.id ?? `anon:${viewerKey}`, now.getTime());
  const social = !ch.familyOnly;
  const [chat, pinned, poll, goldEarned, alerts, pip] = await Promise.all([
    social ? chatFeed(ch, user?.id ?? null, since, now) : { messages: [], tickers: [] },
    social ? pinnedNow(ch.id, now) : null,
    social ? ensurePoll(ch, now).catch((e) => (console.error("[tv poll]", e), null)) : null,
    opts.beat && user && !user.kidsMode ? watchBeat(user.id, now) : 0,
    activeAlerts(ch.id, now),
    activePip(ch.id, now),
  ]);
  const gold = user ? (await prisma.user.findUnique({ where: { id: user.id }, select: { gold: true } }))?.gold ?? null : null;
  return {
    serverNow: Date.now(),
    viewers: viewersNow(ch.id, now.getTime()),
    messages: chat.messages,
    tickers: chat.tickers,
    reactions: recentReactions(ch.id, since, now.getTime()),
    pinned,
    poll: await pollDTO(poll, user?.id ?? null, opts.titles, now),
    goldEarned,
    gold,
    alerts,
    pip,
  };
}
