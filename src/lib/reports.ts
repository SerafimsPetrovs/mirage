import "server-only";
import { prisma } from "./db";
import { logAdmin } from "./admin-log";

export const REPORT_REASONS = ["spam", "abuse", "sexual", "minors", "violence", "copyright", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_TARGETS = ["SERIES", "COMMENT", "CHARACTER"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];
/** A comment is hidden automatically once this many different people report it. */
export const COMMENT_AUTOHIDE = 3;
export const REPORT_DETAILS_MAX = 1000;
/** Reasons that jump to the top of the moderation queue. */
export const URGENT_REASONS: ReportReason[] = ["minors", "violence"];

export const RESOLVE_ACTIONS = ["dismiss", "hide", "unpublish", "ban"] as const;
export type ResolveAction = (typeof RESOLVE_ACTIONS)[number];

export class ReportError extends Error {
  constructor(public code: "NOT_FOUND" | "DUPLICATE" | "OWN" | "BAD_ACTION") {
    super(code);
  }
}

async function targetOwner(type: ReportTarget | "URL", id: string): Promise<string | null | undefined> {
  if (type === "SERIES") return (await prisma.series.findUnique({ where: { id }, select: { creatorId: true } }))?.creatorId;
  if (type === "COMMENT") return (await prisma.comment.findUnique({ where: { id }, select: { userId: true } }))?.userId;
  if (type === "CHARACTER") {
    return (await prisma.character.findUnique({ where: { id }, select: { series: { select: { creatorId: true } } } }))?.series.creatorId;
  }
  return null;
}

/** A signed-in viewer reports content. One report per person per target. */
export async function createReport(userId: string, input: { targetType: ReportTarget; targetId: string; reason: ReportReason; details: string }) {
  const owner = await targetOwner(input.targetType, input.targetId);
  if (owner === undefined) throw new ReportError("NOT_FOUND");
  if (owner === userId) throw new ReportError("OWN");
  const dup = await prisma.report.findUnique({
    where: { reporterId_targetType_targetId: { reporterId: userId, targetType: input.targetType, targetId: input.targetId } },
  });
  if (dup) throw new ReportError("DUPLICATE");
  const report = await prisma.report.create({
    data: { reporterId: userId, targetType: input.targetType, targetId: input.targetId, reason: input.reason, details: input.details.slice(0, REPORT_DETAILS_MAX) },
  });
  if (input.targetType === "COMMENT") {
    const n = await prisma.report.count({ where: { targetType: "COMMENT", targetId: input.targetId, status: "OPEN" } });
    if (n >= COMMENT_AUTOHIDE) await prisma.comment.update({ where: { id: input.targetId }, data: { hidden: true } });
  }
  return report;
}

/** Copyright / takedown notice from the public form (no account needed). */
export async function createCopyrightNotice(input: { url: string; email: string; name: string; details: string }) {
  return prisma.report.create({
    data: {
      reporterId: null,
      targetType: "URL",
      targetId: input.url,
      reason: "copyright",
      contactEmail: input.email,
      details: `${input.name}\n\n${input.details}`.slice(0, REPORT_DETAILS_MAX + 100),
    },
  });
}

/** Open reports grouped by target, urgent reasons and most-reported first. */
export async function getReportQueue() {
  const open = await prisma.report.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    take: 500,
    include: { reporter: { select: { name: true, email: true } } },
  });
  const groups = new Map<string, { targetType: string; targetId: string; reports: typeof open }>();
  for (const r of open) {
    const key = `${r.targetType}:${r.targetId}`;
    const g = groups.get(key) ?? { targetType: r.targetType, targetId: r.targetId, reports: [] };
    g.reports.push(r);
    groups.set(key, g);
  }
  const urgent = (g: { reports: typeof open }) => g.reports.some((r) => URGENT_REASONS.includes(r.reason as ReportReason));
  return [...groups.values()].sort((a, b) => Number(urgent(b)) - Number(urgent(a)) || b.reports.length - a.reports.length);
}

/**
 * Closes every open report on a target and applies the decision:
 * hide (comment only), unpublish (series of the series/character → DRAFT),
 * ban (author of the content), dismiss (nothing).
 */
export async function resolveReports(adminId: string, targetType: string, targetId: string, action: ResolveAction) {
  if (!RESOLVE_ACTIONS.includes(action)) throw new ReportError("BAD_ACTION");
  if (action !== "dismiss") {
    if (targetType === "URL") throw new ReportError("BAD_ACTION");
    const owner = await targetOwner(targetType as ReportTarget, targetId);
    if (owner === undefined) throw new ReportError("NOT_FOUND");
    if (action === "hide") {
      // only comments can be hidden one by one; series/characters are taken down via "unpublish"
      if (targetType !== "COMMENT") throw new ReportError("BAD_ACTION");
      await prisma.comment.update({ where: { id: targetId }, data: { hidden: true } });
    } else if (action === "unpublish") {
      // never delete content on a complaint: buyers keep their unlocks, the creator can appeal
      const seriesId =
        targetType === "SERIES"
          ? targetId
          : targetType === "CHARACTER"
            ? (await prisma.character.findUnique({ where: { id: targetId }, select: { seriesId: true } }))?.seriesId
            : null;
      if (!seriesId) throw new ReportError("BAD_ACTION");
      await prisma.series.update({ where: { id: seriesId }, data: { status: "DRAFT" } });
    } else if (action === "ban") {
      if (!owner || owner === adminId) throw new ReportError("BAD_ACTION");
      await prisma.user.update({ where: { id: owner }, data: { banned: true } });
      await prisma.session.deleteMany({ where: { userId: owner } });
      if (targetType === "COMMENT") await prisma.comment.update({ where: { id: targetId }, data: { hidden: true } });
    }
  }
  const { count } = await prisma.report.updateMany({
    where: { targetType, targetId, status: "OPEN" },
    data: { status: action === "dismiss" ? "DISMISSED" : "RESOLVED", resolution: action, resolvedById: adminId, resolvedAt: new Date() },
  });
  await logAdmin(adminId, `report.${action}`, targetType.toLowerCase(), targetId, { reports: count });
  return count;
}
