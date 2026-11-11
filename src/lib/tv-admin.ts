import { invalidateBuffers } from "./tv-control";
import "server-only";
import { z } from "zod";
import { prisma } from "./db";
import { complete } from "./llm";
import { utcDay } from "./rewards";
import { mockResult, mockState } from "./generation";
import { failJob, genProvider } from "./video-gen";
import { fileDuration, rebuildRestOfDay, rewriteHostLines, TvError, payBounty } from "./tv";
import { viewersByChannel } from "./tv-live";
import { CHANNEL_KINDS, CLIP_KINDS, ideaProblem, normalizeText, type ProgramItem } from "./tv-rules";

// ───────────── dashboard ─────────────

const TV_REASONS = ["TV_ORDER", "TV_TICKER", "TV_SUPERCHAT"] as const;

export async function tvDashboard(now = new Date()) {
  const week = new Date(now.getTime() - 7 * 86400_000);
  const day = new Date(now.getTime() - 86400_000);
  const [channels, money, refunds, messages, orders, votes, answers, games, watch, topPlays, topLikes] = await Promise.all([
    prisma.tvChannel.findMany({ orderBy: { number: "asc" }, select: { id: true, slug: true, number: true, nameRu: true, nameEn: true, active: true } }),
    prisma.coinTransaction.groupBy({ by: ["reason"], where: { reason: { in: [...TV_REASONS] }, createdAt: { gte: week } }, _sum: { amount: true, paid: true }, _count: { _all: true } }),
    prisma.coinTransaction.aggregate({ where: { reason: "REFUND", note: { startsWith: "tv order" }, createdAt: { gte: week } }, _sum: { amount: true } }),
    prisma.tvMessage.count({ where: { createdAt: { gte: day } } }),
    prisma.tvOrder.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.tvPollVote.count({ where: { createdAt: { gte: day } } }),
    prisma.tvQuizAnswer.count({ where: { createdAt: { gte: day } } }),
    prisma.tvGame.count({ where: { startedAt: { gte: day } } }),
    prisma.tvWatch.aggregate({ where: { day: utcDay(now) }, _sum: { seconds: true }, _count: { _all: true } }),
    prisma.tvClip.findMany({ where: { status: "APPROVED" }, orderBy: { plays: "desc" }, take: 8, select: { id: true, title: true, artist: true, plays: true, channel: { select: { nameRu: true, nameEn: true } } } }),
    prisma.tvClipLike.groupBy({ by: ["clipId"], where: { createdAt: { gte: week } }, _count: { _all: true }, orderBy: { _count: { clipId: "desc" } }, take: 8 }),
  ]);
  const live = viewersByChannel(now.getTime());
  const likedClips = await prisma.tvClip.findMany({ where: { id: { in: topLikes.map((l) => l.clipId) } }, select: { id: true, title: true, artist: true } });
  const revenue = TV_REASONS.map((r) => {
    const g = money.find((m) => m.reason === r);
    return { reason: r, coins: Math.abs(g?._sum.amount ?? 0), paid: Math.abs(g?._sum.paid ?? 0), count: g?._count._all ?? 0 };
  });
  return {
    channels: channels.map((c) => ({ ...c, viewers: live[c.id] ?? 0 })),
    viewersTotal: Object.values(live).reduce((a, b) => a + b, 0),
    revenue,
    refunded: refunds._sum.amount ?? 0,
    activity: { messages, votes, answers, games, watchers: watch._count._all, watchMinutes: Math.round((watch._sum.seconds ?? 0) / 60) },
    orders: Object.fromEntries(orders.map((o) => [o.status, o._count._all])) as Record<string, number>,
    topPlays,
    topLikes: topLikes.map((l) => ({ ...likedClips.find((c) => c.id === l.clipId)!, likes: l._count._all })).filter((x) => x.id),
  };
}

// ───────────── channels ─────────────

