"use server";
import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, LIMITS, rateLimit } from "@/lib/rate-limit";
import {
  createCopyrightNotice,
  createReport,
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  REPORT_TARGETS,
  ReportError,
  RESOLVE_ACTIONS,
  resolveReports,
} from "@/lib/reports";
import { safePath } from "@/lib/url";

type R = { ok: true } | { ok: false; error: "auth" | "kids" | "invalid" | "tooMany" | "duplicate" | "own" | "notFound" | "forbidden" | "badAction" };

function fail(e: unknown): R {
  if (e instanceof ReportError) {
    const map = { NOT_FOUND: "notFound", DUPLICATE: "duplicate", OWN: "own", BAD_ACTION: "badAction" } as const;
    return { ok: false, error: map[e.code] };
  }
  console.error(e);
  return { ok: false, error: "invalid" };
}

const reportSchema = z
  .object({
    targetType: z.enum(REPORT_TARGETS),
    targetId: z.string().min(1).max(64),
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().max(REPORT_DETAILS_MAX).default(""),
  })
  .strict();

export async function reportAction(input: unknown): Promise<R> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (user.kidsMode) return { ok: false, error: "kids" };
  const d = reportSchema.safeParse(input);
  if (!d.success) return { ok: false, error: "invalid" };
  if (!rateLimit(`report:${user.id}`, LIMITS.report.limit, LIMITS.report.windowMs).allowed) return { ok: false, error: "tooMany" };
  try {
    await createReport(user.id, d.data);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin/reports");
  return { ok: true };
}

const copyrightSchema = z
  .object({
    url: z.string().trim().min(1).max(300),
    email: z.string().trim().toLowerCase().email().max(200),
    name: z.string().trim().min(2).max(120),
    details: z.string().trim().min(20).max(REPORT_DETAILS_MAX),
    confirm: z.literal(true),
  })
  .strict();

/** Accepts a full link to our site or a path; stores only the path. */
function contentPath(raw: string): string | null {
  let path = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      path = u.pathname + u.search;
    } catch {
      return null;
    }
  }
  const safe = safePath(path, "");
  return safe && safe !== "/" ? safe : null;
}

export async function copyrightNoticeAction(input: unknown): Promise<R> {
  const d = copyrightSchema.safeParse(input);
  if (!d.success) return { ok: false, error: "invalid" };
  const path = contentPath(d.data.url);
  if (!path) return { ok: false, error: "invalid" };
  if (!rateLimit(`copyright:${clientIp(await headers())}`, LIMITS.copyright.limit, LIMITS.copyright.windowMs).allowed) {
    return { ok: false, error: "tooMany" };
  }
  await createCopyrightNotice({ ...d.data, url: path });
  revalidatePath("/admin/reports");
  return { ok: true };
}

export async function resolveReportsAction(targetType: string, targetId: string, action: string): Promise<R> {
  const me = await getCurrentUser();
  if (!me || me.kidsMode || me.role !== "ADMIN") return { ok: false, error: "forbidden" };
  if (typeof targetType !== "string" || typeof targetId !== "string" || !RESOLVE_ACTIONS.includes(action as never)) {
    return { ok: false, error: "invalid" };
  }
  try {
    await resolveReports(me.id, targetType, targetId, action as (typeof RESOLVE_ACTIONS)[number]);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
  return { ok: true };
}
