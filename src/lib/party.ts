import "server-only";
import { prisma } from "./db";
import { channelFor } from "./tv";
import { chatTextProblem, normalizeText } from "./tv-rules";
import { getEpisodeAccess } from "./coins";
import { adultSeriesBlock } from "./spicy";
import { readyAssetFor } from "./watermark";
import { rateLimit } from "./rate-limit";
import {
  canControl,
  countdownLeft,
  expectedPosition,
  FOOD_SERVICES,
  foodSplit,
  isFoodService,
  isOnline,
  PARTY_CHAT_MAX,
  PARTY_CODE_RE,
  PARTY_COUNTDOWN_SEC,
  PARTY_FOOD_ITEMS_MAX,
  PARTY_IDLE_MS,
  PARTY_MAX_MEMBERS,
  PARTY_POLL_OPTIONS_MAX,
  PARTY_REACTIONS,
  PARTY_THEMES,
  PARTY_TITLE_MAX,
  parsePoll,
  partyCode,
  tally,
  type FoodService,
  type PartyTheme,
} from "./party-rules";

export class PartyError extends Error {
  constructor(public code: "AUTH" | "KIDS" | "NOT_FOUND" | "FULL" | "KICKED" | "ENDED" | "FORBIDDEN" | "INVALID" | "RATE" | "LOCKED" | "TEXT") {
    super(code);
  }
}

type User = {
  id: string;
  name: string;
  role: string;
  kidsMode: boolean;
  showAdult: boolean;
  adultConfirmedAt: Date | null;
  avatarHue: number;
  subscription: { status: string; currentPeriodEnd: Date } | null;
  banned?: boolean;
};

function need(user: User | null): User {
  if (!user || user.banned) throw new PartyError("AUTH");
  if (user.kidsMode) throw new PartyError("KIDS");
  return user;
}

const sys = (partyId: string, k: string, extra: Record<string, unknown> = {}, userId: string | null = null) =>
  prisma.partyEvent.create({ data: { partyId, userId, kind: "SYSTEM", body: JSON.stringify({ k, ...extra }) } });

/** An episode the controller may put on: published, released, not hidden 18+, and they can watch it themselves. */
async function checkEpisode(user: User, episodeId: string) {
  const r = await getEpisodeAccess({ id: user.id, role: user.role as "VIEWER", subscription: user.subscription }, episodeId);
  if (!r || r.episode.series.status !== "PUBLISHED" || adultSeriesBlock(user, r.episode.series)) throw new PartyError("NOT_FOUND");
  if (!r.access.ok) throw new PartyError("LOCKED");
  return r.episode;
}

export async function createParty(rawUser: User | null, input: { channelSlug?: string | null; episodeId?: string | null; title?: string }) {
  const user = need(rawUser);
  if (!rateLimit(`party-create:${user.id}`, 10, 3600_000).allowed) throw new PartyError("RATE");
  let channelSlug: string | null = null;
  let episodeId: string | null = null;
  if (input.episodeId) episodeId = (await checkEpisode(user, input.episodeId)).id;
  else {
    const ch = input.channelSlug ? await channelFor(input.channelSlug, user) : null;
    if (!ch) throw new PartyError("NOT_FOUND");
    channelSlug = ch.slug;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const party = await prisma.party.create({
        data: {
          code: partyCode(),
          hostId: user.id,
          remoteId: user.id,
          title: normalizeText(input.title ?? "").slice(0, PARTY_TITLE_MAX),
          mode: episodeId ? "EPISODE" : "TV",
          channelSlug,
          episodeId,
          members: { create: { userId: user.id } },
        },
      });
      await sys(party.id, "created", { name: user.name }, user.id);
      return party;
    } catch (e) {
      if (attempt === 4) throw e; // code collision 5 times in a row: give up
    }
  }
  throw new PartyError("INVALID");
}

async function partyByCode(code: string) {
  if (!PARTY_CODE_RE.test(code)) throw new PartyError("NOT_FOUND");
  const p = await prisma.party.findUnique({ where: { code } });
  if (!p) throw new PartyError("NOT_FOUND");
  if (p.endedAt || Date.now() - p.lastActiveAt.getTime() > PARTY_IDLE_MS) throw new PartyError("ENDED");
  return p;
}

