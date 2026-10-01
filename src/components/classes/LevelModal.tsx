import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { CLASS_CONTROL } from "@/components/classes/control";
import {
  saveLevelScores,
  type ClassGroup,
  type GroupLesson,
  type LevelBoardRow,
  type LevelSection,
} from "@/lib/classes/groups";
import {
  LEVEL_MAX,
  LEVEL_MIN,
  levelOverall,
  parseLevelScore,
  stepLevel,
} from "@/lib/classes/level";
import { shortDate } from "@/lib/classes/schedule";
import { tashkentToday } from "@/lib/billing/dates";
import { cn } from "@/lib/utils";

/**
 * One dated assessment: a 400-1000 score per section, empty = no new score.
 * Invalid input blocks Save (no clamping). Ctrl/Cmd+Enter saves; arrows move rows.
 */
export function LevelModal({
  open,
  group,
  sections,
  student,
  board,
  lessons,
  defaultLessonId,
  onClose,
  onSaved,
}: {
  open: boolean;
  group: ClassGroup;
  sections: LevelSection[];
  student: { userId: string; name: string } | null;
  board: LevelBoardRow | null;
  lessons: GroupLesson[];
  defaultLessonId: string | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const today = tashkentToday();
  const [values, setValues] = useState<Record<string, string>>({});
  const [lessonId, setLessonId] = useState("");
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    setValues({});
    const lesson = lessons.find((l) => l.id === defaultLessonId);
    const lessonDate = lesson && lesson.lesson_date <= today ? lesson.lesson_date : today;
    setLessonId(lesson && lesson.lesson_date <= today ? lesson.id : "");
    setDate(lessonDate);
  }, [open, defaultLessonId, lessons, today]);

  const parsed = useMemo(
    () => Object.fromEntries(sections.map((s) => [s.slug, parseLevelScore(values[s.slug] ?? "")])),
    [sections, values],
  );
  const errors = sections.filter((s) => parsed[s.slug]?.kind === "error");
  const entered = sections.filter((s) => parsed[s.slug]?.kind === "ok");
  const current = board?.scores ?? {};
  const before = board?.overall ?? null;
  const preview = levelOverall(
    sections.map((s) => {
      const p = parsed[s.slug];
      return {
        score: p?.kind === "ok" ? p.value : (current[s.slug]?.score ?? null),
        weight: s.weight,
      };
    }),
  );
  const dateError = date > today ? "Not in the future" : null;
  const canSave = entered.length > 0 && errors.length === 0 && !dateError && !busy;

  async function save() {
    if (!student || !canSave) return;
    setBusy(true);
    try {
      const scores = Object.fromEntries(
        entered.map((s) => [s.slug, (parsed[s.slug] as { kind: "ok"; value: number }).value]),
      );
      const count = await saveLevelScores({
        groupId: group.id,
        userId: student.userId,
        assessedOn: date,
        scores,
        lessonId: lessonId || null,
      });
      toast.success(
        `Saved ${count} section${count === 1 ? "" : "s"} · overall ${before ?? "—"} → ${preview ?? "—"}`,
      );
      onClose();
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save levels");
    } finally {
      setBusy(false);
    }
  }

  function step(slug: string, direction: 1 | -1, big: boolean) {
    const p = parsed[slug];
    const base = p?.kind === "ok" ? p.value : (current[slug]?.score ?? null);
    setValues((cur) => ({ ...cur, [slug]: String(stepLevel(base, direction, big)) }));
  }

  return (
    <Dialog open={open && student != null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="flex max-h-[92vh] max-w-xl flex-col gap-3 border-brand-400/40 bg-brand-800 text-white sm:rounded-2xl"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void save();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-white">Edit levels</DialogTitle>
          <DialogDescription className="text-brand-100">
            {student?.name} · {group.name} · {LEVEL_MIN}–{LEVEL_MAX} per section
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs font-bold text-brand-100">
            Assessment date
            <input
              type="date"
              max={today}
              className={CLASS_CONTROL + " mt-1"}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            {dateError && <span className="mt-1 block text-white">{dateError}</span>}
          </label>
          <label className="block text-xs font-bold text-brand-100">
            Lesson (optional)
            <select
              className={CLASS_CONTROL + " mt-1"}
              value={lessonId}
              onChange={(e) => {
                setLessonId(e.target.value);
                const lesson = lessons.find((l) => l.id === e.target.value);
                if (lesson && lesson.lesson_date <= today) setDate(lesson.lesson_date);
              }}
            >
              <option value="">No lesson</option>
              {lessons
                .filter((l) => l.lesson_date <= today)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {shortDate(l.lesson_date)}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-brand-400/30 overflow-y-auto pr-1">
          {sections.map((section, index) => {
            const p = parsed[section.slug];
            const now = current[section.slug];
            return (
              <li key={section.id} className="flex items-center gap-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <label htmlFor={`lvl-${section.id}`} className="block truncate text-sm font-bold">
                    {section.name}
                  </label>
                  <span className="text-[11px] text-brand-100 tabular-nums">
                    {now ? `${now.score} · ${now.assessed_on}` : "No score yet"}
                    {p?.kind === "error" && (
                      <span className="ml-2 font-bold text-white">{p.message}</span>
                    )}
                  </span>
                </div>
                <IconButton
                  icon={Minus}
                  label={`Lower ${section.name} by 10 (Shift: 50)`}
                  className="h-8 min-w-8 w-8 text-white hover:bg-brand-500"
                  onClick={(event) => step(section.slug, -1, event.shiftKey)}
                />
                <input
                  id={`lvl-${section.id}`}
                  ref={(el) => {
                    inputs.current[index] = el;
                  }}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="—"
                  aria-invalid={p?.kind === "error" || undefined}
                  value={values[section.slug] ?? ""}
                  onChange={(e) =>
                    setValues((cur) => ({
                      ...cur,
                      [section.slug]: e.target.value.replace(/\D/g, ""),
                    }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      inputs.current[index + 1]?.focus();
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      inputs.current[index - 1]?.focus();
                    }
                  }}
                  className={cn(
                    "h-9 w-20 rounded-lg border bg-brand-600 text-center font-bold tabular-nums text-white outline-none focus:ring-2 focus:ring-brand-200",
                    p?.kind === "error"
                      ? "border-brand-25 ring-2 ring-brand-25/60"
                      : "border-brand-400/50",
                  )}
                />
                <IconButton
                  icon={Plus}
                  label={`Raise ${section.name} by 10 (Shift: 50)`}
                  className="h-8 min-w-8 w-8 text-white hover:bg-brand-500"
                  onClick={(event) => step(section.slug, 1, event.shiftKey)}
                />
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-400/30 pt-3">
          <p className="text-sm tabular-nums">
            New overall <span className="font-black">{preview ?? "—"}</span>
            <span className="text-brand-100"> (now {before ?? "—"})</span>
          </p>
          <div className="flex gap-2">
            <button type="button" className="tap px-4 py-2 text-sm font-bold" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={() => void save()}
              className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              Save {entered.length || ""}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
