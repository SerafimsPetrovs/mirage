/** Procedural "mirage" poster art. Deterministic per seed. No text — titles are rendered in HTML. */

function rng(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const MOTIFS = ["city", "mountains", "palace", "waves", "forest", "dunes"] as const;
export type Motif = (typeof MOTIFS)[number];

function ridge(r: () => number, w: number, baseY: number, amp: number, steps: number, jag = false) {
  let d = `M0 ${baseY}`;
  for (let i = 0; i <= steps; i++) {
    const x = (w / steps) * i;
    const y = baseY - r() * amp;
    d += jag ? ` L${x.toFixed(1)} ${y.toFixed(1)}` : ` Q${(x - w / steps / 2).toFixed(1)} ${(y - amp * 0.3).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

function city(r: () => number, w: number, baseY: number, maxH: number) {
  let x = -10;
  let d = `M0 ${baseY}`;
  while (x < w + 10) {
    const bw = 18 + r() * 46;
    const bh = maxH * (0.25 + r() * 0.75);
    d += ` L${x.toFixed(1)} ${(baseY - bh).toFixed(1)}`;
    if (r() > 0.75) d += ` L${(x + bw / 2).toFixed(1)} ${(baseY - bh - 14 - r() * 30).toFixed(1)}`;
    d += ` L${(x + bw).toFixed(1)} ${(baseY - bh).toFixed(1)} L${(x + bw).toFixed(1)} ${baseY}`;
    x += bw + r() * 6;
  }
  return d + ` L${w} ${baseY} L${w} 9999 L0 9999 Z`;
}

function palace(cx: number, baseY: number, s: number) {
  // Tiered pagoda silhouette
  let d = "";
  let y = baseY;
  let width = 220 * s;
  for (let i = 0; i < 4; i++) {
    const h = 34 * s;
    d += `M${cx - width / 2} ${y} L${cx + width / 2} ${y} L${cx + width / 2 - 10 * s} ${y - h} L${cx + width / 2 + 18 * s} ${y - h - 6 * s} Q${cx} ${y - h - 30 * s} ${cx - width / 2 - 18 * s} ${y - h - 6 * s} L${cx - width / 2 + 10 * s} ${y - h} Z `;
    y -= h + 14 * s;
    width *= 0.74;
  }
  d += `M${cx - 3 * s} ${y + 8 * s} L${cx} ${y - 40 * s} L${cx + 3 * s} ${y + 8 * s} Z`;
  return d;
}

function figure(x: number, baseY: number, s: number) {
  // Standing silhouette with long coat
  const h = 120 * s;
  return `M${x} ${baseY - h} a${9 * s} ${10 * s} 0 1 1 0.1 0 Z M${x - 13 * s} ${baseY - h + 22 * s} Q${x} ${baseY - h + 14 * s} ${x + 13 * s} ${baseY - h + 22 * s} L${x + 20 * s} ${baseY} L${x - 20 * s} ${baseY} Z`;
}

export function posterSvg(seed: string, hue: number, orientation: "v" | "h" = "v") {
  const r = rng(seed);
  const w = orientation === "v" ? 600 : 1280;
  const h = orientation === "v" ? 900 : 720;
  const motif = MOTIFS[Math.floor(r() * MOTIFS.length)];
  const hue2 = (hue + 40 + r() * 80) % 360;
  const hue3 = (hue + 200 + r() * 40) % 360;
  const sunX = w * (0.25 + r() * 0.5);
  const sunY = h * (orientation === "v" ? 0.3 + r() * 0.15 : 0.32 + r() * 0.1);
  const sunR = (orientation === "v" ? 90 : 120) + r() * 70;
  const horizon = h * (orientation === "v" ? 0.62 : 0.66);

  const stars = Array.from({ length: 40 }, () => {
    const x = r() * w, y = r() * horizon * 0.7, rad = r() * 1.4 + 0.3;
    return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rad.toFixed(1)}" fill="#fff" opacity="${(0.2 + r() * 0.6).toFixed(2)}"/>`;
  }).join("");

  const layers: string[] = [];
  const layerCount = 3;
  for (let i = 0; i < layerCount; i++) {
    const t = i / (layerCount - 1);
    const y = horizon + t * h * 0.16;
    const light = 22 - t * 18;
    const fill = `hsl(${(hue + t * 20) % 360} ${55 - t * 25}% ${light}%)`;
    let d: string;
    if (motif === "city") d = city(r, w, y + 20, h * (0.28 - t * 0.08));
    else if (motif === "mountains") d = ridge(r, w, y, h * (0.3 - t * 0.08), 7 + i * 3, true) + ` L${w} ${h} L0 ${h} Z`;
    else if (motif === "dunes") d = ridge(r, w, y, h * (0.12 - t * 0.03), 3 + i, false) + ` L${w} ${h} L0 ${h} Z`;
    else if (motif === "waves") d = ridge(r, w, y + 10, h * 0.04, 12 + i * 4, false) + ` L${w} ${h} L0 ${h} Z`;
    else if (motif === "forest") {
      d = `M0 ${h} L0 ${y}`;
      for (let x = 0; x <= w; x += 14 + r() * 18) d += ` L${x} ${y - r() * h * (0.18 - t * 0.05) - 20} L${x + 8} ${y}`;
      d += ` L${w} ${y} L${w} ${h} Z`;
    } else d = ridge(r, w, y, h * (0.1 - t * 0.02), 5, false) + ` L${w} ${h} L0 ${h} Z`;
    layers.push(`<path d="${d}" fill="${fill}" opacity="${(0.75 + t * 0.25).toFixed(2)}"/>`);
    if (i === 0) layers.push(`<rect y="${y - 30}" width="${w}" height="60" fill="url(#haze)" opacity=".6"/>`);
  }

  const extra: string[] = [];
  if (motif === "palace") extra.push(`<path d="${palace(w * (0.35 + r() * 0.3), horizon + h * 0.08, orientation === "v" ? 1 : 1.2)}" fill="hsl(${hue} 50% 6%)"/>`);
  const figs = 1 + Math.floor(r() * 2);
  const fs = orientation === "v" ? 1.25 : 1.1;
  const fx = w * (0.4 + r() * 0.2);
  for (let i = 0; i < figs; i++) extra.push(`<path d="${figure(fx + i * 46 * fs, h * 0.93, fs * (1 - i * 0.08))}" fill="#050308"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="hsl(${hue3} 60% 6%)"/>
<stop offset=".45" stop-color="hsl(${hue} 70% 22%)"/>
<stop offset=".7" stop-color="hsl(${hue2} 85% 52%)"/>
<stop offset="1" stop-color="hsl(${hue} 60% 10%)"/>
</linearGradient>
<radialGradient id="sun"><stop offset="0" stop-color="hsl(${hue2} 100% 92%)"/><stop offset=".35" stop-color="hsl(${hue2} 95% 70%)"/><stop offset=".7" stop-color="hsl(${hue} 90% 55%)" stop-opacity=".35"/><stop offset="1" stop-color="hsl(${hue} 90% 50%)" stop-opacity="0"/></radialGradient>
<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue2} 90% 70%)" stop-opacity="0"/><stop offset=".5" stop-color="hsl(${hue2} 90% 75%)" stop-opacity=".55"/><stop offset="1" stop-color="hsl(${hue2} 90% 70%)" stop-opacity="0"/></linearGradient>
<radialGradient id="vig" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></radialGradient>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .09 0"/></filter>
<filter id="blur"><feGaussianBlur stdDeviation="24"/></filter>
</defs>
<rect width="${w}" height="${h}" fill="url(#sky)"/>
${stars}
<circle cx="${sunX}" cy="${sunY}" r="${sunR * 2.2}" fill="url(#sun)" opacity=".55" filter="url(#blur)"/>
<circle cx="${sunX}" cy="${sunY}" r="${sunR}" fill="url(#sun)"/>
${Array.from({ length: 3 }, (_, i) => `<rect x="0" y="${(sunY + sunR * (0.2 + i * 0.25)).toFixed(0)}" width="${w}" height="${4 + i * 3}" fill="hsl(${hue} 60% 14%)" opacity="${0.5 - i * 0.1}"/>`).join("")}
${layers.join("\n")}
${extra.join("\n")}
<rect width="${w}" height="${h}" fill="url(#vig)"/>
<rect width="${w}" height="${h}" filter="url(#grain)"/>
</svg>`;
}

export function posterUrl(series: { slug: string; hue: number; posterUrl?: string | null }) {
  return series.posterUrl || `/api/poster/${encodeURIComponent(series.slug)}?h=${series.hue}&o=v`;
}

export function backdropUrl(series: { slug: string; hue: number; backdropUrl?: string | null; posterUrl?: string | null }) {
  return series.backdropUrl || `/api/poster/${encodeURIComponent(series.slug)}?h=${series.hue}&o=h`;
}
