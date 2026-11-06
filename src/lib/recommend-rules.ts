/** Pure recommendation scoring (no DB) — unit-tested in recommend.test.ts. */

export type Signal = {
  seriesId: string;
  /** Episodes with any progress. */
  episodes: number;
  completed: number;
  likes: number;
  inList: boolean;
  /** 1–5 or null. */
  rating: number | null;
  /** Last watch time (ms), 0 if never watched. */
  lastAt: number;
};

/** How much one series tells about taste. Low ratings push its genres away. */
export function signalWeight(s: Signal) {
  let w = Math.min(s.episodes, 10) * 1 + Math.min(s.completed, 10) * 0.5 + Math.min(s.likes, 10) * 1.5 + (s.inList ? 3 : 0);
  if (s.rating !== null) w += (s.rating - 3) * 3;
  return w;
}

/**
 * Builds a genre profile from the signals, scores each candidate by genre overlap (normalized by its
 * number of genres) plus a light popularity tie-breaker, and picks the "because you watched" anchor:
 * the most recently watched liked series sharing the top recommendation's strongest genre.
 */
export function scoreRecommendations<C extends { id: string; genres: string[]; views: number }>(
  signals: Signal[],
  genresOf: Map<string, string[]>,
  candidates: C[],
  take = 12,
): { items: C[]; anchorId: string | null } {
  const taste = new Map<string, number>();
  for (const s of signals) {
    const w = signalWeight(s);
    const gs = genresOf.get(s.seriesId) ?? [];
    for (const g of gs) taste.set(g, (taste.get(g) ?? 0) + w / Math.max(1, gs.length));
  }
  const exclude = new Set(signals.filter((s) => s.episodes > 0).map((s) => s.seriesId));
  const maxViews = Math.max(1, ...candidates.map((c) => c.views));
  const scored = candidates
    .filter((c) => !exclude.has(c.id))
    .map((c) => {
      const affinity = c.genres.reduce((a, g) => a + (taste.get(g) ?? 0), 0) / Math.sqrt(Math.max(1, c.genres.length));
      return { c, affinity, score: affinity + 0.5 * (Math.log10(1 + c.views) / Math.log10(1 + maxViews)) };
    })
    .filter((x) => x.affinity > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, take);
  const items = scored.map((x) => x.c);
  if (!items.length) return { items, anchorId: null };
  const topGenre = [...items[0].genres].sort((a, b) => (taste.get(b) ?? 0) - (taste.get(a) ?? 0))[0];
  const anchor = signals
    .filter((s) => s.lastAt > 0 && signalWeight(s) > 0 && (genresOf.get(s.seriesId) ?? []).includes(topGenre))
    .sort((a, b) => b.lastAt - a.lastAt)[0];
  return { items, anchorId: anchor?.seriesId ?? null };
}
