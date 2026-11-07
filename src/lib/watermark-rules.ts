// Pure logic of the forensic A/B watermark (no DB / ffmpeg — unit-tested).
//
// Every protected video exists in two HLS encodes, A and B, cut into SEG_SEC-second segments that differ
// only by an invisible, low-frequency luma pattern (+p in A, −p in B). A viewer's code (CODE_BITS bits +
// CRC_BITS check bits) decides, segment by segment, whether they get A (0) or B (1); the payload repeats
// over the whole episode. A leaked copy is matched frame-by-frame against A and B to read the bits back.

export const SEG_SEC = 2;
export const CODE_BITS = 16;
export const CRC_BITS = 4;
export const PAYLOAD_BITS = CODE_BITS + CRC_BITS;
/** Codes 1…MAX_CODE go to signed-in viewers; 0 = guests (all segments A). */
export const MAX_CODE = (1 << CODE_BITS) - 1;
/** Minimum segments for a full payload (an episode shorter than PAYLOAD_BITS × SEG_SEC can't be fully traced). */
export const MIN_SEGMENTS = PAYLOAD_BITS;

/** CRC-4 (poly x^4 + x + 1) over the code bits. */
export function crc4(code: number) {
  let crc = 0;
  for (let i = CODE_BITS - 1; i >= 0; i--) {
    const bit = ((code >> i) & 1) ^ ((crc >> 3) & 1);
    crc = (crc << 1) & 0xf;
    if (bit) crc ^= 0x3;
  }
  return crc;
}

/** The repeating payload: code bits (MSB first) followed by its CRC. */
export function payloadBits(code: number): number[] {
  const value = (code << CRC_BITS) | crc4(code);
  return Array.from({ length: PAYLOAD_BITS }, (_, i) => (value >> (PAYLOAD_BITS - 1 - i)) & 1);
}

/** Variant of segment n for a viewer: "A" (bit 0) or "B" (bit 1). Guests (code 0) always get A. */
export function variantFor(code: number, n: number): "A" | "B" {
  if (code <= 0) return "A";
  return payloadBits(code)[n % PAYLOAD_BITS] ? "B" : "A";
}

export type SegmentReading = { n: number; bit: 0 | 1; strength: number };

/**
 * Reads the code back from per-segment readings (bit + how sure we are). Repeated payload positions
 * are combined by weighted vote. Returns null when the CRC doesn't match (not enough clean signal).
 */
export function decodeCode(readings: SegmentReading[]): { code: number; confidence: number; votes: number } | null {
  const score = new Array<number>(PAYLOAD_BITS).fill(0);
  const seen = new Array<number>(PAYLOAD_BITS).fill(0);
  for (const r of readings) {
    const k = r.n % PAYLOAD_BITS;
    score[k] += (r.bit ? 1 : -1) * Math.max(0, r.strength);
    seen[k]++;
  }
  if (seen.some((s) => s === 0)) return null;
  const bits = score.map((s) => (s > 0 ? 1 : 0));
  const value = bits.reduce((a: number, b) => (a << 1) | b, 0);
  const code = value >> CRC_BITS;
  if ((value & 0xf) !== crc4(code) || code === 0) return null;
  const total = score.reduce((a, s) => a + Math.abs(s), 0);
  const weakest = Math.min(...score.map((s) => Math.abs(s)));
  return { code, confidence: total ? Math.min(1, (weakest * PAYLOAD_BITS) / total) : 0, votes: readings.length };
}

/**
 * One segment: is the leaked frame closer to A or to B? Correlates (leak − mid) with (B − A) after
 * matching the leak's brightness/contrast to the reference (survives re-encoding, scaling, colour tweaks).
 */
export function readSegment(leak: Uint8Array, a: Uint8Array, b: Uint8Array): { bit: 0 | 1; strength: number } {
  const n = Math.min(leak.length, a.length, b.length);
  let ml = 0, mr = 0;
  for (let i = 0; i < n; i++) {
    ml += leak[i];
    mr += (a[i] + b[i]) / 2;
  }
  ml /= n;
  mr /= n;
  let vl = 0, vr = 0;
  for (let i = 0; i < n; i++) {
    vl += (leak[i] - ml) ** 2;
    vr += ((a[i] + b[i]) / 2 - mr) ** 2;
  }
  const k = vl > 0 ? Math.sqrt(vr / vl) : 1;
  let dot = 0, norm = 0;
  for (let i = 0; i < n; i++) {
    const l = (leak[i] - ml) * k + mr;
    const d = b[i] - a[i];
    dot += (l - (a[i] + b[i]) / 2) * d;
    norm += d * d;
  }
  const corr = norm > 0 ? dot / norm : 0; // ≈ +0.5 for a B frame, −0.5 for an A frame
  return { bit: corr > 0 ? 1 : 0, strength: Math.min(1, Math.abs(corr) * 2) };
}

/** Peak luma offset of the pattern (out of 255): +s in A, −s in B — invisible, but survives re-encoding. */
export const WM_STRENGTH = 2.5;
