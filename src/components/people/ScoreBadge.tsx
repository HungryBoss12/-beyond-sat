import { badgePaint } from "@/lib/people/badge";

/** The score pill next to a name. Nothing is drawn when there is no score. */
export function ScoreBadge({ score }: { score?: number | null }) {
  if (score == null) return null;
  const paint = badgePaint(score);
  return (
    <span
      className={
        "score-badge" +
        (paint.tier === "gold" ? " score-badge-gold" : "") +
        (paint.tier === "perfect" ? " score-badge-perfect" : "")
      }
      style={{ background: paint.color, color: paint.ink, ["--badge" as string]: paint.color }}
    >
      {score}
    </span>
  );
}
