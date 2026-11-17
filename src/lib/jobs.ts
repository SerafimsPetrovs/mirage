import "server-only";
import { prisma } from "./db";

/**
 * Tiny DB-backed job queue: heavy work (music video rendering, AI clip generation) runs in the background
 * instead of inside a request. One worker loop per server process, one job at a time (the box is small).
 *
 * - enqueue() stores a job and pokes the worker;
 * - the worker claims a job with a conditional update (safe with several processes);
 * - a RUNNING job whose worker died (restart, crash) is retried after JOB_STALE_MS, up to JOB_MAX_ATTEMPTS.
 */
export const JOB_STALE_MS = 30 * 60_000;
export const JOB_MAX_ATTEMPTS = 3;
const IDLE_MS = 5_000;

type Handler = (payload: Record<string, unknown>, job: { id: string; attempts: number }) => Promise<void>;
const handlers = new Map<string, Handler>();

export function registerJob(kind: string, handler: Handler) {
  handlers.set(kind, handler);
}

export async function enqueue(kind: string, payload: Record<string, unknown>, runAt = new Date()) {
  const job = await prisma.job.create({ data: { kind, payload: JSON.stringify(payload), runAt } });
  poke();
  return job;
}

/** Claims and runs at most one due job. Returns true when a job ran. Exported for tests and scripts. */
export async function runOneJob(now = new Date()): Promise<boolean> {
  const stale = new Date(now.getTime() - JOB_STALE_MS);
  const candidate = await prisma.job.findFirst({
    where: {
      kind: { in: [...handlers.keys()] },
      OR: [
        { status: "QUEUED", runAt: { lte: now } },
        { status: "RUNNING", startedAt: { lt: stale } },
      ],
    },
    orderBy: { runAt: "asc" },
  });
  if (!candidate) return false;
  const claimed = await prisma.job.updateMany({
    where: { id: candidate.id, status: candidate.status, startedAt: candidate.startedAt },
    data: { status: "RUNNING", startedAt: now, attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) return true; // someone else took it; look again
  const attempts = candidate.attempts + 1;
  if (attempts > JOB_MAX_ATTEMPTS) {
    await prisma.job.update({ where: { id: candidate.id }, data: { status: "FAILED", finishedAt: new Date(), error: "too many attempts" } });
    return true;
  }
  const handler = handlers.get(candidate.kind)!;
  try {
    await handler(JSON.parse(candidate.payload) as Record<string, unknown>, { id: candidate.id, attempts });
    await prisma.job.update({ where: { id: candidate.id }, data: { status: "DONE", finishedAt: new Date() } });
  } catch (e) {
    console.error(`[job ${candidate.kind}]`, candidate.id, e);
    await prisma.job.update({
      where: { id: candidate.id },
      data: { status: "FAILED", finishedAt: new Date(), error: (e instanceof Error ? e.message : String(e)).slice(0, 500) },
    });
  }
  return true;
}

// ---------------------------------------------------------------- worker loop

const g = globalThis as unknown as { __mirageWorker?: { busy: boolean; timer: ReturnType<typeof setTimeout> | null; started: boolean } };
const w = (g.__mirageWorker ??= { busy: false, timer: null, started: false });

async function loop() {
  if (w.busy) return;
  w.busy = true;
  try {
    while (await runOneJob()) {
      /* drain */
    }
  } catch (e) {
    console.error("[jobs] worker", e);
  } finally {
    w.busy = false;
    if (w.started) {
      if (w.timer) clearTimeout(w.timer);
      w.timer = setTimeout(loop, IDLE_MS);
    }
  }
}

/** Wakes the worker right away (after enqueue). No-op when the worker is not started (tests). */
export function poke() {
  if (w.started && !w.busy) {
    if (w.timer) clearTimeout(w.timer);
    w.timer = setTimeout(loop, 0);
  }
}

/** Called once from instrumentation on server start. */
export function startWorker() {
  if (w.started || process.env.JOBS_DISABLED === "1") return;
  w.started = true;
  w.timer = setTimeout(loop, 2_000);
}
