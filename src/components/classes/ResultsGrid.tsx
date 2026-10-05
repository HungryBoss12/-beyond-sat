import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { setResult, type GroupLesson, type ResultRow } from "@/lib/classes/groups";
import { moduleMax, parseModule, resultLabel } from "@/lib/classes/results";
import type { ClassSubject } from "@/lib/classes/types";
import { shortDate } from "@/lib/classes/schedule";
import { cn } from "@/lib/utils";
import type { GridPerson } from "./LessonGrids";

type Draft = { m1: string; m2: string };

/**
 * M1 + M2 correct answers per student. The score column is the section score
 * for that raw total. Past dates show it; the selected lesson is editable.
 * Enter moves down the column.
 */
export function ResultsGrid({
  subject,
  lessons,
  people,
  results,
  selectedId,
  onSelect,
}: {
  subject: ClassSubject;
  lessons: GroupLesson[];
  people: GridPerson[];
  results: ResultRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [saved, setSaved] = useState<Map<string, ResultRow>>(new Map());
  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map());
  const refs = useRef(new Map<string, HTMLInputElement>());
  const savedRef = useRef(saved);
  savedRef.current = saved;

  useEffect(() => {
    setSaved(new Map(results.map((r) => [`${r.user_id}:${r.lesson_id}`, r])));
  }, [results]);

  const selected = lessons.find((l) => l.id === selectedId) ?? null;
  const roster = people.map((p) => p.userId).join(",");

  // Drafts reset when the lesson, the roster or the loaded results change, never on a single save.
  useEffect(() => {
    if (!selected) return;
    const source = new Map(results.map((r) => [`${r.user_id}:${r.lesson_id}`, r]));
    for (const [key, row] of savedRef.current) source.set(key, row);
    const next = new Map<string, Draft>();
    for (const userId of roster.split(",").filter(Boolean)) {
      const row = source.get(`${userId}:${selected.id}`);
      next.set(userId, {
        m1: row?.m1 == null ? "" : String(row.m1),
        m2: row?.m2 == null ? "" : String(row.m2),
      });
    }
    setDrafts(next);
  }, [selected?.id, roster, results]); // eslint-disable-line react-hooks/exhaustive-deps

  async function commit(person: GridPerson) {
    if (!selected) return;
    const draft = drafts.get(person.userId) ?? { m1: "", m2: "" };
    const a = parseModule(draft.m1, moduleMax(subject));
    const b = parseModule(draft.m2, moduleMax(subject));
    if (a.kind === "error" || b.kind === "error") return;
    const m1 = a.kind === "ok" ? a.value : null;
    const m2 = b.kind === "ok" ? b.value : null;
    const key = `${person.userId}:${selected.id}`;
    const before = saved.get(key);
    if ((before?.m1 ?? null) === m1 && (before?.m2 ?? null) === m2) return;
    try {
      await setResult(selected.id, person.userId, m1, m2);
      setSaved((cur) => {
        const copy = new Map(cur);
        if (m1 == null && m2 == null) copy.delete(key);
        else copy.set(key, { lesson_id: selected.id, user_id: person.userId, m1, m2 });
        return copy;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the result");
    }
  }

  function moveDown(index: number, field: "m1" | "m2") {
    const next = people[index + 1];
    if (next) refs.current.get(`${next.userId}:${field}`)?.focus();
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-white">
        M1 and M2 are correct answers (0–{moduleMax(subject)}). Score is the{" "}
        {subject === "math" ? "Math" : "Reading & Writing"} section score for M1 + M2. Enter moves
        down.
      </p>
      <div className="overflow-x-auto overflow-y-clip">
        <table className="min-w-max text-left text-sm">
          <thead className="text-[11px] font-bold text-white">
            <tr>
              <th className="sticky left-0 z-10 bg-brand-600 px-2 py-2">Student</th>
              {lessons.map((lesson) =>
                lesson.id === selectedId ? (
                  <th
                    key={lesson.id}
                    colSpan={3}
                    className="rounded-t-lg bg-brand-500 px-2 py-2 text-center text-white"
                  >
                    {shortDate(lesson.lesson_date)} · M1 · M2 · Score
                  </th>
                ) : (
                  <th key={lesson.id} className="px-2 py-2 text-center">
                    <button
                      type="button"
                      className="tap tabular-nums"
                      onClick={() => onSelect(lesson.id)}
                    >
                      {shortDate(lesson.lesson_date)}
                    </button>
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {people.map((person, index) => (
              <tr key={person.userId} className="border-t border-brand-400/30">
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-[200px] truncate bg-brand-600 px-2 py-2 font-bold text-white"
                >
                  {person.name}
                </th>
                {lessons.map((lesson) => {
                  if (lesson.id !== selectedId) {
                    const row = saved.get(`${person.userId}:${lesson.id}`);
                    return (
                      <td
                        key={lesson.id}
                        className="px-2 py-2 text-center tabular-nums text-white"
                      >
                        {resultLabel(row?.m1 ?? null, row?.m2 ?? null, subject)}
                      </td>
                    );
                  }
                  const draft = drafts.get(person.userId) ?? { m1: "", m2: "" };
                  const a = parseModule(draft.m1, moduleMax(subject));
                  const b = parseModule(draft.m2, moduleMax(subject));
                  const label = resultLabel(
                    a.kind === "ok" ? a.value : null,
                    b.kind === "ok" ? b.value : null,
                    subject,
                  );
                  return (
                    <ResultCells
                      key={lesson.id}
                      person={person}
                      draft={draft}
                      errors={{ m1: a.kind === "error", m2: b.kind === "error" }}
                      label={label}
                      max={moduleMax(subject)}
                      refs={refs.current}
                      onChange={(field, value) =>
                        setDrafts((cur) =>
                          new Map(cur).set(person.userId, { ...draft, [field]: value }),
                        )
                      }
                      onCommit={() => void commit(person)}
                      onEnter={(field) => moveDown(index, field)}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultCells({
  person,
  draft,
  errors,
  label,
  max,
  refs,
  onChange,
  onCommit,
  onEnter,
}: {
  person: GridPerson;
  draft: Draft;
  errors: { m1: boolean; m2: boolean };
  label: string;
  max: number;
  refs: Map<string, HTMLInputElement>;
  onChange: (field: "m1" | "m2", value: string) => void;
  onCommit: () => void;
  onEnter: (field: "m1" | "m2") => void;
}) {
  return (
    <>
      {(["m1", "m2"] as const).map((field) => (
        <td key={field} className="bg-brand-500 px-1 py-1">
          <input
            ref={(el) => {
              if (el) refs.set(`${person.userId}:${field}`, el);
            }}
            inputMode="numeric"
            maxLength={2}
            aria-label={`${field.toUpperCase()} for ${person.name}`}
            aria-invalid={errors[field] || undefined}
            value={draft[field]}
            onChange={(e) => onChange(field, e.target.value.replace(/\D/g, ""))}
            onBlur={onCommit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCommit();
                onEnter(field);
              }
            }}
            className={cn(
              "h-9 w-12 rounded-lg border bg-brand-800 text-center font-bold tabular-nums text-white outline-none focus:ring-2 focus:ring-brand-200",
              errors[field] ? "border-brand-25 ring-2 ring-brand-25/60" : "border-brand-400/50",
            )}
          />
        </td>
      ))}
      <td className="bg-brand-500 px-2 py-1 text-center font-black tabular-nums text-white">
        {label}
        {(errors.m1 || errors.m2) && (
          <span className="sr-only"> (enter 0 to {max})</span>
        )}
      </td>
    </>
  );
}
