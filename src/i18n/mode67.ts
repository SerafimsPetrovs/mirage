// "67" mode: the same site, but the texts are swapped for memes, film references and controlled absurdity.
// Still meaningful (a button still says what it does), just maximally brain-melting. Viewer toggles it;
// never in family mode. Implemented as a deep-partial overlay on the normal dictionary.

export const MODE67_COOKIE = "mirage_67";

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/** Deep-merges plain objects; arrays and strings in the overlay replace the base value as a whole. */
export function deepMerge<T>(base: T, over: DeepPartial<T> | undefined): T {
  if (!over) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    if (v === undefined) continue;
    const b = out[k];
    out[k] = isPlain(v) && isPlain(b) ? deepMerge(b, v as DeepPartial<typeof b>) : v;
  }
  return out as T;
}

function isPlain(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
