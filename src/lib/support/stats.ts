import type { SupportSession } from "./api";

const TASHKENT_MS = 5 * 60 * 60 * 1000;
const WEEKS = 26;

export type HeatDay = {
  key: string;
  date: Date;
  count: number;
  sessions: SupportSession[];
};

export type SupportStats = {
  attended: number;
  thisMonth: number;
  weekStreak: number;
  next: SupportSession | null;
};

/** Calendar date in Tashkent, stored as UTC midnight so week math stays stable. */
export function tashkentDay(iso: string): Date {
  const shifted = new Date(new Date(iso).getTime() + TASHKENT_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

export function dayKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function mondayOf(date: Date): Date {
  const dow = date.getUTCDay();
  const delta = dow === 0 ? 6 : dow - 1;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - delta));
}

function addDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

export function completedSessions(sessions: SupportSession[]): SupportSession[] {
  return sessions.filter((session) => session.status === "completed");
}

export function supportStats(sessions: SupportSession[], now = new Date()): SupportStats {
  const done = completedSessions(sessions);
  const today = tashkentDay(now.toISOString());
  const attended = done.length;
  const thisMonth = done.filter((session) => {
    if (!session.starts_at) return false;
    const day = tashkentDay(session.starts_at);
    return day.getUTCFullYear() === today.getUTCFullYear() && day.getUTCMonth() === today.getUTCMonth();
  }).length;

  const weeks = new Set(
    done
      .filter((session) => session.starts_at)
      .map((session) => dayKey(mondayOf(tashkentDay(session.starts_at as string)))),
  );
  let cursor = mondayOf(today);
  if (!weeks.has(dayKey(cursor))) cursor = addDays(cursor, -7);
  let weekStreak = 0;
  while (weeks.has(dayKey(cursor))) {
    weekStreak += 1;
    cursor = addDays(cursor, -7);
  }

  const next =
    sessions
      .filter((session) => {
        if (session.status === "pending") return true;
        if (session.status !== "confirmed" || !session.starts_at) return false;
        const end = session.ends_at ?? session.starts_at;
        return new Date(end).getTime() >= now.getTime();
      })
      .sort((a, b) => {
        const aTime = a.starts_at ? new Date(a.starts_at).getTime() : Number.POSITIVE_INFINITY;
        const bTime = b.starts_at ? new Date(b.starts_at).getTime() : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      })[0] ?? null;

  return { attended, thisMonth, weekStreak, next };
}

export function nextSessionLabel(session: SupportSession, now = new Date()): string {
  if (!session.starts_at) return "Waiting";
  const start = tashkentDay(session.starts_at);
  const today = tashkentDay(now.toISOString());
  const days = Math.round((start.getTime() - today.getTime()) / 86400000);
  const when = days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
  return when;
}

/** Twenty-six Monday-start weeks ending this week. Each cell is one Tashkent day. */
export function heatmapWeeks(sessions: SupportSession[], now = new Date()): HeatDay[][] {
  const done = completedSessions(sessions);
  const byDay = new Map<string, SupportSession[]>();
  for (const session of done) {
    const key = session.starts_at ? dayKey(tashkentDay(session.starts_at)) : "";
    if (!key) continue;
    const list = byDay.get(key) ?? [];
    list.push(session);
    byDay.set(key, list);
  }
  const start = addDays(mondayOf(tashkentDay(now.toISOString())), -(WEEKS - 1) * 7);
  const weeks: HeatDay[][] = [];
  for (let week = 0; week < WEEKS; week += 1) {
    const days: HeatDay[] = [];
    for (let day = 0; day < 7; day += 1) {
      const date = addDays(start, week * 7 + day);
      const key = dayKey(date);
      const list = byDay.get(key) ?? [];
      days.push({ key, date, count: list.length, sessions: list });
    }
    weeks.push(days);
  }
  return weeks;
}

export function heatClass(count: number): string {
  if (count <= 0) return "bg-white/25";
  if (count === 1) return "bg-white/55";
  if (count === 2) return "bg-white/80";
  return "bg-white";
}
