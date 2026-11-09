export type AttemptRow = {
  userId: string;
  score: number | null;
  rwScore: number | null;
  mathScore: number | null;
  completedAt: string | null;
};

export type Standing = {
  userId: string;
  name: string;
  score: number;
  rwScore: number | null;
  mathScore: number | null;
  completedAt: string;
};

/** One shared place. People with the same total stand together. */
export type PlaceGroup = {
  place: number;
  people: Standing[];
};

export type MockAttemptLite = {
  mockId: string;
  userId: string;
  score: number | null;
  completedAt: string | null;
};

export type RecentMock = {
  mockId: string;
  title: string;
  finisherCount: number;
  topScore: number;
  latestCompletedAt: string;
};

export function studentLabel(
  profile: { username: string | null; full_name: string | null } | undefined,
): string {
  const full = profile?.full_name?.trim();
  if (full) return full;
  const username = profile?.username?.trim();
  if (username) return username;
  return "Student";
}

function better(current: AttemptRow, next: AttemptRow): AttemptRow {
  const currentScore = current.score ?? -1;
  const nextScore = next.score ?? -1;
  if (currentScore !== nextScore) return currentScore > nextScore ? current : next;
  const currentAt = current.completedAt ?? "";
  const nextAt = next.completedAt ?? "";
  return currentAt <= nextAt ? current : next;
}

/** Best scored attempt per student, then places by distinct totals. */
export function rankMockAttempts(
  attempts: AttemptRow[],
  nameOf: (userId: string) => string,
): PlaceGroup[] {
  const best = new Map<string, AttemptRow>();
  for (const row of attempts) {
    if (row.score == null || !row.completedAt) continue;
    const prev = best.get(row.userId);
    best.set(row.userId, prev ? better(prev, row) : row);
  }

  const standings: Standing[] = [...best.values()]
    .map((row) => ({
      userId: row.userId,
      name: nameOf(row.userId),
      score: row.score as number,
      rwScore: row.rwScore,
      mathScore: row.mathScore,
      completedAt: row.completedAt as string,
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const groups: PlaceGroup[] = [];
  for (const standing of standings) {
    const last = groups[groups.length - 1];
    if (last && last.people[0]?.score === standing.score) {
      last.people.push(standing);
    } else {
      groups.push({ place: groups.length + 1, people: [standing] });
    }
  }
  return groups;
}

/** Mocks that have a scored finish, newest activity first. */
export function recentMockRatings(
  titles: Map<string, string>,
  attempts: MockAttemptLite[],
): RecentMock[] {
  const byMock = new Map<string, MockAttemptLite[]>();
  for (const row of attempts) {
    if (row.score == null || !row.completedAt) continue;
    const list = byMock.get(row.mockId) ?? [];
    list.push(row);
    byMock.set(row.mockId, list);
  }

  const out: RecentMock[] = [];
  for (const [mockId, rows] of byMock) {
    const ranked = rankMockAttempts(
      rows.map((row) => ({
        userId: row.userId,
        score: row.score,
        rwScore: null,
        mathScore: null,
        completedAt: row.completedAt,
      })),
      () => "",
    );
    let latest = "";
    for (const row of rows) {
      if (row.completedAt && row.completedAt > latest) latest = row.completedAt;
    }
    out.push({
      mockId,
      title: titles.get(mockId) ?? "Full mock",
      finisherCount: ranked.reduce((count, group) => count + group.people.length, 0),
      topScore: ranked[0]?.people[0]?.score ?? 0,
      latestCompletedAt: latest,
    });
  }

  out.sort((a, b) =>
    a.latestCompletedAt < b.latestCompletedAt
      ? 1
      : a.latestCompletedAt > b.latestCompletedAt
        ? -1
        : 0,
  );
  return out;
}
