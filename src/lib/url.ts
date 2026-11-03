/** Returns `next` only if it's a same-origin absolute path; otherwise the fallback. Blocks `//host` and `/\host`. */
export function safePath(next: unknown, fallback = "/") {
  return typeof next === "string" && /^\/(?![/\\])/.test(next) ? next : fallback;
}