/** Opening the invite link joins the room (up to PARTY_MAX_MEMBERS; kicked people stay out). */
export async function joinParty(rawUser: User | null, code: string) {
  const user = need(rawUser);
  const p = await partyByCode(code);
  const m = await prisma.partyMember.findUnique({ where: { partyId_userId: { partyId: p.id, userId: user.id } } });
  if (m?.kicked) throw new PartyError("KICKED");
  if (!m) {
    const count = await prisma.partyMember.count({ where: { partyId: p.id, kicked: false } });
    if (count >= PARTY_MAX_MEMBERS) throw new PartyError("FULL");
    await prisma.partyMember.create({ data: { partyId: p.id, userId: user.id } });
    await sys(p.id, "joined", { name: user.name }, user.id);
  }
  return p;
}

async function membership(user: User, code: string) {
  const p = await partyByCode(code);
  const m = await prisma.partyMember.findUnique({ where: { partyId_userId: { partyId: p.id, userId: user.id } } });
  if (!m) throw new PartyError("FORBIDDEN");
  if (m.kicked) throw new PartyError("KICKED");
  return { p, m };
}

// ---------------------------------------------------------------- state (polled every ~2 s)

export async function partyState(rawUser: User | null, code: string, since: number) {
  const user = need(rawUser);
  const { p, m } = await membership(user, code);
  const now = Date.now();
  // heartbeat (at most every 5 s per member)
  if (now - m.lastSeenAt.getTime() > 5_000) {
    await prisma.partyMember.update({ where: { partyId_userId: { partyId: p.id, userId: user.id } }, data: { lastSeenAt: new Date(now) } });
  }
  const [members, events, food, votes] = await Promise.all([
    prisma.partyMember.findMany({ where: { partyId: p.id, kicked: false }, include: { user: { select: { id: true, name: true, avatarHue: true } } }, orderBy: { joinedAt: "asc" } }),
    prisma.partyEvent.findMany({
      where: { partyId: p.id, createdAt: { gt: new Date(since || now - 10 * 60_000) } },
      orderBy: { createdAt: "asc" },
      take: 120,
      include: { user: { select: { name: true, avatarHue: true } } },
    }),
    prisma.partyFood.findMany({ where: { partyId: p.id }, orderBy: { createdAt: "asc" }, include: { user: { select: { name: true } } } }),
    p.pollJson ? prisma.partyVote.findMany({ where: { partyId: p.id } }) : Promise.resolve([]),
  ]);
  const poll = parsePoll(p.pollJson);
  const pollVotes = poll ? votes.filter((v) => v.pollId === poll.id) : [];
  const online = members.filter((x) => isOnline(x.lastSeenAt.getTime(), now) || x.userId === user.id);

  let episode: null | {
    id: string;
    number: number;
    title: string;
    seriesTitle: string;
    seriesSlug: string;
    durationSec: number;
    vertical: boolean;
    access: { ok: true } | { ok: false; price: number };
    hls: boolean;
  } = null;
  if (p.mode === "EPISODE" && p.episodeId) {
    const r = await getEpisodeAccess({ id: user.id, role: user.role as "VIEWER", subscription: user.subscription }, p.episodeId);
    if (r) {
      const s = await prisma.series.findUnique({ where: { id: r.episode.seriesId }, select: { titleEn: true, titleRu: true, slug: true, orientation: true } });
      episode = {
        id: r.episode.id,
        number: r.episode.number,
        title: r.episode.titleEn || r.episode.titleRu || "",
        seriesTitle: s?.titleEn || s?.titleRu || "",
        seriesSlug: s?.slug ?? "",
        durationSec: r.episode.durationSec,
        vertical: s?.orientation === "VERTICAL",
        access: r.access.ok ? { ok: true } : { ok: false, price: r.access.price },
        hls: r.access.ok && !!(await readyAssetFor(r.episode.videoUrl)),
      };
    }
  }

  const split = foodSplit(
    food.map((f) => ({ userId: f.userId, priceCents: f.priceCents, qty: f.qty })),
    { mode: "items" },
  );
  return {
    serverNow: now,
    me: { id: user.id, host: p.hostId === user.id, control: canControl(user.id, p) },
    party: {
      code: p.code,
      title: p.title,
      mode: p.mode as "TV" | "EPISODE",
      channelSlug: p.channelSlug,
      theme: p.theme as PartyTheme,
      hostId: p.hostId,
      remoteId: p.remoteId,
      playback: { playing: p.playing, positionSec: p.positionSec, stateAt: p.stateAt.getTime() },
      readyCheck: !!p.readyCheckAt,
      countdownTo: p.countdownTo && countdownLeft(p.countdownTo.getTime(), now) ? p.countdownTo.getTime() : null,
      food: {
        byId: p.foodById,
        service: (p.foodService as FoodService | null) ?? null,
        etaAt: p.foodEtaAt?.getTime() ?? null,
        arrivedAt: p.foodArrivedAt?.getTime() ?? null,
      },
      poll: poll
        ? { ...poll, counts: tally(pollVotes, poll.options.length), mine: pollVotes.find((v) => v.userId === user.id)?.option ?? null }
        : null,
    },
    members: members.map((x) => ({
      id: x.userId,
      name: x.user.name,
      hue: x.user.avatarHue,
      online: online.some((o) => o.userId === x.userId),
      ready: !!x.readyAt,
    })),
    events: events.map((e) => ({
      id: e.id,
      kind: e.kind as "CHAT" | "REACTION" | "MOMENT" | "SYSTEM",
      body: e.body,
      atSec: e.atSec,
      at: e.createdAt.getTime(),
      userId: e.userId,
      name: e.user?.name ?? "",
      hue: e.user?.avatarHue ?? 0,
    })),
    food: food.map((f) => ({ id: f.id, userId: f.userId, name: f.user.name, item: f.item, priceCents: f.priceCents, qty: f.qty })),
    split: { total: split.total, perUser: Object.fromEntries(split.perUser) },
    episode,
  };
}

