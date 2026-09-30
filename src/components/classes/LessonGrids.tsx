import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import type { ClassLesson, VarMark } from "@/lib/classes/classroom";
import { setAttendanceState, setVarFlag, tickAllComplete } from "@/lib/classes/classroom";
import type { VarKind } from "@/lib/classes/types";

type Person = { userId: string; name: string };

const FLAGS: { key: VarKind; label: string; title: string }[] = [
  { key: "vocab", label: "V", title: "VOCABULARY" },
  { key: "assignment", label: "A", title: "ASSIGNMENT" },
  { key: "article", label: "R", title: "ARTICLE" },
];

function cycle(state: "present" | "absent" | "empty"): "present" | "absent" | "empty" {
  if (state === "present") return "absent";
  if (state === "absent") return "empty";
  return "present";
}

export function AttendanceLessonGrid({
  classId,
  lessons,
  people,
  present,
  absent,
  onChange,
}: {
  classId: string;
  lessons: ClassLesson[];
  people: Person[];
  present: Set<string>;
  absent: Set<string>;
  onChange: () => Promise<void>;
}) {
  const [focus, setFocus] = useState(0);
  const cells = people.length * Math.max(lessons.length, 1);

  async function toggle(person: Person, lesson: ClassLesson) {
    const key = `${person.userId}:${lesson.lesson_date}:${lesson.subject ?? ""}`;
    const state = present.has(key) ? "present" : absent.has(key) ? "absent" : "empty";
    const next = cycle(state);
    try {
      await setAttendanceState({
        classId,
        userId: person.userId,
        lessonDate: lesson.lesson_date,
        subject: lesson.subject,
        state: next,
      });
      await onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save attendance");
    }
  }

  const marked = present.size + absent.size;
  return (
    <div>
      <div className="overflow-x-auto">
        <div role="grid" aria-label="Attendance" className="min-w-[640px]">
          <div
            role="row"
            className="grid"
            style={{
              gridTemplateColumns: `180px repeat(${lessons.length || 1}, minmax(72px, 1fr))`,
            }}
          >
            <div className="sticky left-0 bg-brand-600 px-2 py-2 text-xs font-bold uppercase text-white">
              STUDENT
            </div>
            {lessons.map((lesson) => (
              <div
                key={lesson.id}
                className="px-1 py-2 text-center text-[11px] font-bold text-white"
              >
                {lesson.subject === "math" ? "MATH " : lesson.subject === "ebrw" ? "ENG " : ""}
                {lesson.lesson_date.slice(8)}
              </div>
            ))}
          </div>
          {people.map((person, row) => (
            <div
              key={person.userId}
              role="row"
              className="grid border-t border-brand-400/30"
              style={{
                gridTemplateColumns: `180px repeat(${lessons.length || 1}, minmax(72px, 1fr))`,
              }}
            >
              <div className="sticky left-0 bg-brand-600 px-2 py-2 text-sm font-bold">
                {person.name}
              </div>
              {lessons.map((lesson, col) => {
                const key = `${person.userId}:${lesson.lesson_date}:${lesson.subject ?? ""}`;
                const state = present.has(key) ? "present" : absent.has(key) ? "absent" : "empty";
                const index = row * lessons.length + col;
                return (
                  <button
                    key={lesson.id}
                    role="gridcell"
                    tabIndex={index === focus ? 0 : -1}
                    aria-label={`${state} for ${person.name} on ${lesson.lesson_date}`}
                    aria-pressed={state === "present"}
                    onFocus={() => setFocus(index)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowRight") setFocus(Math.min(cells - 1, focus + 1));
                      if (event.key === "ArrowLeft") setFocus(Math.max(0, focus - 1));
                    }}
                    onClick={() => void toggle(person, lesson)}
                    className="tap grid h-10 place-items-center text-white"
                  >
                    {state === "present" ? (
                      <Check className="h-4 w-4" />
                    ) : state === "absent" ? (
                      <X className="h-4 w-4" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs font-bold text-brand-100">
        {present.size} PRESENT · {absent.size} ABSENT · {marked} MARKED
      </p>
    </div>
  );
}

export function VarLessonGrid({
  classId,
  lessons,
  people,
  marks,
  selectedLessonId,
  onSelectLesson,
  onChange,
}: {
  classId: string;
  lessons: ClassLesson[];
  people: Person[];
  marks: VarMark[];
  selectedLessonId: string | null;
  onSelectLesson: (id: string) => void;
  onChange: () => Promise<void>;
}) {
  const byKey = useMemo(() => {
    const map = new Map<string, VarMark>();
    for (const mark of marks) map.set(`${mark.user_id}:${mark.lesson_id}`, mark);
    return map;
  }, [marks]);

  async function toggle(person: Person, lesson: ClassLesson, flag: VarKind) {
    const mark = byKey.get(`${person.userId}:${lesson.id}`);
    const current = mark ? mark[flag] : false;
    onSelectLesson(lesson.id);
    try {
      await setVarFlag({
        classId,
        lessonId: lesson.id,
        userId: person.userId,
        flag,
        value: !current,
      });
      await onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save VAR");
    }
  }

  async function tickAll() {
    const lesson = lessons.find((item) => item.id === selectedLessonId) ?? lessons[0];
    if (!lesson) return;
    if (!confirm("Mark the filtered students present and complete V, A, and R for this lesson?"))
      return;
    try {
      await tickAllComplete(
        lesson.id,
        people.map((person) => person.userId),
      );
      toast.success("Lesson marked complete");
      await onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tick all failed");
    }
  }

  const totals = { vocab: 0, assignment: 0, article: 0 };
  for (const mark of marks) {
    if (mark.vocab) totals.vocab += 1;
    if (mark.assignment) totals.assignment += 1;
    if (mark.article) totals.article += 1;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void tickAll()}
          className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-xs font-bold text-white"
        >
          Tick all complete
        </button>
        <span className="text-xs font-bold uppercase text-white">
          VAR · V VOCABULARY · A ASSIGNMENT · R ARTICLE
        </span>
      </div>
      <div className="overflow-x-auto">
        <div role="grid" aria-label="VAR homework" className="min-w-[720px]">
          {people.map((person) => (
            <div
              key={person.userId}
              className="grid border-t border-brand-400/30"
              style={{
                gridTemplateColumns: `180px repeat(${lessons.length || 1}, minmax(120px, 1fr))`,
              }}
            >
              <div className="sticky left-0 bg-brand-600 px-2 py-2 text-sm font-bold">
                {person.name}
              </div>
              {lessons.map((lesson) => {
                const mark = byKey.get(`${person.userId}:${lesson.id}`);
                return (
                  <div
                    key={lesson.id}
                    className="flex justify-center gap-1 py-2"
                    onClick={() => onSelectLesson(lesson.id)}
                  >
                    {FLAGS.map((flag) => {
                      const on = Boolean(mark?.[flag.key]);
                      const source = mark?.[`${flag.key}_source` as "vocab_source"];
                      return (
                        <button
                          key={flag.key}
                          type="button"
                          aria-pressed={on}
                          title={flag.title + (source === "auto" ? " · auto" : "")}
                          aria-label={`${flag.title} for ${person.name} on ${lesson.lesson_date}`}
                          onClick={() => void toggle(person, lesson, flag.key)}
                          className={
                            "tap h-7 w-7 rounded-full text-[11px] font-black " +
                            (on
                              ? "bg-brand-400 text-white"
                              : "bg-brand-800 text-brand-100 ring-1 ring-brand-400/40")
                          }
                        >
                          {flag.label}
                          {source === "auto" && on ? <span className="sr-only"> auto</span> : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs font-bold text-brand-100">
        DONE: {totals.vocab} VOCABULARY · {totals.assignment} ASSIGNMENT · {totals.article} ARTICLE
      </p>
    </div>
  );
}
