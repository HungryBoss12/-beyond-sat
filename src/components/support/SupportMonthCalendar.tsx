import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { WEEKDAYS, monthGridCells } from "@/lib/support/desk";

export function SupportMonthCalendar({
  month,
  selectedDay,
  todayKey,
  counts,
  onMonthChange,
  onSelectDay,
}: {
  month: Date;
  selectedDay: string | null;
  todayKey: string;
  counts: Readonly<Record<string, number>>;
  onMonthChange: (next: Date) => void;
  onSelectDay: (day: string) => void;
}) {
  const { cells } = monthGridCells(month);
  const title = month.toLocaleString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm font-bold"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
        </button>
        <h2 className="text-sm font-black">{title}</h2>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm font-bold"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
        >
          Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold">
        {WEEKDAYS.map((name) => (
          <div key={name}>{name}</div>
        ))}
        {cells.map(({ date, key, inMonth }) => {
          const selected = selectedDay === key;
          const isToday = key === todayKey;
          const booked = counts[key] ?? 0;
          return (
            <button
              key={key}
              type="button"
              data-day={key}
              aria-pressed={selected}
              aria-label={
                booked > 0
                  ? `${key}, ${booked} booked ${booked === 1 ? "session" : "sessions"}`
                  : key
              }
              onClick={() => onSelectDay(key)}
              className={`relative flex flex-col items-center justify-center rounded-lg py-1.5 ${
                selected
                  ? "bg-white text-brand-900"
                  : isToday
                    ? "bg-brand-800 ring-1 ring-white/70"
                    : "bg-brand-800"
              } ${inMonth ? "" : "opacity-40"}`}
            >
              <span className="inline-flex items-center gap-0.5 leading-tight">
                {selected && <Check className="h-3 w-3 shrink-0" aria-hidden="true" />}
                {date.getDate()}
              </span>
              {booked > 0 ? (
                <span
                  data-booked-count={booked}
                  className={`mt-0.5 rounded-full px-1.5 text-[10px] leading-4 font-black tabular-nums ${
                    selected ? "bg-brand-900 text-white" : "bg-white text-brand-900"
                  }`}
                >
                  {booked}
                </span>
              ) : (
                <span className="mt-0.5 h-4" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