export type PartyStateDTO = Awaited<ReturnType<typeof partyState>>;

// ---------------------------------------------------------------- actions

export type PartyOp =
  | { op: "chat"; text: string }
  | { op: "react"; emoji: string }
  | { op: "moment"; atSec: number; note?: string }
  | { op: "play" | "pause" | "seek"; positionSec: number }
  | { op: "channel"; slug: string }
  | { op: "episode"; episodeId: string }
  | { op: "remote"; userId: string }
  | { op: "kick"; userId: string }
  | { op: "theme"; theme: string }
  | { op: "title"; title: string }
  | { op: "readyCheck" }
  | { op: "ready" }
  | { op: "go"; positionSec: number }
  | { op: "poll"; question: string; options: string[] }
  | { op: "vote"; option: number }
  | { op: "closePoll" }
  | { op: "foodAdd"; item: string; priceCents?: number | null; qty?: number }
  | { op: "foodRemove"; id: string }
  | { op: "foodClaim"; service: string }
  | { op: "foodEta"; minutes: number }
  | { op: "foodArrived" }
  | { op: "foodReset" }
  | { op: "leave" }
  | { op: "end" };

export async function partyAction(rawUser: User | null, code: string, a: PartyOp) {
  const user = need(rawUser);
  const { p } = await membership(user, code);
  const control = canControl(user.id, p);
  const host = p.hostId === user.id;
  const now = new Date();
  const touch = (data: Record<string, unknown> = {}) => prisma.party.update({ where: { id: p.id }, data: { ...data, lastActiveAt: now } });
  const mustControl = () => {
    if (!control) throw new PartyError("FORBIDDEN");
  };
  const position = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(x, 6 * 3600)) : 0);

  switch (a.op) {
    case "chat": {
      if (!rateLimit(`party-chat:${user.id}`, 20, 60_000).allowed) throw new PartyError("RATE");
      const text = normalizeText(String(a.text ?? "")).slice(0, PARTY_CHAT_MAX);
      if (chatTextProblem(text.slice(0, 200))) throw new PartyError("TEXT");
      await prisma.partyEvent.create({ data: { partyId: p.id, userId: user.id, kind: "CHAT", body: text } });
      return touch();
    }
    case "react": {
      if (!(PARTY_REACTIONS as readonly string[]).includes(a.emoji)) throw new PartyError("INVALID");
      if (!rateLimit(`party-react:${user.id}`, 40, 60_000).allowed) throw new PartyError("RATE");
      await prisma.partyEvent.create({ data: { partyId: p.id, userId: user.id, kind: "REACTION", body: a.emoji } });
      return;
    }
    case "moment": {
      if (!rateLimit(`party-moment:${user.id}`, 10, 60_000).allowed) throw new PartyError("RATE");
      const note = normalizeText(String(a.note ?? "")).slice(0, 80);
      await prisma.partyEvent.create({ data: { partyId: p.id, userId: user.id, kind: "MOMENT", body: note, atSec: position(a.atSec) } });
      return touch();
    }
    case "play":
    case "pause":
    case "seek": {
      mustControl();
      if (p.mode !== "EPISODE") throw new PartyError("INVALID");
      const playing = a.op === "play" ? true : a.op === "pause" ? false : p.playing;
      await touch({ playing, positionSec: position(a.positionSec), stateAt: now, countdownTo: null });
      if (a.op !== "seek") await sys(p.id, a.op, { name: user.name }, user.id);
      return;
    }
    case "go": {
      // after the ready check: everybody starts together after a short countdown
      mustControl();
      if (p.mode !== "EPISODE") throw new PartyError("INVALID");
      const start = new Date(now.getTime() + PARTY_COUNTDOWN_SEC * 1000);
      await touch({ playing: true, positionSec: position(a.positionSec), stateAt: start, countdownTo: start, readyCheckAt: null });
      await prisma.partyMember.updateMany({ where: { partyId: p.id }, data: { readyAt: null } });
      return sys(p.id, "go", { name: user.name }, user.id);
    }
    case "channel": {
      mustControl();
      const ch = await channelFor(String(a.slug ?? ""), user);
      if (!ch) throw new PartyError("NOT_FOUND");
      await touch({ mode: "TV", channelSlug: ch.slug, episodeId: null, playing: false, positionSec: 0, stateAt: now });
      return sys(p.id, "channel", { name: user.name, channel: ch.nameEn, channelRu: ch.nameRu }, user.id);
    }
    case "episode": {
      mustControl();
      const ep = await checkEpisode(user, String(a.episodeId ?? ""));
      await touch({ mode: "EPISODE", episodeId: ep.id, playing: false, positionSec: 0, stateAt: now, readyCheckAt: now, countdownTo: null });
      await prisma.partyMember.updateMany({ where: { partyId: p.id }, data: { readyAt: null } });
      return sys(p.id, "episode", { name: user.name, n: ep.number }, user.id);
    }
    case "remote": {
      mustControl();
      const target = await prisma.partyMember.findUnique({ where: { partyId_userId: { partyId: p.id, userId: String(a.userId) } }, include: { user: { select: { name: true } } } });
      if (!target || target.kicked) throw new PartyError("NOT_FOUND");
      await touch({ remoteId: target.userId });
      return sys(p.id, "remote", { name: target.user.name }, user.id);
    }
    case "kick": {
      if (!host || a.userId === user.id) throw new PartyError("FORBIDDEN");
      const target = await prisma.partyMember.findUnique({ where: { partyId_userId: { partyId: p.id, userId: String(a.userId) } }, include: { user: { select: { name: true } } } });
      if (!target) throw new PartyError("NOT_FOUND");
      await prisma.partyMember.update({ where: { partyId_userId: { partyId: p.id, userId: target.userId } }, data: { kicked: true } });
      if (p.remoteId === target.userId) await touch({ remoteId: p.hostId });
      return sys(p.id, "kicked", { name: target.user.name }, user.id);
    }
    case "theme": {
      if (!(PARTY_THEMES as readonly string[]).includes(a.theme)) throw new PartyError("INVALID");
      return touch({ theme: a.theme });
    }
    case "title": {
      if (!host) throw new PartyError("FORBIDDEN");
      return touch({ title: normalizeText(String(a.title ?? "")).slice(0, PARTY_TITLE_MAX) });
    }
    case "readyCheck": {
      mustControl();
      await prisma.partyMember.updateMany({ where: { partyId: p.id }, data: { readyAt: null } });
      await touch({ readyCheckAt: now, playing: false });
      return sys(p.id, "readyCheck", { name: user.name }, user.id);
    }
    case "ready": {
      await prisma.partyMember.update({ where: { partyId_userId: { partyId: p.id, userId: user.id } }, data: { readyAt: now } });
      return sys(p.id, "ready", { name: user.name }, user.id);
    }
    case "poll": {
      const question = normalizeText(String(a.question ?? "")).slice(0, 120);
      const options = (Array.isArray(a.options) ? a.options : []).map((o) => normalizeText(String(o)).slice(0, 60)).filter(Boolean).slice(0, PARTY_POLL_OPTIONS_MAX);
      if (!question || options.length < 2 || chatTextProblem(question.slice(0, 200)) || options.some((o) => chatTextProblem(o))) throw new PartyError("TEXT");
      if (parsePoll(p.pollJson) && !control) throw new PartyError("FORBIDDEN");
      const id = `${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      await touch({ pollJson: JSON.stringify({ id, question, options }) });
      return sys(p.id, "poll", { name: user.name, question }, user.id);
    }
    case "vote": {
      const poll = parsePoll(p.pollJson);
      if (!poll || !Number.isInteger(a.option) || a.option < 0 || a.option >= poll.options.length) throw new PartyError("INVALID");
      await prisma.partyVote.upsert({
        where: { pollId_userId: { pollId: poll.id, userId: user.id } },
        create: { partyId: p.id, pollId: poll.id, userId: user.id, option: a.option },
        update: { option: a.option },
      });
      return;
    }
    case "closePoll": {
      mustControl();
      const poll = parsePoll(p.pollJson);
      if (!poll) return;
      const counts = tally(await prisma.partyVote.findMany({ where: { pollId: poll.id } }), poll.options.length);
      const best = counts.indexOf(Math.max(...counts));
      await touch({ pollJson: null });
      return sys(p.id, "pollResult", { question: poll.question, winner: poll.options[best] ?? "", votes: counts[best] ?? 0 }, user.id);
    }
    case "foodAdd": {
      const item = normalizeText(String(a.item ?? "")).slice(0, 80);
      if (!item || chatTextProblem(item)) throw new PartyError("TEXT");
      if ((await prisma.partyFood.count({ where: { partyId: p.id } })) >= PARTY_FOOD_ITEMS_MAX) throw new PartyError("FULL");
      const price = a.priceCents == null ? null : Math.round(Number(a.priceCents));
      if (price !== null && (!Number.isFinite(price) || price < 0 || price > 100_000)) throw new PartyError("INVALID");
      const qty = Math.min(20, Math.max(1, Math.round(Number(a.qty ?? 1)) || 1));
      await prisma.partyFood.create({ data: { partyId: p.id, userId: user.id, item, priceCents: price, qty } });
      return touch();
    }
    case "foodRemove": {
      const f = await prisma.partyFood.findUnique({ where: { id: String(a.id) } });
      if (!f || f.partyId !== p.id || (f.userId !== user.id && !host)) throw new PartyError("NOT_FOUND");
      await prisma.partyFood.delete({ where: { id: f.id } });
      return;
    }
    case "foodClaim": {
      if (!isFoodService(a.service)) throw new PartyError("INVALID");
      if (p.foodById && p.foodById !== user.id && !host && !p.foodArrivedAt) throw new PartyError("FORBIDDEN");
      await touch({ foodById: user.id, foodService: a.service, foodArrivedAt: null, foodEtaAt: null });
      return sys(p.id, "foodClaim", { name: user.name, service: FOOD_SERVICES[a.service].name }, user.id);
    }
    case "foodEta": {
      if (p.foodById !== user.id && !host) throw new PartyError("FORBIDDEN");
      const minutes = Math.round(Number(a.minutes));
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240) throw new PartyError("INVALID");
      await touch({ foodEtaAt: new Date(now.getTime() + minutes * 60_000) });
      return sys(p.id, "foodEta", { name: user.name, minutes }, user.id);
    }
    case "foodArrived": {
      // the doorbell rang: pause the episode for everyone so nobody misses anything
      const pause = p.mode === "EPISODE" && p.playing;
      const pos = expectedPosition({ playing: p.playing, positionSec: p.positionSec, stateAt: p.stateAt.getTime() }, now.getTime());
      await touch({ foodArrivedAt: now, ...(pause ? { playing: false, positionSec: pos, stateAt: now } : {}) });
      return sys(p.id, "foodArrived", { name: user.name, paused: pause }, user.id);
    }
    case "foodReset": {
      if (!host && p.foodById !== user.id) throw new PartyError("FORBIDDEN");
      await prisma.partyFood.deleteMany({ where: { partyId: p.id } });
      return touch({ foodById: null, foodService: null, foodEtaAt: null, foodArrivedAt: null });
    }
    case "leave": {
      await prisma.partyMember.delete({ where: { partyId_userId: { partyId: p.id, userId: user.id } } });
      await sys(p.id, "left", { name: user.name }, user.id);
      if (host || p.remoteId === user.id) {
        // hand the room to the longest-present online member, or close it
        const next = await prisma.partyMember.findFirst({ where: { partyId: p.id, kicked: false }, orderBy: { joinedAt: "asc" } });
        if (!next) return touch({ endedAt: now });
        await touch({ ...(host ? { hostId: next.userId } : {}), remoteId: next.userId });
      }
      return;
    }
    case "end": {
      if (!host) throw new PartyError("FORBIDDEN");
      await touch({ endedAt: now });
      return sys(p.id, "ended", { name: user.name }, user.id);
    }
    default:
      throw new PartyError("INVALID");
  }
}

/** Rooms I am in (open), for the "Watch together" hub. */
export async function myParties(userId: string) {
  return prisma.party.findMany({
    where: { endedAt: null, lastActiveAt: { gt: new Date(Date.now() - PARTY_IDLE_MS) }, members: { some: { userId, kicked: false } } },
    orderBy: { lastActiveAt: "desc" },
    take: 10,
    include: { _count: { select: { members: true } }, host: { select: { name: true } } },
  });
}
