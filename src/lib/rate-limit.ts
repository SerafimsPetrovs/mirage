// In-memory sliding-window rate limiter (one Node process). For several instances behind a load balancer
// move the buckets to Redis/Postgres — the interface stays the same.

type Bucket = number[];
const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) if (!b.length || now - b[b.length - 1] > 24 * 3600_000) buckets.delete(k);
}

/**
 * Records a hit for `key` and tells whether it is still within `limit` hits per `windowMs`.
 * Use `peek` to check without recording (e.g. count only failures).
 */
export function rateLimit(key: string, limit: number, windowMs: number, opts: { peek?: boolean; now?: number } = {}) {
  const now = opts.now ?? Date.now();
  sweep(now);
  const b = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  const allowed = b.length < limit;
  if (!opts.peek && allowed) b.push(now);
  buckets.set(key, b);
  return { allowed, remaining: Math.max(0, limit - b.length), retryAfterMs: allowed || !b.length ? 0 : windowMs - (now - b[0]) };
}

/** Records a hit even when over the limit (failed attempts keep counting). */
export function hit(key: string, now = Date.now()) {
  const b = buckets.get(key) ?? [];
  b.push(now);
  buckets.set(key, b);
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

/** Best-effort client IP behind a proxy (first X-Forwarded-For hop), for rate-limit keys only. */
export function clientIp(h: Headers) {
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim().slice(0, 64);
}

export const LIMITS = {
  /** Failed logins per email (and per IP) per 15 minutes. */
  login: { limit: 8, windowMs: 15 * 60_000 },
  /** Sign-ups per IP per hour. */
  register: { limit: 5, windowMs: 3600_000 },
  /** Password-reset requests per IP per hour. */
  forgot: { limit: 5, windowMs: 3600_000 },
  /** Failed promo-code attempts per user per hour (stops guessing codes). */
  promo: { limit: 10, windowMs: 3600_000 },
  /** Content reports per user per hour. */
  report: { limit: 20, windowMs: 3600_000 },
  /** Public copyright notices per IP per hour. */
  copyright: { limit: 5, windowMs: 3600_000 },
  /** Comments per user per minute (anti-spam). */
  comment: { limit: 6, windowMs: 60_000 },
} as const;
