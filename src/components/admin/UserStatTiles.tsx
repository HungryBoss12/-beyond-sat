type Stats = {
  tests_total: number;
  tests_mock: number;
  tests_daily: number;
  tests_practice: number;
  tests_completed?: number;
  tests_in_progress?: number;
  best_mock_score?: number | null;
  accuracy_pct: number | null;
  vocab_cards?: number;
  vocab_due?: number;
  vocab_quiz_attempts?: number;
  vocab_reviews_7d?: number;
};

export function UserStatTiles({ stats }: { stats: Stats }) {
  const tiles = [
    { label: "Tests", value: String(stats.tests_total), sub: testBreakdown(stats) },
    {
      label: "Accuracy",
      value: stats.accuracy_pct != null ? `${stats.accuracy_pct}%` : "—",
      sub: "All attempts",
    },
    {
      label: "Best mock",
      value: stats.best_mock_score != null ? String(stats.best_mock_score) : "—",
      sub: "Highest score",
    },
    {
      label: "Vocab cards",
      value: String(stats.vocab_cards ?? 0),
      sub: stats.vocab_due ? `${stats.vocab_due} due now` : "SRS deck",
    },
    {
      label: "Vocab quizzes",
      value: String(stats.vocab_quiz_attempts ?? 0),
      sub: "Attempts",
    },
    {
      label: "Vocab 7d",
      value: String(stats.vocab_reviews_7d ?? 0),
      sub: "Cards reviewed",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-xl border border-brand-400/40 bg-brand-800/60 px-4 py-3 ring-1 ring-brand-400/20"
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-brand-200">
            {t.label}
          </div>
          <div className="mt-1 text-2xl font-black tabular-nums text-white">{t.value}</div>
          <div className="mt-0.5 text-xs text-brand-100">{t.sub}</div>
        </div>
      ))}
    </div>
  );
}

function testBreakdown(stats: Stats): string {
  const parts = [
    stats.tests_mock ? `${stats.tests_mock} mock` : null,
    stats.tests_daily ? `${stats.tests_daily} daily` : null,
    stats.tests_practice ? `${stats.tests_practice} practice` : null,
  ].filter(Boolean);
  if (stats.tests_in_progress) parts.push(`${stats.tests_in_progress} in progress`);
  return parts.length ? parts.join(" · ") : "No sessions yet";
}
