import type { SupportSession } from "@/lib/support/api";
import { heatClass, heatmapWeeks, type HeatDay } from "@/lib/support/stats";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function monthMarks(weeks: HeatDay[][]): (string | null)[] {
  let last = -1;
  return weeks.map((week) => {
    const month = week[0]?.date.getUTCMonth() ?? -1;
    if (month < 0 || month === last) return null;
    last = month;
    return MONTHS[month] ?? null;
  });
}

function dayLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

/** Six months of completed support days, white cells on the blue panel. */
export function SupportHeatmap({ sessions }: { sessions: SupportSession[] }) {
  const weeks = heatmapWeeks(sessions);
  const months = monthMarks(weeks);
  const any = weeks.some((week) => week.some((day) => day.count > 0));

  return (
    <div className="shrink-0">
      <p className="text-xs font-bold text-white">
        {any ? "Completed sessions, last six months" : "No completed sessions to shade yet"}
      </p>
      <div className="mt-3 overflow-x-auto">
        <div className="flex gap-1">
          {months.map((mark, index) => (
            <span key={weeks[index]?.[0]?.key ?? index} className="w-3.5 text-[10px] font-bold text-white">
              {mark ?? ""}
            </span>
          ))}
        </div>
        <div className="mt-1 flex gap-1">
          {weeks.map((week) => (
            <div key={week[0]?.key} className="flex flex-col gap-1">
              {week.map((day) => (
                <span
                  key={day.key}
                  title={
                    day.count === 0
                      ? `${dayLabel(day.date)} · No sessions`
                      : `${dayLabel(day.date)} · ${day.count} session${day.count === 1 ? "" : "s"}`
                  }
                  className={`h-3.5 w-3.5 rounded-sm ${heatClass(day.count)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
