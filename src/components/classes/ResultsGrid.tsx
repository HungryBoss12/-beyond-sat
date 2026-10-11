import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { setResult, setResultSlots, type GroupLesson, type ResultRow } from "@/lib/classes/groups";
import { moduleMax, parseModule, resultLabel, resultValues } from "@/lib/classes/results";
import type { ClassSubject } from "@/lib/classes/types";
import { shortDate } from "@/lib/classes/schedule";
import { cn } from "@/lib/utils";
import type { GridPerson } from "./LessonGrids";

const MIN_SLOTS = 2;
const MAX_SLOTS = 7;

/** True when a reload already contains every number from the local save. */
function reloadHasSave(savedScores: (number | null)[], incoming: (number | null)[]): boolean {
  if (incoming.length < savedScores.length) return false;
  return savedScores.every((score, index) => (incoming[index] ?? null) === score);
}

/**
 * Correct answers per passage. The score column is the section score for the
 * sum. Past dates show it; the selected lesson is editable. Enter moves down
 * the column. A lesson starts with two passages and can grow to seven.
 */
export function ResultsGrid({
  subject,
  lessons,
  people,
  results,
  selectedId,
  onSelect,
  onSlots,
}: {
  subject: ClassSubject;
  lessons: GroupLesson[];
  people: GridPerson[];
  results: ResultRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSlots: (lessonId: string, slots: number) => void;
}) {
  const [saved, setSaved] = useState<Map<string, ResultRow>>(new Map());
  const [drafts, setDrafts] = useState<Map<string, string[]>>(new Map());
  const [slotBusy, setSlotBusy] = useState(false);
  const refs = useRef(new Map<string, HTMLInputElement>());
  const savedRef = useRef(saved);
  savedRef.current = saved;
  /** Scores confirmed in this visit. A slower reload must not paint over them. */
  const confirmedRef = useRef(new Map<string, (number | null)[]>());
  /** Unsaved boxes, keyed by lesson and student so a date change cannot reuse them. */
  const dirtyDraftsRef = useRef(new Map<string, string[]>());

  useEffect(() => {
    setSaved((current) => {
      const next = new Map<string, ResultRow>();
      for (const row of results) {
        const key = `${row.user_id}:${row.lesson_id}`;
        const incoming = resultValues(row);
        const held = confirmedRef.current.get(key);
        if (held && !reloadHasSave(held, incoming)) {
          const local = current.get(key);
          next.set(
            key,
            local ?? {
              ...row,
              scores: held,
              m1: held[0] ?? null,
              m2: held[1] ?? null,
            },
          );
          continue;
        }
        if (held) confirmedRef.current.delete(key);
        next.set(key, row);
      }
      for (const [key, held] of confirmedRef.current) {
        if (next.has(key)) continue;
        const local = current.get(key);
        if (local) next.set(key, local);
        else {
          const [userId, lessonId] = key.split(":");
          next.set(key, {
            lesson_id: lessonId ?? "",
            user_id: userId ?? "",
            m1: held[0] ?? null,
            m2: held[1] ?? null,
            scores: held,
          });
        }
      }
      return next;
    });
  }, [results]);

  const selected = lessons.find((l) => l.id === selectedId) ?? null;
  const slots = selected?.result_slots ?? MIN_SLOTS;
  const roster = people.map((p) => p.userId).join(",");
  const max = moduleMax(subject);

  // Drafts reset when the lesson, the roster or the loaded results change, never on a single save.
  // Adding a passage only pads the boxes so numbers already typed are kept.
  useEffect(() => {
    if (!selected) return;
    const source = new Map(results.map((r) => [`${r.user_id}:${r.lesson_id}`, r]));
    for (const [key, row] of savedRef.current) source.set(key, row);
    const count = selected.result_slots ?? MIN_SLOTS;
    const next = new Map<string, string[]>();
    for (const userId of roster.split(",").filter(Boolean)) {
      const dirtyKey = `${selected.id}:${userId}`;
      const kept = dirtyDraftsRef.current.get(dirtyKey);
      if (kept) {
        const padded = kept.slice(0, count);
        while (padded.length < count) padded.push("");
        dirtyDraftsRef.current.set(dirtyKey, padded);
        next.set(userId, padded);
        continue;
      }
      const row = source.get(`${userId}:${selected.id}`);
      const values = resultValues(row ?? { m1: null, m2: null });
      next.set(
        userId,
        Array.from({ length: count }, (_, index) =>
          values[index] == null ? "" : String(values[index]),
        ),
      );
    }
    setDrafts(next);
  }, [selected?.id, roster, results]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDrafts((current) => {
      let changed = false;
      const next = new Map(current);
      for (const [id, values] of next) {
        if (values.length === slots) continue;
        changed = true;
        const padded = values.slice(0, slots);
        while (padded.length < slots) padded.push("");
        next.set(id, padded);
      }
      return changed ? next : current;
    });
  }, [slots]);

  async function commit(person: GridPerson) {
    if (!selected) return;
    const draft = drafts.get(person.userId) ?? Array.from({ length: slots }, () => "");
    const parsed = draft.map((value) => parseModule(value, max));
    if (parsed.some((item) => item.kind === "error")) {
      toast.error(`Enter a whole number from 0 to ${max}.`);
      return;
    }
    const scores = parsed.map((item) => (item.kind === "ok" ? item.value : null));
    const key = `${person.userId}:${selected.id}`;
    const before = resultValues(saved.get(key) ?? { m1: null, m2: null });
    const same =
      scores.length === before.length && scores.every((score, index) => score === (before[index] ?? null));
    if (same) return;
    try {
      await setResult(selected.id, person.userId, scores);
      confirmedRef.current.set(key, scores);
      dirtyDraftsRef.current.delete(key);
      setSaved((cur) => {
        const copy = new Map(cur);
        if (scores.every((score) => score == null)) copy.delete(key);
        else {
          copy.set(key, {
            lesson_id: selected.id,
            user_id: person.userId,
            m1: scores[0] ?? null,
            m2: scores[1] ?? null,
            scores,
          });
        }
        return copy;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the result");
    }
  }

  function moveDown(index: number, field: number) {
    const next = people[index + 1];
    if (next) refs.current.get(`${next.userId}:${field}`)?.focus();
  }

  const lastEmpty =
    slots > MIN_SLOTS &&
    people.every((person) => (drafts.get(person.userId)?.[slots - 1] ?? "").trim() === "");

  async function changeSlots(count: number) {
    if (!selected || slotBusy) return;
    setSlotBusy(true);
    try {
      await setResultSlots(selected.id, count);
      onSlots(selected.id, count);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change the passages");
    } finally {
      setSlotBusy(false);
    }
  }

  const passageNames = Array.from({ length: slots }, (_, index) => `M${index + 1}`).join(" · ");

  return (
    <div className="space-y-2">
      <p className="text-xs text-white">
        Each passage is correct answers (0–{max}). Score is the{" "}
        {subject === "math" ? "Math" : "Reading & Writing"} section score for their sum. Enter moves
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
                    colSpan={slots + 1}
                    className="rounded-t-lg bg-brand-500 px-2 py-2 text-center text-white"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span>
                        {shortDate(lesson.lesson_date)} · {passageNames} · Score
                      </span>
                      <span className="flex flex-wrap justify-center gap-1">
                        <button
                          type="button"
                          disabled={slotBusy || slots >= MAX_SLOTS}
                          onClick={() => void changeSlots(slots + 1)}
                          className="tap inline-flex items-center gap-1 rounded-full bg-brand-800 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-40"
                        >
                          <Plus className="h-3 w-3" aria-hidden="true" />
                          Add passage
                        </button>
                        {slots > MIN_SLOTS && lastEmpty && (
                          <button
                            type="button"
                            disabled={slotBusy}
                            onClick={() => void changeSlots(slots - 1)}
                            className="tap inline-flex items-center gap-1 rounded-full bg-brand-800 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-40"
                          >
                            <Minus className="h-3 w-3" aria-hidden="true" />
                            Remove last
                          </button>
                        )}
                      </span>
                    </div>
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
                      <td key={lesson.id} className="px-2 py-2 text-center tabular-nums text-white">
                        {resultLabel(resultValues(row ?? { m1: null, m2: null }), subject)}
                      </td>
                    );
                  }
                  const draft = drafts.get(person.userId) ?? Array.from({ length: slots }, () => "");
                  const parsed = draft.map((value) => parseModule(value, max));
                  const scores = parsed.map((item) => (item.kind === "ok" ? item.value : null));
                  return (
                    <ResultCells
                      key={lesson.id}
                      person={person}
                      draft={draft}
                      errors={parsed.map((item) => item.kind === "error")}
                      label={resultLabel(scores, subject)}
                      max={max}
                      refs={refs.current}
                      onChange={(field, value) => {
                        if (!selected) return;
                        setDrafts((cur) => {
                          const next = [...(cur.get(person.userId) ?? draft)];
                          next[field] = value;
                          dirtyDraftsRef.current.set(`${selected.id}:${person.userId}`, next);
                          return new Map(cur).set(person.userId, next);
                        });
                      }}
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
  draft: string[];
  errors: boolean[];
  label: string;
  max: number;
  refs: Map<string, HTMLInputElement>;
  onChange: (field: number, value: string) => void;
  onCommit: () => void;
  onEnter: (field: number) => void;
}) {
  return (
    <>
      {draft.map((value, field) => (
        <td key={field} className="bg-brand-500 px-1 py-1">
          <input
            ref={(el) => {
              if (el) refs.set(`${person.userId}:${field}`, el);
              else refs.delete(`${person.userId}:${field}`);
            }}
            inputMode="numeric"
            maxLength={2}
            aria-label={`M${field + 1} for ${person.name}`}
            aria-invalid={errors[field] || undefined}
            value={value}
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
        {errors.some(Boolean) && <span className="sr-only"> (enter 0 to {max})</span>}
      </td>
    </>
  );
}