export const channelSchema = z.object({
  id: z.string().max(64).optional(),
  slug: z.string().regex(/^[a-z0-9-]{2,30}$/),
  number: z.number().int().min(1).max(99),
  nameRu: z.string().trim().min(1).max(40),
  nameEn: z.string().trim().min(1).max(40),
  taglineRu: z.string().max(140).default(""),
  taglineEn: z.string().max(140).default(""),
  kind: z.enum(CHANNEL_KINDS),
  genres: z.string().max(300).default(""),
  hue: z.number().int().min(0).max(360),
  hostName: z.string().trim().min(1).max(40),
  hostPersona: z.string().max(600).default(""),
  familyOnly: z.boolean(),
  isAdult: z.boolean(),
  ticker: z.boolean(),
  quiz: z.boolean(),
  active: z.boolean(),
  bufferTargetMin: z.number().int().min(1).max(1440).optional(),
});
export type ChannelInput = z.infer<typeof channelSchema>;

export async function saveChannel(input: ChannelInput) {
  if (input.familyOnly && input.isAdult) throw new TvError("STATE");
  const { id, ...data } = input;
  data.genres = data.genres
    .split(",")
    .map((g) => g.trim().toLowerCase())
    .filter(Boolean)
    .join(",");
  const clash = await prisma.tvChannel.findFirst({ where: { OR: [{ slug: data.slug }, { number: data.number }], ...(id ? { NOT: { id } } : {}) } });
  if (clash) throw new TvError("LIMIT");
  invalidateBuffers();
  const ch = id ? await prisma.tvChannel.update({ where: { id }, data }) : await prisma.tvChannel.create({ data });
  // Genres/flags changed what may air: plan the rest of today again.
  await rebuildRestOfDay(ch.id).catch((e) => console.error("[tv channel rebuild]", e));
  return ch;
}

// ───────────── schedule ─────────────

export async function channelSchedule(channelId: string, now = new Date()) {
  const slots = await prisma.tvSlot.findMany({
    where: { channelId, startsAt: { gte: new Date(now.getTime() - 5 * 60_000), lte: new Date(now.getTime() + 3600_000) } },
    orderBy: { startsAt: "asc" },
    include: { clip: { select: { title: true, artist: true, kind: true } }, episode: { select: { number: true, series: { select: { titleRu: true, titleEn: true } } } } },
  });
  return slots.map((s) => ({
    id: s.id,
    startsAt: s.startsAt,
    durationSec: s.durationSec,
    kind: s.kind,
    title: s.clip ? (s.clip.artist ? `${s.clip.artist} — ${s.clip.title}` : s.clip.title) : s.episode ? `${s.episode.series.titleEn || s.episode.series.titleRu} · ${s.episode.number}` : s.textEn || s.textRu,
    onAir: s.startsAt <= now && s.startsAt.getTime() + s.durationSec * 1000 > now.getTime(),
    past: s.startsAt.getTime() + s.durationSec * 1000 <= now.getTime(),
  }));
}

/** Takes a slot off the air: it becomes a "technical break" host card of the same length (the grid stays intact). */
export async function techBreak(slotId: string, now = new Date()) {
  const s = await prisma.tvSlot.findUnique({ where: { id: slotId } });
  if (!s || s.startsAt.getTime() + s.durationSec * 1000 <= now.getTime()) throw new TvError("STATE");
  await prisma.tvSlot.update({
    where: { id: slotId },
    data: { kind: "HOST", clipId: null, episodeId: null, breakClipId: null, data: "", textRu: "Технический перерыв. Не переключайтесь — скоро вернёмся!", textEn: "Technical difficulties. Stay tuned — we'll be right back!" },
  });
}

