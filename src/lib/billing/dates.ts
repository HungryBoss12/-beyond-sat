/** Calendar helpers in Asia/Tashkent, matching SQL bs_tashkent_today(). */

const TASHKENT_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tashkent",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "2026-10-01" */
export function tashkentToday(now: Date = new Date()): string {
  return TASHKENT_DAY.format(now);
}

/** "2026-10" */
export function tashkentMonth(now: Date = new Date()): string {
  return tashkentToday(now).slice(0, 7);
}

/** First day of the month of a "YYYY-MM-DD" or "YYYY-MM" string. */
export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

const MONTH_LABEL = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "October 2026" for a period like "2026-10-01". */
export function periodLabel(period: string | null | undefined): string {
  if (!period) return "—";
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return MONTH_LABEL.format(new Date(Date.UTC(y, m - 1, 1)));
}
