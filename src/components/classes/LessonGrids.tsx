import { useEffect, useMemo, useRef, useState } from "react";
import { usePointerGlow } from "@/hooks/usePointerGlow";
import { CalendarPlus, Check, CheckCheck, Eraser, Gauge, X } from "lucide-react";
import { toast } from "sonner";
import { IconButton } from "@/components/ui/icon-button";
import type { MemberStatus } from "@/lib/classes/types";
import {
  addGroupLesson,
  setGroupAttendance,
  setGroupAttendanceMany,
  setHwMarks,
  tickAllComplete,
  untickAll,
  type AttendanceRow,
  type GroupLesson,
  type HwMark,
  type LevelBoardRow,
} from "@/lib/classes/groups";
import {
  HW_ITEM_LABEL,
  HW_ITEM_LETTER,
  doneSummary,
  itemsFor,
  type HwItem,
  type Subject,
} from "@/lib/classes/schemes";
import { shortDate } from "@/lib/classes/schedule";
import { cn } from "@/lib/utils";
import { CLASS_CONTROL } from "./control";

export type GridPerson = { userId: string; name: string; status: MemberStatus };

const NAME_COL = "minmax(150px, 200px)";

/** Horizontal scroller that still lets the mouse wheel move the page, with the card glow. */
function GlowScroll({ children }: { children: React.ReactNode }) {
  const ref = usePointerGlow<HTMLDivElement>();
  return (
    <div ref={ref} className="reveal-surface overflow-x-auto overflow-y-clip rounded-xl">
      {children}
    </div>
  );
}

/** Date pills for the month; the selected lesson drives tick-all, results and level dates. */
export function DateStrip({
  groupId,
  lessons,
  selectedId,
  onSelect,
  onAdded,
}: {
  groupId: string;
  lessons: GroupLesson[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdded: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState("");
  const selected = lessons.find((l) => l.id === selectedId) ?? null;
  return (
    <div className="space-y-2">
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="listbox"
        aria-label="Lessons this month"
      >
        {lessons.map((lesson) => (
          <button
            key={lesson.id}
            type="button"
            role="option"
            aria-selected={lesson.id === selectedId}
            onClick={() => onSelect(lesson.id)}
            className={cn(
              "tap rounded-full px-2.5 py-1 text-xs font-bold tabular-nums transition-colors duration-200",
              lesson.id === selectedId
                ? "bg-brand-25 text-brand-900"
                : "bg-brand-800 text-white",
            )}
          >
            {shortDate(lesson.lesson_date)}
          </button>
        ))}
        {lessons.length === 0 && (
          <span className="text-xs text-white">
            No lessons this month. Set the days in Edit class, or add a date.
          </span>
        )}
        <IconButton
          icon={CalendarPlus}
          label="Add a lesson date"
          className="h-8 min-w-8 w-8 text-white hover:bg-brand-500"
          pressed={adding}
          onClick={() => setAdding((v) => !v)}
        />
        {selected && (
          <span className="ml-auto rounded-full border border-brand-300 px-2.5 py-1 text-xs font-bold">
            Lesson: {shortDate(selected.lesson_date)}
          </span>
        )}
      </div>
      {adding && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!date) return;
            void addGroupLesson(groupId, date)
              .then(async () => {
                toast.success(`Lesson added · ${shortDate(date)}`);
                setAdding(false);
                setDate("");
                await onAdded();
              })
              .catch((err) =>
                toast.error(err instanceof Error ? err.message : "Could not add the lesson"),
              );
          }}
        >
          <input
            type="date"
            aria-label="Lesson date"
            className={CLASS_CONTROL + " w-auto"}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button
            type="submit"
            className="btn-brand rounded-full bg-brand-400 px-3 py-1.5 text-xs font-bold"
          >
            Add
          </button>
        </form>
      )}
    </div>
  );
}

type AttendanceState = "present" | "absent" | "empty";

function nextState(state: AttendanceState): AttendanceState {
  if (state === "present") return "absent";
  if (state === "absent") return "empty";
  return "present";
}

