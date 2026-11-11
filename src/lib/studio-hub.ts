import "server-only";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { pick, type Locale } from "@/i18n/shared";
import { normalizeText } from "./tv-rules";

type Creator = { id: string; role: string };

// ───────────── works registry ─────────────

export type WorkStatus =
  | { kind: "MODERATION" }
  | { kind: "QUEUED"; at: number }
  | { kind: "ROTATION"; plays: number }
  | { kind: "APPROVED" }
  | { kind: "REJECTED"; reason?: string | null }
  | { kind: "PUBLISHED"; episodes: number; scheduled: number }
  | { kind: "DRAFT" };

export type WorkRow = { id: string; type: "SERIES" | "CLIP"; title: string; sub: string; href: string | null; status: WorkStatus; createdAt: number };

/** Everything the creator ever put into the pool or the catalog, with a human status. */
export async function worksRegistry(user: Creator, locale: Locale, now = new Date()): Promise<WorkRow[]> {
  const [series, clips] = await Promise.all([
    prisma.series.findMany({
      where: { creatorId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, slug: true, titleRu: true, titleEn: true, status: true, rejectReason: true, createdAt: true, episodes: { select: { publishAt: true } } },
    }),
    prisma.tvClip.findMany({
      where: { creatorId: user.id, sponsorName: null },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { channel: { select: { nameRu: true, nameEn: true } }, slots: { where: { startsAt: { gt: now } }, orderBy: { startsAt: "asc" }, take: 1, select: { startsAt: true } } },
    }),
  ]);
  const endOfDay = new Date(now);
  endOfDay.setUTCHours(23, 59, 59, 999);
  const rows: WorkRow[] = [
    ...series.map((s): WorkRow => {
      const scheduled = s.episodes.filter((e) => e.publishAt && e.publishAt > now).length;
      const status: WorkStatus =
        s.status === "PUBLISHED"
          ? { kind: "PUBLISHED", episodes: s.episodes.length - scheduled, scheduled }
          : s.status === "PENDING"
            ? { kind: "MODERATION" }
            : s.status === "REJECTED"
              ? { kind: "REJECTED", reason: s.rejectReason }
              : { kind: "DRAFT" };
      return { id: s.id, type: "SERIES", title: pick(s, "title", locale), sub: "", href: `/studio/series/${s.id}`, status, createdAt: s.createdAt.getTime() };
    }),
    ...clips.map((c): WorkRow => {
      const next = c.slots[0]?.startsAt;
      const status: WorkStatus =
        c.status === "PENDING"
          ? { kind: "MODERATION" }
          : c.status === "REJECTED"
            ? { kind: "REJECTED" }
            : next && next <= endOfDay
              ? { kind: "QUEUED", at: next.getTime() }
              : c.plays > 0
                ? { kind: "ROTATION", plays: c.plays }
                : { kind: "APPROVED" };
      return { id: c.id, type: "CLIP", title: c.artist ? `${c.artist} — ${c.title}` : c.title, sub: pick(c.channel, "name", locale), href: null, status, createdAt: c.createdAt.getTime() };
    }),
  ];
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

// ───────────── release scheduler ─────────────

export async function releaseCalendar(user: Creator, locale: Locale) {
  const series = await prisma.series.findMany({
    where: { creatorId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, titleRu: true, titleEn: true, hue: true, episodes: { orderBy: { number: "asc" }, select: { id: true, number: true, titleRu: true, titleEn: true, publishAt: true } } },
  });
  return series.map((s) => ({
    id: s.id,
    title: pick(s, "title", locale),
    hue: s.hue,
    episodes: s.episodes.map((e) => ({ id: e.id, number: e.number, title: pick(e, "title", locale), publishAt: e.publishAt?.getTime() ?? null })),
  }));
}

export class HubError extends Error {
  constructor(public code: "NOT_FOUND" | "PAST" | "INVALID" | "USED" | "OWN" | "LIMIT") {
    super(code);
  }
}

/** Plans (or clears) the release moment of one of the creator's episodes. Only future moments. */
export async function setEpisodeRelease(user: Creator, episodeId: string, at: Date | null, now = new Date()) {
  const ep = await prisma.episode.findUnique({ where: { id: episodeId }, select: { id: true, series: { select: { creatorId: true } } } });
  if (!ep || (ep.series.creatorId !== user.id && user.role !== "ADMIN")) throw new HubError("NOT_FOUND");
  if (at && (!Number.isFinite(at.getTime()) || at <= now)) throw new HubError("PAST");
  if (at && at.getTime() - now.getTime() > 366 * 86400_000) throw new HubError("INVALID");
  await prisma.episode.update({ where: { id: ep.id }, data: { publishAt: at } });
}

// ───────────── task planner ─────────────

export const TASK_STATUSES = ["TODO", "DOING", "DONE"] as const;
export type Check = { t: string; done: boolean };
export const DEFAULT_CHECKLIST = ["script", "storyboard", "generation", "voice", "edit", "upload"];

export function parseChecklist(raw: string): Check[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x?.t === "string").map((x) => ({ t: String(x.t).slice(0, 80), done: !!x.done })).slice(0, 20) : [];
  } catch {
    return [];
  }
}

