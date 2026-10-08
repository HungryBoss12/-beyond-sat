import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarClock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MINUTES = [0, 15, 30, 45];

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatLabel(date: Date, dateOnly: boolean): string {
  const day = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (dateOnly) return day;
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${day}, ${hh}:${mm}`;
}

function parseFieldValue(value: string, dateOnly: boolean): Date {
  if (dateOnly && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toDateOnly(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Month grid plus hour and minute lists. No native date or select controls. */
export function DateTimeField({
  value,
  onChange,
  dateOnly = false,
}: {
  value: string;
  onChange: (iso: string) => void;
  /** Emit `YYYY-MM-DD` and hide the clock. */
  dateOnly?: boolean;
}) {
  const safe = parseFieldValue(value, dateOnly);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => startOfMonth(safe));

  const days = useMemo(() => {
    const first = startOfMonth(cursor);
    const lead = (first.getDay() + 6) % 7;
    const cells: Array<Date | null> = Array.from({ length: lead }, () => null);
    const count = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= count; day += 1) {
      cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), day, safe.getHours(), safe.getMinutes()));
    }
    return cells;
  }, [cursor, safe]);

  function commit(next: Date) {
    onChange(dateOnly ? toDateOnly(next) : next.toISOString());
  }

  function pickDay(day: Date) {
    const next = new Date(day);
    next.setHours(safe.getHours(), safe.getMinutes(), 0, 0);
    commit(next);
    if (dateOnly) setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex w-full items-center gap-2 rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2 text-left text-sm font-semibold text-white transition duration-200 hover:border-brand-200"
        >
          <CalendarClock className="h-4 w-4 text-brand-100" />
          {value ? formatLabel(safe, dateOnly) : dateOnly ? "Choose a date" : "Choose date and time"}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[320px] border-brand-400/40 bg-brand-600 p-3 text-white shadow-panel data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-md hover:bg-brand-800"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-bold">
            {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </p>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-md hover:bg-brand-800"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-brand-100">
          {WEEKDAYS.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((day, index) =>
            day ? (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => pickDay(day)}
                className={
                  "h-8 rounded-md text-xs font-bold transition duration-150 " +
                  (sameDay(day, safe) ? "bg-brand-400 text-white" : "hover:bg-brand-800")
                }
              >
                {day.getDate()}
              </button>
            ) : (
              <span key={`empty-${index}`} />
            ),
          )}
        </div>
        {!dateOnly && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-brand-100">Hour</p>
            <div className="grid max-h-28 grid-cols-4 gap-1 overflow-y-auto">
              {Array.from({ length: 24 }, (_, hour) => (
                <button
                  key={hour}
                  type="button"
                  onClick={() => {
                    const next = new Date(safe);
                    next.setHours(hour, safe.getMinutes(), 0, 0);
                    commit(next);
                  }}
                  className={
                    "rounded-md py-1 text-xs font-bold transition duration-150 " +
                    (safe.getHours() === hour ? "bg-brand-400 text-white" : "bg-brand-800 hover:bg-brand-900")
                  }
                >
                  {String(hour).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-brand-100">Minute</p>
            <div className="grid grid-cols-2 gap-1">
              {MINUTES.map((minute) => (
                <button
                  key={minute}
                  type="button"
                  onClick={() => {
                    const next = new Date(safe);
                    next.setMinutes(minute, 0, 0);
                    commit(next);
                  }}
                  className={
                    "rounded-md py-1 text-xs font-bold transition duration-150 " +
                    (safe.getMinutes() === minute ? "bg-brand-400 text-white" : "bg-brand-800 hover:bg-brand-900")
                  }
                >
                  {String(minute).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>
        </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