/** Roving-tabindex grid: arrows move, Enter/Space cycles present → absent → clear. */
function useGridFocus(rows: number, cols: number) {
  const [pos, setPos] = useState({ r: 0, c: 0 });
  const refs = useRef(new Map<string, HTMLButtonElement>());
  function onKey(event: React.KeyboardEvent, r: number, c: number) {
    const moves: Record<string, [number, number]> = {
      ArrowRight: [0, 1],
      ArrowLeft: [0, -1],
      ArrowDown: [1, 0],
      ArrowUp: [-1, 0],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    const next = {
      r: Math.max(0, Math.min(rows - 1, r + move[0])),
      c: Math.max(0, Math.min(cols - 1, c + move[1])),
    };
    setPos(next);
    refs.current.get(`${next.r}:${next.c}`)?.focus();
  }
  return { pos, setPos, refs, onKey };
}

export function AttendanceGrid({
  groupId,
  lessons,
  people,
  attendance,
  selectedId,
  onSelect,
  onChanged,
}: {
  groupId: string;
  lessons: GroupLesson[];
  people: GridPerson[];
  attendance: AttendanceRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChanged: () => Promise<void>;
}) {
  const [local, setLocal] = useState<Map<string, AttendanceState>>(new Map());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setLocal(
      new Map(
        attendance.map((row) => [
          `${row.user_id}:${row.lesson_date}`,
          row.participated ? "present" : "absent",
        ]),
      ),
    );
  }, [attendance]);
  const grid = useGridFocus(people.length, lessons.length);

  async function cycle(person: GridPerson, lesson: GroupLesson) {
    const key = `${person.userId}:${lesson.lesson_date}`;
    const before = local.get(key) ?? "empty";
    const after = nextState(before);
    setLocal((cur) => {
      const copy = new Map(cur);
      if (after === "empty") copy.delete(key);
      else copy.set(key, after);
      return copy;
    });
    try {
      await setGroupAttendance({
        groupId,
        userId: person.userId,
        lessonDate: lesson.lesson_date,
        state: after,
      });
    } catch (err) {
      setLocal((cur) => {
        const copy = new Map(cur);
        if (before === "empty") copy.delete(key);
        else copy.set(key, before);
        return copy;
      });
      toast.error(err instanceof Error ? err.message : "Could not save attendance");
    }
  }

  const selected = lessons.find((l) => l.id === selectedId);
  const counts = { present: 0, absent: 0 };
  if (selected) {
    for (const person of people) {
      const state = local.get(`${person.userId}:${selected.lesson_date}`);
      if (state === "present") counts.present += 1;
      if (state === "absent") counts.absent += 1;
    }
  }
  const columns = `${NAME_COL} repeat(${Math.max(lessons.length, 1)}, minmax(52px, 1fr))`;

  async function markListed(state: "present" | "empty") {
    if (!selected || people.length === 0) return;
    const before = new Map(local);
    setLocal((cur) => {
      const copy = new Map(cur);
      for (const person of people) {
        const key = `${person.userId}:${selected.lesson_date}`;
        if (state === "empty") copy.delete(key);
        else copy.set(key, "present");
      }
      return copy;
    });
    setBusy(true);
    try {
      await setGroupAttendanceMany({
        groupId,
        userIds: people.map((person) => person.userId),
        lessonDate: selected.lesson_date,
        state,
      });
      await onChanged();
    } catch (err) {
      setLocal(before);
      toast.error(err instanceof Error ? err.message : "Could not save attendance");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-white">Click a cell: present → absent → clear</p>
        <div className="ml-auto flex gap-1">
          <IconButton
            icon={Eraser}
            label="Clear all"
            className="text-white hover:bg-brand-500"
            disabled={busy || !selected || people.length === 0}
            onClick={() => void markListed("empty")}
          />
          <IconButton
            icon={CheckCheck}
            label="Tick all present"
            variant="brand"
            disabled={busy || !selected || people.length === 0}
            onClick={() => void markListed("present")}
          />
        </div>
      </div>
      <GlowScroll>
        <div role="grid" aria-label="Attendance" className="min-w-max">
          <div role="row" className="grid" style={{ gridTemplateColumns: columns }}>
            <div
              role="columnheader"
              className="sticky left-0 z-10 bg-brand-600 px-2 py-2 text-xs font-bold"
            >
              Student
            </div>
            {lessons.map((lesson) => (
              <button
                key={lesson.id}
                type="button"
                role="columnheader"
                aria-pressed={lesson.id === selectedId}
                onClick={() => onSelect(lesson.id)}
                className={cn(
                  "tap px-1 py-2 text-center text-[11px] font-bold tabular-nums",
                  lesson.id === selectedId && "rounded-t-lg bg-brand-500",
                )}
              >
                {shortDate(lesson.lesson_date)}
              </button>
            ))}
          </div>
          {people.map((person, r) => (
            <div
              key={person.userId}
              role="row"
              className="grid border-t border-brand-400/30"
              style={{ gridTemplateColumns: columns }}
            >
              <div
                role="rowheader"
                className="sticky left-0 z-10 truncate bg-brand-600 px-2 py-2 text-sm font-bold"
              >
                {person.name}
              </div>
              {lessons.map((lesson, c) => {
                const state = local.get(`${person.userId}:${lesson.lesson_date}`) ?? "empty";
                return (
                  <div
                    key={lesson.id}
                    role="gridcell"
                    className={cn(lesson.id === selectedId && "bg-brand-500")}
                  >
                    <button
                      ref={(el) => {
                        if (el) grid.refs.current.set(`${r}:${c}`, el);
                      }}
                      type="button"
                      tabIndex={grid.pos.r === r && grid.pos.c === c ? 0 : -1}
                      aria-label={`${person.name}, ${shortDate(lesson.lesson_date)}: ${state === "empty" ? "not marked" : state}`}
                      onFocus={() => grid.setPos({ r, c })}
                      onKeyDown={(event) => grid.onKey(event, r, c)}
                      onClick={() => void cycle(person, lesson)}
                      className={cn(
                        "tap grid h-10 w-full place-items-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-200",
                        state === "present" && "text-white",
                        state === "absent" && "text-brand-200",
                      )}
                    >
                      {state === "present" ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold">
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </span>
                      ) : state === "absent" ? (
                        <X className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <span className="h-1 w-1 rounded-full bg-brand-400" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </GlowScroll>
      <p className="text-xs font-bold text-white tabular-nums">
        {selected
          ? `${shortDate(selected.lesson_date)}: ${counts.present} present · ${counts.absent} absent · ${people.length - counts.present - counts.absent} not marked`
          : "Pick a lesson date"}
      </p>
    </div>
  );
}

/** VAR (Eng) or AFL (Maths) ticks per student × lesson, with the Level column for AFL. */
export function MarksGrid({
  subject,
  lessons,
  people,
  marks,
  board,
  selectedId,
  onSelect,
  onOpenLevel,
  onChanged,
}: {
  subject: Subject;
  lessons: GroupLesson[];
  people: GridPerson[];
  marks: HwMark[];
  board: Map<string, LevelBoardRow>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenLevel: (userId: string) => void;
  onChanged: () => Promise<void>;
}) {
  const items = itemsFor(subject);
  const [local, setLocal] = useState<Map<string, boolean>>(new Map());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setLocal(new Map(marks.map((m) => [`${m.user_id}:${m.lesson_id}:${m.item}`, m.done])));
  }, [marks]);
  const sources = useMemo(
    () => new Map(marks.map((m) => [`${m.user_id}:${m.lesson_id}:${m.item}`, m.source])),
    [marks],
  );
  const selected = lessons.find((l) => l.id === selectedId) ?? null;
  const ids = people.map((p) => p.userId);

  async function toggle(person: GridPerson, lesson: GroupLesson, item: HwItem) {
    const key = `${person.userId}:${lesson.id}:${item}`;
    const before = local.get(key) ?? false;
    setLocal((cur) => new Map(cur).set(key, !before));
    onSelect(lesson.id);
    try {
      await setHwMarks(lesson.id, [person.userId], item, !before);
    } catch (err) {
      setLocal((cur) => new Map(cur).set(key, before));
      toast.error(err instanceof Error ? err.message : "Could not save");
    }
  }

  async function bulk(
    label: string,
    run: () => Promise<unknown>,
    lesson: { lesson_date: string } | null = selected,
  ) {
    if (!lesson) return toast.message("Pick a lesson date first");
    if (people.length === 0) return;
    if (
      people.length > 10 &&
      !confirm(`${label} for ${people.length} students on ${shortDate(lesson.lesson_date)}?`)
    ) {
      return;
    }
    setBusy(true);
    try {
      await run();
      toast.success(`${label} · ${people.length} student(s)`);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${label} failed`);
    } finally {
      setBusy(false);
    }
  }

  const everyoneDone = (item: HwItem) =>
    selected != null &&
    people.length > 0 &&
    people.every((p) => local.get(`${p.userId}:${selected.id}:${item}`));

  const counts: Partial<Record<HwItem, number>> = {};
  const lessonIds = new Set(lessons.map((l) => l.id));
  for (const [key, done] of local) {
    if (!done) continue;
    const [userId, lessonId, item] = key.split(":") as [string, string, HwItem];
    if (!lessonIds.has(lessonId) || !ids.includes(userId)) continue;
    counts[item] = (counts[item] ?? 0) + 1;
  }
  const levels = people
    .map((p) => board.get(p.userId)?.overall)
    .filter((v): v is number => v != null);
  const avgLevel = levels.length
    ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length)
    : null;
  const isAfl = subject === "math";
  const columns = `${NAME_COL} repeat(${Math.max(lessons.length, 1)}, minmax(${items.length * 30 + 12}px, 1fr))${isAfl ? " 96px" : ""}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-white">Everyone:</span>
        {items.map((item) => (
          <button
            key={item}
            type="button"
            disabled={busy || !selected}
            aria-pressed={everyoneDone(item)}
            aria-label={`${HW_ITEM_LABEL[item]} for every listed student`}
            onClick={() =>
              void bulk(`${HW_ITEM_LABEL[item]} ${everyoneDone(item) ? "cleared" : "ticked"}`, () =>
                setHwMarks(selected!.id, ids, item, !everyoneDone(item)),
              )
            }
            className={cn(
              "tap h-8 w-8 rounded-full text-xs font-black transition-colors duration-200 disabled:opacity-40",
              everyoneDone(item)
                ? "bg-brand-25 text-brand-900"
                : "bg-brand-800 text-white ring-1 ring-brand-300",
            )}
          >
            {HW_ITEM_LETTER[item]}
          </button>
        ))}
        <div className="ml-auto flex gap-1">
          <IconButton
            icon={Eraser}
            label="Untick all"
            className="text-white hover:bg-brand-500"
            disabled={busy || !selected}
            onClick={() => void bulk("Untick all", () => untickAll(selected!.id, ids))}
          />
          <IconButton
            icon={CheckCheck}
            label="Tick all complete"
            variant="brand"
            disabled={busy || !selected}
            onClick={() => void bulk("Tick all complete", () => tickAllComplete(selected!.id, ids))}
          />
        </div>
      </div>
      <ul className="flex flex-wrap gap-3 text-[11px] text-white" aria-label="Legend">
        {items.map((item) => (
          <li key={item} className="inline-flex items-center gap-1">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-25 text-[10px] font-black text-brand-900">
              {HW_ITEM_LETTER[item]}
            </span>
            {HW_ITEM_LABEL[item]}
          </li>
        ))}
        <li className="inline-flex items-center gap-1">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-800 text-[10px] ring-1 ring-brand-300">
            ·
          </span>
          Not done
        </li>
        <li>* auto from accepted homework</li>
        {isAfl && <li>L = Level, edited in the Level modal</li>}
      </ul>
      <GlowScroll>
        <div role="grid" aria-label={isAfl ? "AFL homework" : "VAR homework"} className="min-w-max">
          <div role="row" className="grid" style={{ gridTemplateColumns: columns }}>
            <div
              role="columnheader"
              className="sticky left-0 z-10 bg-brand-600 px-2 py-2 text-xs font-bold"
            >
              Student
            </div>
            {lessons.map((lesson) => (
              <div
                key={lesson.id}
                role="columnheader"
                className={cn(
                  "flex flex-col items-center gap-1 px-1 py-1",
                  lesson.id === selectedId && "rounded-t-lg bg-brand-500",
                )}
              >
                <button
                  type="button"
                  aria-pressed={lesson.id === selectedId}
                  onClick={() => onSelect(lesson.id)}
                  className="tap text-[11px] font-bold tabular-nums"
                >
                  {shortDate(lesson.lesson_date)}
                </button>
                <div className="flex gap-0.5">
                  {items.map((item) => {
                    const on =
                      people.length > 0 &&
                      people.every((person) => local.get(`${person.userId}:${lesson.id}:${item}`));
                    return (
                      <button
                        key={item}
                        type="button"
                        disabled={busy || people.length === 0}
                        aria-pressed={on}
                        aria-label={`${HW_ITEM_LABEL[item]} for every student on ${shortDate(lesson.lesson_date)}`}
                        onClick={() =>
                          void bulk(
                            `${HW_ITEM_LABEL[item]} ${on ? "cleared" : "ticked"} · ${shortDate(lesson.lesson_date)}`,
                            () => setHwMarks(lesson.id, ids, item, !on),
                            lesson,
                          )
                        }
                        className={cn(
                          "tap h-6 w-6 rounded-full text-[10px] font-black disabled:opacity-40",
                          on
                            ? "bg-brand-25 text-brand-900"
                            : "bg-brand-800 text-white ring-1 ring-brand-300",
                        )}
                      >
                        {HW_ITEM_LETTER[item]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {isAfl && (
              <div
                role="columnheader"
                className="sticky right-0 z-10 bg-brand-600 px-2 py-2 text-center text-xs font-bold"
              >
                L
              </div>
            )}
          </div>
          {people.map((person) => {
            const level = board.get(person.userId);
            return (
              <div
                key={person.userId}
                role="row"
                className="grid border-t border-brand-400/30"
                style={{ gridTemplateColumns: columns }}
              >
                <div
                  role="rowheader"
                  className="sticky left-0 z-10 truncate bg-brand-600 px-2 py-2 text-sm font-bold"
                >
                  {person.name}
                </div>
                {lessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    role="gridcell"
                    className={cn(
                      "flex items-center justify-center gap-1 py-1.5",
                      lesson.id === selectedId && "bg-brand-500",
                    )}
                  >
                    {items.map((item) => {
                      const key = `${person.userId}:${lesson.id}:${item}`;
                      const on = local.get(key) ?? false;
                      const auto = sources.get(key) === "auto";
                      return (
                        <button
                          key={item}
                          type="button"
                          aria-pressed={on}
                          aria-label={`${HW_ITEM_LABEL[item]}, ${person.name}, ${shortDate(lesson.lesson_date)}${auto ? ", auto" : ""}`}
                          onClick={() => void toggle(person, lesson, item)}
                          className={cn(
                            "tap relative h-7 w-7 rounded-full text-[11px] font-black transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200",
                            on
                              ? "bg-brand-25 text-brand-900"
                              : "bg-brand-800 text-brand-200 ring-1 ring-brand-400/50",
                          )}
                        >
                          {HW_ITEM_LETTER[item]}
                          {auto && on && (
                            <span
                              aria-hidden="true"
                              className="absolute -right-0.5 -top-1 text-[10px] text-brand-25"
                            >
                              *
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
                {isAfl && (
                  <div
                    role="gridcell"
                    className="sticky right-0 z-10 flex items-center justify-end gap-1 bg-brand-600 px-1"
                  >
                    <span
                      className="text-xs font-black tabular-nums"
                      title={level?.overall == null ? "No sections scored" : undefined}
                    >
                      {level?.overall ?? "—"}
                    </span>
                    <IconButton
                      icon={Gauge}
                      label={`Edit levels for ${person.name}`}
                      className="h-8 min-w-8 w-8 text-white hover:bg-brand-500"
                      onClick={() => onOpenLevel(person.userId)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </GlowScroll>
      <p className="text-xs font-bold text-white tabular-nums">
        {doneSummary(subject, counts, avgLevel)}
      </p>
    </div>
  );
}