/** "Breaking news": this clip airs right after the current slot (the rest of the day is planned again). */
export async function breakIn(clipId: string, now = new Date()) {
  const clip = await prisma.tvClip.findUnique({ where: { id: clipId } });
  if (!clip || clip.status !== "APPROVED") throw new TvError("NOT_FOUND");
  const first: ProgramItem = { type: "CLIP", id: clip.id, durationSec: clip.durationSec, title: clip.title };
  await rebuildRestOfDay(clip.channelId, now, first);
}

export async function rewriteNow(channelId: string) {
  return rewriteHostLines(channelId, utcDay(), { force: true });
}

// ───────────── clip library ─────────────

export async function listClips(filter: { channelId?: string; status?: string; q?: string }) {
  return prisma.tvClip.findMany({
    where: {
      ...(filter.channelId ? { channelId: filter.channelId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.q ? { OR: [{ title: { contains: filter.q } }, { artist: { contains: filter.q } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 120,
    include: { channel: { select: { nameRu: true, nameEn: true, number: true } }, creator: { select: { name: true } }, _count: { select: { likes: true } } },
  });
}

export async function updateClip(id: string, input: { title?: string; artist?: string; kind?: string; status?: string }) {
  const data: Record<string, string> = {};
  if (input.title !== undefined) {
    const t = normalizeText(input.title).slice(0, 120);
    if (t.length < 2) throw new TvError("empty");
    data.title = t;
  }
  if (input.artist !== undefined) data.artist = normalizeText(input.artist).slice(0, 80);
  if (input.kind && (CLIP_KINDS as readonly string[]).includes(input.kind)) data.kind = input.kind;
  if (input.status && ["PENDING", "APPROVED", "REJECTED"].includes(input.status)) data.status = input.status;
  const clip = await prisma.tvClip.update({ where: { id }, data });
  // Taking a clip off the air or putting it back changes what may air today.
  if (data.status) await rebuildRestOfDay(clip.channelId).catch(() => {});
  if (data.status === "APPROVED") await payBounty(id);
  return clip;
}

export async function deleteClip(id: string) {
  const clip = await prisma.tvClip.findUnique({ where: { id } });
  if (!clip) throw new TvError("NOT_FOUND");
  await prisma.tvClip.delete({ where: { id } });
  await rebuildRestOfDay(clip.channelId).catch(() => {});
}

// ───────────── AI clip factory ─────────────

const IDEA_TEMPLATES: Record<string, { title: string; prompt: string; kind: string }[]> = {
  ABSURD: [
    { title: "Shopping channel: the self-folding sock", kind: "AD", prompt: "Retro TV shopping channel, an overexcited alien presenter demonstrates a sock that folds itself, bright studio lights, VHS look" },
    { title: "Weather from the toaster dimension", kind: "SHOW", prompt: "A weather forecaster made of toast points at a map of crumbs, cheerful 90s TV studio, comedic" },
    { title: "Cooking show: soup that cooks you back", kind: "SHOW", prompt: "Chaotic cooking show, a pot of soup with eyes stirs the chef, colorful kitchen set, slapstick" },
  ],
  DOCS: [
    { title: "Crystal moths of Ross 128", kind: "SHOW", prompt: "Nature documentary, glowing crystal moths swarm over an alien violet lake at dusk, slow cinematic drone shot" },
    { title: "The walking forests", kind: "SHOW", prompt: "Documentary footage of giant trees slowly walking across a misty alien plain, golden hour, macro detail" },
  ],
  DARK: [
    { title: "Tape #52: the empty mall", kind: "SHOW", prompt: "Analog horror VHS footage of an empty 90s shopping mall at night, flickering lights, a distant silhouette, grainy" },
    { title: "Object 1-04: the door that hums", kind: "SHOW", prompt: "Found footage, an old metal door in a concrete bunker vibrates and hums, red emergency light, ominous" },
  ],
  MUSIC: [
    { title: "Neon Comet — Paper Planes (video)", kind: "MUSIC", prompt: "Early 2000s pop music video, singer in a silver jacket dancing on a rooftop at night, fisheye lens, lens flares" },
    { title: "DJ Pixelwave — Floppy Disk Love (video)", kind: "MUSIC", prompt: "Y2K club music video, dancers in glowing outfits, strobe lights, chrome text, VHS color bleed" },
  ],
  CHILL: [
    { title: "Rain over a sleeping city", kind: "SHOW", prompt: "Slow cinematic shot of rain on a window overlooking a neon city at night, soft focus, calm" },
    { title: "Clouds over Lake Nowhere", kind: "SHOW", prompt: "Timelapse of pastel clouds over a still mountain lake, gentle, dreamy" },
  ],
};

/** The showrunner suggests clip ideas for a channel (LLM; templates without one). Saved as drafts. */
export async function suggestIdeas(channelId: string, n = 5) {
  const ch = await prisma.tvChannel.findUnique({ where: { id: channelId } });
  if (!ch) throw new TvError("NOT_FOUND");
  let ideas: { title: string; prompt: string; kind: string }[] = [];
  const raw = await complete(
    [
      {
        role: "system",
        content: `You are the showrunner of "${ch.nameEn}" (${ch.taglineEn}), a channel of MIRAGE — an absurd interdimensional AI television. Invent ${n} short clips (5–8 s) for the channel. For each give a catchy title, a kind (SHOW, BUMPER, AD or MUSIC) and an English text-to-video prompt (max 50 words: scene, subject, action, camera, style). No real people or brands, nothing sexual, no minors. Answer with JSON only: [{"title":"…","kind":"…","prompt":"…"}].`,
      },
      { role: "user", content: `Channel host: ${ch.hostName}. Date: ${utcDay()}.` },
    ],
    1500,
  );
  try {
    const m = raw?.match(/\[[\s\S]*\]/);
    const arr = m ? (JSON.parse(m[0]) as { title?: unknown; kind?: unknown; prompt?: unknown }[]) : [];
    ideas = arr
      .filter((x) => typeof x.title === "string" && typeof x.prompt === "string")
      .map((x) => ({ title: String(x.title).slice(0, 120), prompt: String(x.prompt).slice(0, 600), kind: (CLIP_KINDS as readonly string[]).includes(String(x.kind)) ? String(x.kind) : "SHOW" }))
      .filter((x) => ideaProblem(x.prompt.slice(0, 300)) !== "banned")
      .slice(0, n);
  } catch {
    ideas = [];
  }
  if (!ideas.length) ideas = IDEA_TEMPLATES[ch.kind] ?? IDEA_TEMPLATES.ABSURD;
  await prisma.tvFactoryItem.createMany({ data: ideas.map((i) => ({ channelId, title: i.title, prompt: i.prompt, kind: i.kind })) });
  return ideas.length;
}

export async function addIdea(channelId: string, title: string, prompt: string, kind: string) {
  const p = normalizeText(prompt);
  if (p.length < 5) throw new TvError("empty");
  if (ideaProblem(p.slice(0, 300)) === "banned") throw new TvError("banned");
  return prisma.tvFactoryItem.create({
    data: { channelId, title: normalizeText(title).slice(0, 120) || p.slice(0, 60), prompt: p.slice(0, 900), kind: (CLIP_KINDS as readonly string[]).includes(kind) ? kind : "SHOW" },
  });
}

/** Films a factory idea (mock or LTX). Returns the job to run after the response. */
export async function filmIdea(itemId: string, adminId: string) {
  const item = await prisma.tvFactoryItem.findUnique({ where: { id: itemId } });
  if (!item || !["DRAFT", "FAILED"].includes(item.status)) throw new TvError("STATE");
  const provider = genProvider();
  const job = await prisma.generationJob.create({
    data: { userId: adminId, prompt: item.prompt, style: "cinematic", orientation: "HORIZONTAL", durationSec: 5, seed: Math.floor(Math.random() * 2 ** 31), cost: 0, provider, status: provider === "mock" ? "QUEUED" : "RUNNING" },
  });
  await prisma.tvFactoryItem.update({ where: { id: item.id }, data: { jobId: job.id, status: "GENERATING" } });
  return job;
}

export async function syncFactory(now = Date.now()) {
  const items = await prisma.tvFactoryItem.findMany({ where: { status: "GENERATING" } });
  for (const it of items) {
    const job = it.jobId ? await prisma.generationJob.findUnique({ where: { id: it.jobId } }) : null;
    if (!job) {
      await prisma.tvFactoryItem.update({ where: { id: it.id }, data: { status: "FAILED" } });
      continue;
    }
    if (job.provider === "mock" && job.status !== "DONE" && job.status !== "FAILED" && mockState(now - job.createdAt.getTime(), job.durationSec).status === "DONE") {
      await prisma.generationJob.update({ where: { id: job.id }, data: { status: "DONE", resultUrl: mockResult(job.seed, job.orientation), finishedAt: new Date(now) } });
      job.status = "DONE";
    } else if (job.provider !== "mock" && (job.status === "RUNNING" || job.status === "QUEUED") && now - job.createdAt.getTime() > 10 * 60_000) {
      await failJob(job.id, "TIMEOUT");
      job.status = "FAILED";
    }
    if (job.status === "DONE") await prisma.tvFactoryItem.update({ where: { id: it.id }, data: { status: "READY" } });
    if (job.status === "FAILED") await prisma.tvFactoryItem.update({ where: { id: it.id }, data: { status: "FAILED" } });
  }
}

/** A filmed idea goes on the channel as an approved clip (and into the rest of today's schedule). */
export async function airIdea(itemId: string) {
  const it = await prisma.tvFactoryItem.findUnique({ where: { id: itemId } });
  const job = it?.jobId ? await prisma.generationJob.findUnique({ where: { id: it.jobId } }) : null;
  if (!it || it.status !== "READY" || !job?.resultUrl) throw new TvError("STATE");
  const durationSec = Math.max(5, Math.ceil(await fileDuration(job.resultUrl)) || job.durationSec);
  const clip = await prisma.tvClip.create({
    data: { channelId: it.channelId, kind: it.kind, title: it.title, videoUrl: job.resultUrl, durationSec, orientation: job.orientation, status: "APPROVED" },
  });
  await prisma.tvFactoryItem.update({ where: { id: it.id }, data: { status: "ADDED", clipId: clip.id } });
  await rebuildRestOfDay(it.channelId).catch(() => {});
  return clip;
}

export async function factoryPreviewRef(itemId: string) {
  const it = await prisma.tvFactoryItem.findUnique({ where: { id: itemId } });
  const job = it?.jobId ? await prisma.generationJob.findUnique({ where: { id: it.jobId } }) : null;
  return job?.resultUrl ?? null;
}

// ───────────── chat moderation ─────────────

/** hours = null → muted forever (until an admin unmutes). */
export async function muteUser(userId: string, hours: number | null) {
  const until = hours == null ? new Date("9999-12-31T00:00:00Z") : hours <= 0 ? null : new Date(Date.now() + hours * 3600_000);
  await prisma.user.update({ where: { id: userId }, data: { tvMutedUntil: until } });
}

export async function muteFromMessage(messageId: string, hours = 24) {
  const m = await prisma.tvMessage.findUnique({ where: { id: messageId } });
  if (!m) throw new TvError("NOT_FOUND");
  await muteUser(m.userId, hours);
  await prisma.tvMessage.update({ where: { id: m.id }, data: { hidden: true } });
  return m.userId;
}

export async function mutedUsers() {
  return prisma.user.findMany({ where: { tvMutedUntil: { gt: new Date() } }, select: { id: true, name: true, email: true, tvMutedUntil: true }, orderBy: { tvMutedUntil: "desc" }, take: 50 });
}
