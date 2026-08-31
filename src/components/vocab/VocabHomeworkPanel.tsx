import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { Panel, PanelHead } from "@/components/ui/panel";
import {
  homeworkPeriodKey,
  listActiveHomeworkForUser,
  listMyHomeworkCompletions,
  type VocabHomeworkAssignment,
} from "@/lib/vocab/homework";

export function VocabHomeworkPanel() {
  const [assignments, setAssignments] = useState<VocabHomeworkAssignment[]>([]);
  const [completions, setCompletions] = useState<
    Awaited<ReturnType<typeof listMyHomeworkCompletions>>
  >([]);

  useEffect(() => {
    void (async () => {
      try {
        const [a, c] = await Promise.all([
          listActiveHomeworkForUser(),
          listMyHomeworkCompletions(),
        ]);
        setAssignments(a);
        setCompletions(c);
      } catch {
        /* tables may not exist yet */
      }
    })();
  }, []);

  const rows = useMemo(() => {
    return assignments.map((a) => {
      const periodKey = homeworkPeriodKey(a.recurrence);
      const completion = completions.find(
        (c) => c.assignment_id === a.id && c.period_key === periodKey,
      );
      const done = completion?.status === "completed";
      const progress =
        a.target_type === "deck"
          ? Math.min(
              100,
              Math.round(((completion?.cards_reviewed ?? 0) / (a.card_target ?? 1)) * 100),
            )
          : done
            ? 100
            : 0;
      const link =
        a.target_type === "deck" && a.deck_id
          ? `/vocab/deck/${a.deck_id}`
          : a.target_type === "quiz" && a.quiz_id
            ? `/vocab/tests/${a.quiz_id}`
            : "/vocab";
      return { a, done, progress, link, completion };
    });
  }, [assignments, completions]);

  if (!rows.length) return null;

  return (
    <Panel>
      <PanelHead label="Homework" icon={Clock} tone="brand" />
      <div className="mt-4 space-y-3">
        {rows.map(({ a, done, progress, link, completion }) => (
          <div key={a.id} className="rounded-xl border border-brand-400/30 bg-brand-800/50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold text-white">{a.title}</div>
                {a.instructions ? (
                  <p className="mt-1 text-xs text-brand-100">{a.instructions}</p>
                ) : null}
                <p className="mt-1 text-[11px] text-brand-200/80">
                  {a.target_type === "deck"
                    ? `${a.card_target} cards · all Good/Easy`
                    : "Quiz · 100% required"}
                  {a.recurrence !== "once" ? ` · ${a.recurrence}` : ""}
                </p>
              </div>
              {done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" /> : null}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-brand-900">
              <div
                className={
                  "h-full transition-all duration-500 " + (done ? "bg-emerald-400" : "bg-brand-300")
                }
                style={{ width: `${progress}%` }}
              />
            </div>
            {a.target_type === "deck" && completion ? (
              <p className="mt-1 text-[10px] text-brand-100">
                {completion.cards_reviewed}/{a.card_target} cards · {completion.green_reviews} green
              </p>
            ) : null}
            {!done ? (
              <a
                href={link}
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand-200 hover:text-white"
              >
                Start homework <ArrowRight className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}
