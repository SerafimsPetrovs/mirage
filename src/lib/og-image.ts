import "server-only";
import sharp from "sharp";
import { posterSvg } from "./poster";
import { resolveMediaPath } from "./files";

/** Link-preview card size recommended by Telegram, Facebook, X, WhatsApp, VK. */
export const OG_W = 1200;
export const OG_H = 630;

const esc = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);

/** Greedy word wrap by an approximate character budget (no font metrics on the server). */
export function wrapLines(text: string, maxChars: number, maxLines: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/[\s,.;:!?-]*$/, "").slice(0, maxChars - 1) + "…";
    return kept;
  }
  return lines;
}

const FONT = "'Segoe UI', 'Helvetica Neue', Arial, 'DejaVu Sans', sans-serif";

function overlaySvg(o: { title: string; tagline: string; meta: string; badge: string }) {
  const titleLines = wrapLines(o.title, o.title.length > 28 ? 22 : 18, 3);
  const size = titleLines.length > 2 ? 64 : 78;
  const tagLines = wrapLines(o.tagline, 46, 2);
  const titleTop = 250 - (titleLines.length - 1) * size * 0.45;
  const title = titleLines
    .map((l, i) => `<text x="72" y="${titleTop + i * size * 1.08}" font-size="${size}" font-weight="800" fill="#fff">${esc(l)}</text>`)
    .join("");
  const tagTop = titleTop + titleLines.length * size * 1.08 + 18;
  const tag = tagLines.map((l, i) => `<text x="72" y="${tagTop + i * 38}" font-size="30" fill="#e6e6f0" fill-opacity=".9">${esc(l)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}" font-family="${FONT}">
  <defs>
    <linearGradient id="fade" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#07070b" stop-opacity=".96"/>
      <stop offset=".55" stop-color="#07070b" stop-opacity=".72"/>
      <stop offset="1" stop-color="#07070b" stop-opacity=".05"/>
    </linearGradient>
    <linearGradient id="bottom" x1="0" x2="0" y1="0" y2="1">
      <stop offset=".6" stop-color="#07070b" stop-opacity="0"/>
      <stop offset="1" stop-color="#07070b" stop-opacity=".85"/>
    </linearGradient>
    <linearGradient id="brand" x1="0" x2="1">
      <stop offset="0" stop-color="#7c5cff"/><stop offset=".5" stop-color="#ff2e63"/><stop offset="1" stop-color="#ffb547"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#fade)"/>
  <rect width="100%" height="100%" fill="url(#bottom)"/>
  <text x="72" y="104" font-size="40" font-weight="900" letter-spacing="6" fill="url(#brand)">MIRAGE</text>
  ${o.badge ? `<rect x="300" y="72" rx="18" width="${o.badge.length * 13 + 36}" height="42" fill="#ffffff" fill-opacity=".14"/><text x="318" y="101" font-size="22" font-weight="700" fill="#fff">${esc(o.badge)}</text>` : ""}
  ${title}
  ${tag}
  <rect x="72" y="${OG_H - 92}" width="6" height="34" rx="3" fill="#ff2e63"/>
  <text x="92" y="${OG_H - 66}" font-size="26" font-weight="600" fill="#fff" fill-opacity=".92">${esc(o.meta)}</text>
</svg>`;
}

/** Background: the uploaded backdrop/poster if there is one, otherwise the procedural poster art. */
async function background(series: { slug: string; hue: number; backdropUrl?: string | null; posterUrl?: string | null } | null) {
  const ref = series?.backdropUrl || series?.posterUrl;
  const file = ref ? resolveMediaPath(ref) : null;
  const src = file ?? Buffer.from(posterSvg(series?.slug ?? "mirage-platform", series?.hue ?? 330, "h"));
  try {
    return await sharp(src).resize(OG_W, OG_H, { fit: "cover", position: "attention" }).toBuffer();
  } catch {
    return await sharp(Buffer.from(posterSvg(series?.slug ?? "mirage", series?.hue ?? 330, "h"))).resize(OG_W, OG_H, { fit: "cover" }).toBuffer();
  }
}

export async function renderOgImage(o: {
  series: { slug: string; hue: number; backdropUrl?: string | null; posterUrl?: string | null } | null;
  title: string;
  tagline: string;
  meta: string;
  badge?: string;
}) {
  const bg = await background(o.series);
  return sharp(bg)
    .composite([{ input: Buffer.from(overlaySvg({ title: o.title, tagline: o.tagline, meta: o.meta, badge: o.badge ?? "" })) }])
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
}
