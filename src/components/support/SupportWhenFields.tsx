import { CLASS_CONTROL } from "@/components/classes/control";
import { Calendar } from "@/components/ui/calendar";
import { SupportTimeWheel } from "@/components/support/SupportTimeWheel";
import { tashkentCalendarToday, type CenterHours } from "@/lib/support/api";

/** Date calendar. Pass center hours to show the time wheel beside it. */
export function SupportWhenFields({
  day,
  onDay,
  time,
  onTime,
  showTime = false,
  hours,
}: {
  day: Date | undefined;
  onDay: (day: Date) => void;
  time?: string;
  onTime?: (time: string) => void;
  showTime?: boolean;
  hours?: CenterHours | null;
}) {
  return (
    <div className={hours !== undefined ? "flex items-start gap-3 text-white" : "text-white"}>
      <Calendar
        mode="single"
        selected={day}
        onSelect={(next) => {
          if (next) onDay(next);
        }}
        disabled={{ before: tashkentCalendarToday() }}
        className="bg-transparent p-0 text-white"
      />
      {hours !== undefined && (
        <div className="min-w-0 flex-1 select-none pt-6">
          <p className="mb-2 text-xs font-bold text-white">Time</p>
          <SupportTimeWheel hours={hours} value={time ?? ""} onChange={(next) => onTime?.(next)} />
        </div>
      )}
      {showTime && hours === undefined && (
        <label className="mt-3 block text-xs font-bold">
          Time
          <input
            className={CLASS_CONTROL + " mt-1"}
            type="time"
            value={time ?? ""}
            onChange={(event) => onTime?.(event.target.value)}
          />
        </label>
      )}
    </div>
  );
}