export async function listTasks(user: Creator) {
  const rows = await prisma.creatorTask.findMany({ where: { creatorId: user.id }, orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }], include: { series: { select: { titleRu: true, titleEn: true } } }, take: 200 });
  return rows;
}

export async function createTask(user: Creator, input: { title: string; notes?: string; seriesId?: string | null; dueAt?: Date | null; checklist?: string[] }) {
  const title = normalizeText(input.title).slice(0, 120);
  if (title.length < 2) throw new HubError("INVALID");
  if ((await prisma.creatorTask.count({ where: { creatorId: user.id } })) >= 300) throw new HubError("LIMIT");
  let seriesId: string | null = null;
  if (input.seriesId) {
    const s = await prisma.series.findFirst({ where: { id: input.seriesId, creatorId: user.id }, select: { id: true } });
    if (!s) throw new HubError("NOT_FOUND");
    seriesId = s.id;
  }
  const checklist = (input.checklist ?? []).map((t) => ({ t: normalizeText(t).slice(0, 80), done: false })).filter((c) => c.t).slice(0, 20);
  return prisma.creatorTask.create({
    data: { creatorId: user.id, title, notes: (input.notes ?? "").slice(0, 4000), seriesId, dueAt: input.dueAt && Number.isFinite(input.dueAt.getTime()) ? input.dueAt : null, checklist: JSON.stringify(checklist) },
  });
}

export async function updateTask(user: Creator, id: string, patch: { status?: string; checklist?: Check[]; notes?: string; title?: string }) {
  const task = await prisma.creatorTask.findFirst({ where: { id, creatorId: user.id } });
  if (!task) throw new HubError("NOT_FOUND");
  const data: Prisma.CreatorTaskUpdateInput = {};
  if (patch.status && (TASK_STATUSES as readonly string[]).includes(patch.status)) data.status = patch.status;
  if (patch.checklist) data.checklist = JSON.stringify(patch.checklist.map((c) => ({ t: normalizeText(c.t).slice(0, 80), done: !!c.done })).filter((c) => c.t).slice(0, 20));
  if (patch.notes !== undefined) data.notes = patch.notes.slice(0, 4000);
  if (patch.title !== undefined) {
    const t = normalizeText(patch.title).slice(0, 120);
    if (t.length < 2) throw new HubError("INVALID");
    data.title = t;
  }
  return prisma.creatorTask.update({ where: { id }, data });
}

export async function deleteTask(user: Creator, id: string) {
  await prisma.creatorTask.deleteMany({ where: { id, creatorId: user.id } });
}

// ───────────── analytics ─────────────

