import "server-only";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

export const STORAGE_DIR = path.join(process.cwd(), "storage");
const PUBLIC_DIR = path.join(process.cwd(), "public");
const DEMO_DIR = path.join(process.cwd(), "media", "demo");

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m3u8": "application/vnd.apple.mpegurl",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
};

export function mimeOf(file: string) {
  return MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}

/** Resolves a stored media reference to an absolute path, guarding against traversal. */
export function resolveMediaPath(ref: string): string | null {
  let base: string, rel: string;
  if (ref.startsWith("storage:")) {
    base = STORAGE_DIR;
    rel = ref.slice("storage:".length);
  } else if (ref.startsWith("demo:")) {
    base = DEMO_DIR;
    rel = ref.slice("demo:".length);
  } else if (ref.startsWith("/")) {
    base = PUBLIC_DIR;
    rel = ref.slice(1);
  } else return null;
  const full = path.resolve(base, rel);
  if (!full.startsWith(base + path.sep)) return null;
  return fs.existsSync(/*turbopackIgnore: true*/ full) ? full : null;
}

/** Serves a file with HTTP Range support (needed for video seeking). */
export function serveFile(full: string, req: Request, extraHeaders: Record<string, string> = {}) {
  const stat = fs.statSync(/*turbopackIgnore: true*/ full);
  const type = mimeOf(full);
  const range = req.headers.get("range");
  const base = { "Content-Type": type, "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff", ...extraHeaders };
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
    if (m && !m[1] && m[2]) {
      start = Math.max(0, stat.size - parseInt(m[2], 10));
      end = stat.size - 1;
    }
    end = Math.min(end, stat.size - 1);
    if (start > end || start >= stat.size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
    }
    const stream = Readable.toWeb(fs.createReadStream(/*turbopackIgnore: true*/ full, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...base, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": String(end - start + 1) },
    });
  }
  const stream = Readable.toWeb(fs.createReadStream(/*turbopackIgnore: true*/ full)) as ReadableStream;
  return new Response(stream, { headers: { ...base, "Content-Length": String(stat.size) } });
}

const VIDEO_EXT = new Set([".mp4", ".webm", ".mov"]);
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);

/**
 * Checks the file's real content by its magic bytes (the extension alone is attacker-controlled:
 * an HTML/SVG/script renamed to .png must not land in storage).
 */
export function sniffMedia(head: Uint8Array, kind: "video" | "image"): boolean {
  const b = (i: number) => head[i] ?? -1;
  const ascii = (from: number, s: string) => [...s].every((c, i) => b(from + i) === c.charCodeAt(0));
  if (kind === "image") {
    return (
      (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) || // JPEG
      (b(0) === 0x89 && ascii(1, "PNG")) || // PNG
      ascii(0, "GIF8") || // GIF
      (ascii(0, "RIFF") && ascii(8, "WEBP")) || // WebP
      (ascii(4, "ftyp") && (ascii(8, "avif") || ascii(8, "avis"))) // AVIF
    );
  }
  return ascii(4, "ftyp") || (b(0) === 0x1a && b(1) === 0x45 && b(2) === 0xdf && b(3) === 0xa3); // MP4/MOV, WebM
}

/** kind "private" = images served only through access-checked routes (character photos). */
export async function saveUpload(file: File, kind: "video" | "image" | "private", maxBytes: number) {
  const ext = path.extname(file.name).toLowerCase();
  const allowed = kind === "video" ? VIDEO_EXT : IMAGE_EXT;
  if (!allowed.has(ext)) throw new Error("BAD_FILE_TYPE");
  if (file.size > maxBytes) throw new Error("FILE_TOO_LARGE");
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!sniffMedia(head, kind === "video" ? "video" : "image")) throw new Error("BAD_FILE_TYPE");
  const folder = kind === "video" ? "videos" : kind === "private" ? "private" : "images";
  const dir = path.join(STORAGE_DIR, folder);
  fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
  const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${ext}`;
  const target = path.join(dir, name);
  await fs.promises.writeFile(/*turbopackIgnore: true*/ target, Readable.fromWeb(file.stream() as import("stream/web").ReadableStream));
  return `storage:${folder}/${name}`;
}

/** Public URL for an image ref (storage refs go through /api/media). */
export function mediaUrl(ref: string | null | undefined) {
  if (!ref) return null;
  if (ref.startsWith("storage:images/")) return `/api/media/${ref.slice("storage:".length)}`;
  return ref;
}
