import type { Draft } from "@/lib/import/parse";

/**
 * Merge a fresh batch of vision drafts into what's already on screen.
 *
 * Prefer content match when numbers were auto-assigned; printed-number collisions
 * still keep the existing row so editor edits are not discarded.
 */
export function mergeDrafts(existing: Draft[], incoming: Draft[]): Draft[] {
  const haveNumbers = new Set(existing.map((d) => d.number));
  const haveText = new Set(
    existing.map((d) =>
      (d.rec.question_text || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 200),
    ),
  );
  const added = incoming.filter((d) => {
    const text = (d.rec.question_text || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
    if (text && haveText.has(text)) return false;
    if (haveNumbers.has(d.number)) return false;
    return true;
  });
  return [...existing, ...added].sort((a, b) => a.number - b.number);
}