/** TV views, "watch the whole series" clicks from the broadcast and money by source for the last `days`. */
export async function creatorAnalytics(user: Creator, locale: Locale, days = 30, now = new Date()) {
  const since = new Date(now.getTime() - days * 86400_000);
  const [clips, airedEpisodes, airedClips, clicks, earnings, series] = await Promise.all([
    prisma.tvClip.aggregate({ where: { creatorId: user.id }, _sum: { plays: true }, _count: true }),
    prisma.tvSlot.count({ where: { kind: "EPISODE", startsAt: { gte: since, lte: now }, episode: { series: { creatorId: user.id } } } }),
    prisma.tvSlot.count({ where: { kind: "CLIP", startsAt: { gte: since, lte: now }, clip: { creatorId: user.id } } }),
    prisma.tvFunnelClick.groupBy({ by: ["seriesId"], where: { createdAt: { gte: since }, series: { creatorId: user.id } }, _count: true }),
    prisma.creatorEarning.groupBy({ by: ["source"], where: { creatorId: user.id, createdAt: { gte: since } }, _sum: { coins: true, credits: true } }),
    prisma.series.findMany({ where: { creatorId: user.id }, select: { id: true, slug: true, titleRu: true, titleEn: true, views: true } }),
  ]);
  const clicksBy = new Map(clicks.map((c) => [c.seriesId, c._count]));
  const earnBySeries = await prisma.creatorEarning.groupBy({ by: ["seriesId"], where: { creatorId: user.id, createdAt: { gte: since }, seriesId: { not: null } }, _sum: { coins: true, credits: true } });
  const earnMap = new Map(earnBySeries.map((e) => [e.seriesId, e._sum]));
  return {
    days,
    tvPlays: clips._sum.plays ?? 0,
    clipCount: clips._count,
    airings: airedEpisodes + airedClips,
    funnelClicks: clicks.reduce((a, c) => a + c._count, 0),
    bySource: earnings.map((e) => ({ source: e.source, coins: e._sum.coins ?? 0, credits: e._sum.credits ?? 0 })).sort((a, b) => b.coins + b.credits - (a.coins + a.credits)),
    series: series
      .map((s) => ({ id: s.id, slug: s.slug, title: pick(s, "title", locale), views: s.views, clicks: clicksBy.get(s.id) ?? 0, coins: earnMap.get(s.id)?.coins ?? 0, credits: earnMap.get(s.id)?.credits ?? 0 }))
      .sort((a, b) => b.clicks - a.clicks || b.coins - a.coins),
  };
}

// ───────────── creator invites ─────────────

export const INVITES_PER_CREATOR = 5;

function newCode() {
  return crypto.randomBytes(5).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "X").slice(0, 8);
}

/** Every active creator has 5 invites (created lazily on first visit). */
export async function myInvites(user: Creator) {
  if (user.role !== "CREATOR" && user.role !== "ADMIN") return [];
  const have = await prisma.creatorInvite.count({ where: { ownerId: user.id } });
  for (let i = have; i < INVITES_PER_CREATOR; i++) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await prisma.creatorInvite.create({ data: { code: newCode(), ownerId: user.id } });
        break;
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      }
    }
  }
  return prisma.creatorInvite.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "asc" }, include: { usedBy: { select: { name: true } } } });
}

/** A viewer enters an invite code and becomes a creator right away (one code = one person). */
export async function redeemInvite(user: Creator, raw: string, now = new Date()) {
  const code = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  if (!code) throw new HubError("INVALID");
  if (user.role !== "VIEWER") throw new HubError("USED");
  await prisma.$transaction(async (tx) => {
    const inv = await tx.creatorInvite.findUnique({ where: { code } });
    if (!inv) throw new HubError("NOT_FOUND");
    if (inv.ownerId === user.id) throw new HubError("OWN");
    const r = await tx.creatorInvite.updateMany({ where: { code, usedById: null }, data: { usedById: user.id, usedAt: now } });
    if (!r.count) throw new HubError("USED");
    await tx.user.update({ where: { id: user.id }, data: { role: "CREATOR" } });
    await tx.creatorApplication.updateMany({ where: { userId: user.id, status: "PENDING" }, data: { status: "APPROVED" } });
  });
}
