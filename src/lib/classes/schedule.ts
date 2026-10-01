import { DAY_LABELS } from "./classroom";

type Schedule = {
  schedule_days: number[] | null;
  start_time: string | null;
  end_time: string | null;
};

/** "Mon Wed Fri · 14:00–15:30", or "No schedule set". */
export function scheduleLine(group: Schedule): string {
  const days = (group.schedule_days ?? [])
    .slice()
    .sort((a, b) => a - b)
    .map((day) => DAY_LABELS[day - 1])
    .filter(Boolean)
    .join(" ");
  const time = [group.start_time?.slice(0, 5), group.end_time?.slice(0, 5)]
    .filter(Boolean)
    .join("–");
  if (!days && !time) return "No schedule set";
  return [days, time].filter(Boolean).join(" · ");
}

/** "2 Oct" for a lesson date. */
export function shortDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${d} ${months[(m ?? 1) - 1]}`;
}
