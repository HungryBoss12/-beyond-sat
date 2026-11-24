import { tashkentToday } from "@/lib/billing/dates";
import type { ClassSubject } from "@/lib/classes/types";
import type { DaySlot } from "./api";

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const SUPPORT_BOARDS: readonly { subject: ClassSubject; label: string }[] = [
  { subject: "ebrw", label: "English" },
  { subject: "math", label: "Math" },
];

export type MonthGridCell = {
  date: Date;
  key: string;
  inMonth: boolean;
};

export type SlotRow = {
  id: string;
  startsAt: string;
  endsAt: string;
  window: DaySlot | null;
  note: string;
};

const TASHKENT_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tashkent",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function civilDayKey(day: Date): string {
  const month = String(day.getMonth() + 1).padStart(2, "0");
  const date = String(day.getDate()).padStart(2, "0");
  return `${day.getFullYear()}-${month}-${date}`;
}

export type SupportDeskTab = "booked" | "students";

export function resolveSupportDeskTab(
  preferred: SupportDeskTab | null,
  state: { comingCount: number; receivedCount: number; loadingComing: boolean },
): SupportDeskTab {
  if (preferred) return preferred;
  if (!state.loadingComing && state.comingCount === 0 && state.receivedCount > 0) {
    return "students";
  }
  return "booked";
}

export function initialSupportDay(now: Date = new Date()): string {
  return tashkentToday(now);
}

export function tashkentDayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return TASHKENT_DAY.format(date);
}

export function monthGridCells(anchor: Date): {
  cells: MonthGridCell[];
  fromDay: string;
  toDay: string;
} {
  const targetMonth = anchor.getMonth();
  const first = new Date(anchor.getFullYear(), targetMonth, 1);
  const startPad = (first.getDay() + 6) % 7;
  const cursor = new Date(first);
  cursor.setDate(1 - startPad);
  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(cursor);
    date.setDate(cursor.getDate() + index);
    return {
      date,
      key: civilDayKey(date),
      inMonth: date.getMonth() === targetMonth,
    };
  });
  return {
    cells,
    fromDay: cells[0].key,
    toDay: cells[cells.length - 1].key,
  };
}

export function visibleBoards(
  own: boolean,
  selfSubject: ClassSubject | null | undefined,
  slots: DaySlot[],
): { subject: ClassSubject; label: string }[] {
  if (!own) return [...SUPPORT_BOARDS];
  if (selfSubject === "ebrw" || selfSubject === "math") {
    return SUPPORT_BOARDS.filter((board) => board.subject === selfSubject);
  }
  const inferred = slots.find(
    (slot) => slot.subject === "ebrw" || slot.subject === "math",
  )?.subject;
  if (inferred) {
    return SUPPORT_BOARDS.filter((board) => board.subject === inferred);
  }
  return [{ subject: "ebrw", label: "Sessions" }];
}

function toSlotRow(window: DaySlot): SlotRow {
  return {
    id: window.id,
    startsAt: window.starts_at,
    endsAt: window.ends_at,
    window,
    note: window.task || window.note || "",
  };
}

function slotSubject(
  slot: DaySlot,
  teacherSubjects?: ReadonlyMap<string, ClassSubject | null>,
): ClassSubject | null {
  return slot.subject ?? teacherSubjects?.get(slot.teacher_id) ?? null;
}

function buildFreeSlotRow(
  slot: DaySlot,
  freeSlots: DaySlot[],
  subject: ClassSubject,
  picked: Record<string, string>,
  allowed: Set<string> | null,
  defaultTeacherId: string | null,
): SlotRow {
  const teacherId = picked[`${subject}:${slot.starts_at}`] || defaultTeacherId || "";
  const sameTime = freeSlots.filter(
    (item) => item.starts_at === slot.starts_at && (!allowed || allowed.has(item.teacher_id)),
  );
  const window =
    sameTime.find((item) => item.teacher_id === teacherId) ??
    (sameTime.length === 1 ? sameTime[0] : null);
  const noted = window?.note || sameTime.find((item) => item.note)?.note || "";
  return {
    id: window?.id ?? `free:${slot.starts_at}`,
    startsAt: slot.starts_at,
    endsAt: slot.ends_at,
    window,
    note: window?.task || noted,
  };
}

function collectFreeStartSlots(
  freeSlots: DaySlot[],
  filledStarts: ReadonlySet<string>,
  allowed: Set<string> | null,
): DaySlot[] {
  const byStart = new Map<string, DaySlot>();
  for (const slot of freeSlots) {
    if (filledStarts.has(slot.starts_at) || byStart.has(slot.starts_at)) continue;
    if (allowed && !allowed.has(slot.teacher_id)) continue;
    byStart.set(slot.starts_at, slot);
  }
  return [...byStart.values()];
}

export function buildHandoffRows(input: {
  subject: ClassSubject;
  slots: DaySlot[];
  past: boolean;
  picked: Record<string, string>;
  allowed: Set<string> | null;
  own: boolean;
  defaultTeacherId: string | null;
  teacherSubjects?: ReadonlyMap<string, ClassSubject | null>;
}): SlotRow[] {
  const { subject, slots, past, picked, allowed, own, defaultTeacherId, teacherSubjects } = input;
  const visible = slots.filter((slot) => !slot.closed || Boolean(slot.student_id));
  if (own) {
    return visible
      .filter((slot) => Boolean(slot.student_id) || !past)
      .map(toSlotRow)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  const filled = visible.filter(
    (slot) => Boolean(slot.student_id) && slotSubject(slot, teacherSubjects) === subject,
  );
  if (past) {
    return filled.map(toSlotRow).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  const filledStarts = new Set(filled.map((slot) => slot.starts_at));
  const freeSlots = visible.filter((slot) => !slot.closed && !slot.student_id);
  const openRows = collectFreeStartSlots(freeSlots, filledStarts, allowed).map((slot) =>
    buildFreeSlotRow(slot, freeSlots, subject, picked, allowed, defaultTeacherId),
  );

  return [...filled.map(toSlotRow), ...openRows].sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt),
  );
}
