/** YouTube-style score delta when a user changes their vote. */
export function voteScoreDelta(
  previous: -1 | 0 | 1,
  next: -1 | 0 | 1,
): number {
  return next - previous;
}

export function sortByScore<T extends { score?: number; sort_order?: number }>(
  videos: T[],
): T[] {
  return [...videos].sort((a, b) => {
    const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
}

export const SECTION_REC_LIMIT = 2;
export const HUB_TOP_LIMIT = 3;
