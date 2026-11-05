import { useMemo } from "react";
import type { LessonAttendance } from "@/lib/classes";

type DayCell = {
  date: string; // YYYY-MM-DD
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
};

export type ParticipationGrid = {
  cells: DayCell[];
  monthLabels: { label: string; col: number }[];
  total: number;
};

function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function startOfWeekSunday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

/** Columns = weeks, rows = Sun→Sat. `today` is injectable for tests. */
export function buildParticipationGrid(
  rows: Pick<LessonAttendance, "lesson_date" | "participated">[],
  weeks = 26,
  today = new Date(),
): ParticipationGrid {
  const byDate = new Map<string, number>();
  for (const r of rows) {
    if (!r.participated) continue;
    byDate.set(r.lesson_date, (byDate.get(r.lesson_date) ?? 0) + 1);
  }

  const day = new Date(today);
  day.setHours(0, 0, 0, 0);
  const todayKey = ymd(day);
  const end = startOfWeekSunday(day);
  end.setDate(end.getDate() + 6);
  const start = new Date(end);
  start.setDate(start.getDate() - (weeks * 7 - 1));

  const list: DayCell[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const key = ymd(cursor);
    const count = byDate.get(key) ?? 0;
    const level: DayCell["level"] =
      count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count === 3 ? 3 : 4;
    list.push({ date: key, count, level, future: key > todayKey });
    cursor.setDate(cursor.getDate() + 1);
  }

  const labels: { label: string; col: number }[] = [];
  let lastMonth = -1;
  let lastCol = -99;
  for (let i = 0; i < list.length; i += 7) {
    const d = new Date(list[i].date + "T12:00:00");
    const m = d.getMonth();
    const col = Math.floor(i / 7);
    // A full name needs about three week-columns. Skip a month that would paint on top of the previous one.
    if (m !== lastMonth && col - lastCol >= 3) {
      labels.push({
        label: d.toLocaleString("en", { month: "short" }),
        col,
      });
      lastMonth = m;
      lastCol = col;
    }
  }

  let sum = 0;
  for (const c of list) sum += c.count;
  return { cells: list, monthLabels: labels, total: sum };
}

/**
 * GitHub-style contribution heatmap for lesson participation.
 * Columns = weeks, rows = Sun→Sat. Scales to the panel width — no overflow scroll.
 */
export function AttendanceGrid({
  rows,
  weeks = 26,
  title = "Lesson participation",
}: {
  rows: LessonAttendance[];
  weeks?: number;
  title?: string;
}) {
  const { cells, monthLabels, total } = useMemo(
    () => buildParticipationGrid(rows, weeks),
    [rows, weeks],
  );

  const cols = Math.ceil(cells.length / 7);
  const gridCols = `1.75rem repeat(${cols}, minmax(0, 1fr))`;

  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <p className="text-xs text-white">
            {total} lesson{total === 1 ? "" : "s"} attended in the last {weeks} weeks
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-[10px] text-brand-200">
          Less
          {[0, 1, 2, 3, 4].map((l) => (
            <span
              key={l}
              className={`h-2.5 w-2.5 rounded-sm ${levelClass(l as DayCell["level"])}`}
            />
          ))}
          More
        </div>
      </div>

      <div className="w-full min-w-0">
        <div
          className="mb-1 grid gap-[3px] text-[10px] text-brand-200"
          style={{ gridTemplateColumns: gridCols }}
        >
          <span />
          {Array.from({ length: cols }, (_, col) => {
            const lab = monthLabels.find((m) => m.col === col);
            return (
              <span key={col} className="relative h-3">
                {lab ? (
                  <span className="absolute left-0 top-0 z-10 whitespace-nowrap">{lab.label}</span>
                ) : null}
              </span>
            );
          })}
        </div>
        <div
          className="grid grid-flow-col grid-rows-7 gap-[3px]"
          style={{ gridTemplateColumns: gridCols }}
        >
          {["", "M", "", "W", "", "F", ""].map((lab, row) => (
            <span
              key={`lab-${row}`}
              className="text-[9px] leading-none text-brand-200"
              style={{ gridRow: row + 1, gridColumn: 1 }}
            >
              {lab}
            </span>
          ))}
          {cells.map((c, i) => {
            const col = Math.floor(i / 7) + 2;
            const row = (i % 7) + 1;
            return (
              <span
                key={c.date}
                title={`${c.date}: ${c.count} lesson${c.count === 1 ? "" : "s"}`}
                className={`aspect-square w-full rounded-[2px] ${c.future ? "bg-transparent" : levelClass(c.level)}`}
                style={{ gridRow: row, gridColumn: col }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function levelClass(level: DayCell["level"]): string {
  switch (level) {
    case 0:
      return "bg-brand-800";
    case 1:
      return "bg-brand-400/40";
    case 2:
      return "bg-brand-400/65";
    case 3:
      return "bg-brand-400";
    case 4:
      return "bg-brand-200";
  }
}
