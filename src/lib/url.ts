/**
 * Returns `next` only if it's a same-origin absolute path; otherwise the fallback.
 * Blocks `//host`, `/\host` and control characters / whitespace (browsers strip tabs and newlines,
 * so `/\t/evil.com` would otherwise become `//evil.com`).
 */
export function safePath(next: unknown, fallback = "/") {
  if (typeof next !== "string" || next.length > 2000) return fallback;
  if (/[\u0000-\u001f\u007f\s]/.test(next)) return fallback;
  return /^\/(?![/\\])/.test(next) ? next : fallback;
}

/**
 * Origin used for links in emails. Never derived from the request's Host header in production
 * (Host-header injection would let an attacker point password-reset links to their own domain).
 */
export function mailOrigin(appUrl: string | undefined, nodeEnv: string | undefined, host: string | null, consoleMail = false) {
  if (appUrl) return appUrl.replace(/\/$/, "");
  // Real mail in production without APP_URL is refused. Console mail (local `npm start`) never leaves
  // the machine, so a localhost link is safe there.
  if (nodeEnv === "production" && !consoleMail) throw new Error("APP_URL is not set");
  return host && /^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(host) ? `http://${host}` : "http://localhost:3000";
}
