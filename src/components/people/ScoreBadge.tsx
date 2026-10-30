import { badgeFill } from "@/lib/people/badge";

/** The pill next to a name. A label replaces the score. Nothing is drawn without a score. */
export function ScoreBadge({
  score,
  label,
  color,
}: {
  score?: number | null;
  label?: string | null;
  color?: string | null;
}) {
  if (score == null) return null;
  const text = label?.trim() ? label.trim() : String(score);
  const paint = badgeFill(score, color);
  return (
    <span
      className={
        "score-badge whitespace-nowrap" +
        (paint.tier === "gold" ? " score-badge-gold" : "") +
        (paint.tier === "perfect" ? " score-badge-perfect" : "")
      }
      style={{ background: paint.color, color: paint.ink, ["--badge" as string]: paint.color }}
    >
      {text}
    </span>
  );
}
