import { tashkentToday } from "@/lib/billing/dates";

/** The Tashkent calendar day `days` before `today` ("YYYY-MM-DD"). */
export function tashkentDayOffset(days: number, now: Date = new Date()): string {
  const [y, m, d] = tashkentToday(now).split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d! - days));
  return date.toISOString().slice(0, 10);
}

/**
 * `current_streak` only changes on the next activity, so a student who stopped
 * would keep showing their old streak. It counts only while the last activity
 * (vocab or daily test) was today or yesterday in Tashkent.
 */
export function liveStreak(
  profile: {
    current_streak?: number | null;
    last_active_at?: string | null;
    last_daily_completed_date?: string | null;
  } | null,
  now: Date = new Date(),
): number {
  if (!profile?.current_streak) return 0;
  const days = [
    profile.last_active_at ? tashkentToday(new Date(profile.last_active_at)) : null,
    profile.last_daily_completed_date ?? null,
  ].filter((d): d is string => Boolean(d));
  if (!days.length) return 0;
  const latest = days.sort().at(-1)!;
  return latest >= tashkentDayOffset(1, now) ? profile.current_streak : 0;
}
