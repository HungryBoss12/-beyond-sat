import { useMemo } from "react";
import type { LessonAttendance } from "@/lib/classes";

type DayCell = {
  date: string; // YYYY-MM-DD
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
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
  const { cells, monthLabels, total } = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const r of rows) {
      if (!r.participated) continue;
      byDate.set(r.lesson_date, (byDate.get(r.lesson_date) ?? 0) + 1);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = startOfWeekSunday(today);
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
      list.push({ date: key, count, level });
      cursor.setDate(cursor.getDate() + 1);
    }

    const labels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    for (let i = 0; i < list.length; i += 7) {
      const d = new Date(list[i].date + "T12:00:00");
      const m = d.getMonth();
      if (m !== lastMonth) {
        labels.push({
          label: d.toLocaleString("en", { month: "short" }),
          col: Math.floor(i / 7),
        });
        lastMonth = m;
      }
    }

    let sum = 0;
    for (const c of byDate.values()) sum += c;
    return { cells: list, monthLabels: labels, total: sum };
  }, [rows, weeks]);

  const cols = Math.ceil(cells.length / 7);
  const gridCols = `1.75rem repeat(${cols}, minmax(0, 1fr))`;

  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <p className="text-xs text-brand-100">
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
              <span key={col} className="truncate text-center">
                {lab?.label ?? ""}
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
                className={`aspect-square w-full rounded-[2px] ${levelClass(c.level)}`}
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
