import type { RankLetter } from "@/lib/classes/ranking";

const TONE: Record<RankLetter, string> = {
  S: "bg-brand-400 text-white ring-brand-200/70 shadow-brand",
  A: "bg-brand-500 text-white ring-brand-300/50",
  B: "bg-brand-600 text-white ring-brand-400/40",
  C: "bg-brand-700 text-white ring-brand-400/30",
  D: "bg-brand-800 text-brand-100 ring-brand-400/20",
};

export function RankBadge({
  letter,
  total,
  size = "sm",
}: {
  letter: RankLetter;
  total?: number | null;
  size?: "sm" | "lg";
}) {
  const label = total != null ? `Rank ${letter}, ${total}` : `Rank ${letter}`;
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full font-black ring-1 " +
        TONE[letter] +
        (size === "lg" ? " px-3 py-1 text-sm" : " px-2 py-0.5 text-[11px]")
      }
      aria-label={label}
    >
      <span>{letter}</span>
      {total != null ? <span className="font-bold tabular-nums">{total}</span> : null}
    </span>
  );
}
