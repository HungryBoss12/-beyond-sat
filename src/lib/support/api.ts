import { supabase } from "@/integrations/supabase/client";
import { tashkentToday } from "@/lib/billing/dates";
import type { ClassSubject } from "@/lib/classes/types";

/** The center is in Tashkent, which does not use daylight saving. */
const TASHKENT_OFFSET = "+05:00";

export type SupportStatus = "pending" | "confirmed" | "rejected" | "completed";

export type SupportMaterial = {
  id: string;
  title: string;
  material_url: string | null;
  test_id: string | null;
};

export type SupportPass = {
  teacher_name: string;
  note: string | null;
};

export type SupportSession = {
  id: string;
  student_id?: string;
  teacher_id: string | null;
  student_name?: string;
  teacher_name: string;
  subject: ClassSubject;
  starts_at: string | null;
  ends_at: string | null;
  preferred_on: string | null;
  expires_at: string | null;
  status: SupportStatus;
  origin?: SupportOrigin;
  notes: string | null;
  rejection_reason: string | null;
  task?: string | null;
  attended?: boolean | null;
  homework_done?: boolean | null;
  slot_id?: string;
  passes?: SupportPass[];
  materials?: SupportMaterial[];
};

export type OpenSlot = {
  slot_id: string;
  teacher_id: string;
  teacher_name: string;
  starts_at: string;
  ends_at: string;
};

export type CenterHours = { opens_at: string; closes_at: string };

// Group RPCs and tables ship ahead of regenerated Database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => any;
};

function raise(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/** `2026-10-11T15:00` from a datetime-local input, read as Tashkent time. */
export function tashkentInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  return `${trimmed.length === 16 ? `${trimmed}:00` : trimmed}${TASHKENT_OFFSET}`;
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

const TASHKENT_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tashkent",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Civil day of a calendar cell, read in Tashkent so it matches the database. */
export function calendarDay(date: Date): string {
  const labeled = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  return TASHKENT_DAY.format(labeled);
}

/** Local midnight of today's date in Tashkent, for the calendar grid. */
export function tashkentCalendarToday(now: Date = new Date()): Date {
  const [year, month, day] = tashkentToday(now).split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/** Local midnight of an instant's Tashkent calendar day. */
export function tashkentCalendarDate(iso: string): Date {
  const [year, month, day] = TASHKENT_DAY.format(new Date(iso)).split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function tashkentFromDay(day: Date, time: string): string {
  return tashkentInput(`${calendarDay(day)}T${time}`);
}

export function subjectLabel(subject: ClassSubject): string {
  return subject === "math" ? "Math" : "English";
}

export async function loadCenterHours(): Promise<CenterHours | null> {
  const { data, error } = await db.from("support_center_hours").select("opens_at,closes_at").limit(1).maybeSingle();
  raise(error);
  return (data as CenterHours | null) ?? null;
}

export async function saveCenterHours(opens: string, closes: string): Promise<void> {
  const { error } = await db.rpc("admin_set_support_hours", { p_opens: opens, p_closes: closes });
  raise(error);
}

export async function loadOpenSlots(): Promise<OpenSlot[]> {
  const { data, error } = await db.rpc("support_open_slots");
  raise(error);
  return (data ?? []) as OpenSlot[];
}

export async function loadMySessions(): Promise<SupportSession[]> {
  const { data, error } = await db.rpc("support_my_sessions");
  raise(error);
  return (data ?? []) as SupportSession[];
}

export type SupportWindow = {
  id: string;
  teacher_id?: string;
  starts_at: string;
  ends_at: string;
  student_id?: string | null;
  teacher_name: string;
  student_name?: string | null;
  closed?: boolean;
};

const STUDENT_BOOKING_KEY = "support_student_booking";

export async function loadStudentBookingOn(): Promise<boolean> {
  const { data, error } = await db.from("app_settings").select("value").eq("key", STUDENT_BOOKING_KEY).maybeSingle();
  raise(error);
  return data?.value === "on";
}

export async function saveStudentBookingOn(on: boolean): Promise<void> {
  const { error } = await db.from("app_settings").upsert(
    { key: STUDENT_BOOKING_KEY, value: on ? "on" : "off" },
    { onConflict: "key" },
  );
  raise(error);
}

export async function postSupportRange(start: string, end: string, teacherId?: string | null): Promise<number> {
  const { data, error } = await db.rpc("teacher_post_support_range", {
    p_start: tashkentInput(start),
    p_end: tashkentInput(end),
    p_teacher: teacherId ?? null,
  });
  raise(error);
  return Number(data ?? 0);
}

export async function loadWindowBoard(): Promise<SupportWindow[]> {
  const { data, error } = await db.rpc("support_window_board");
  raise(error);
  return (data ?? []) as SupportWindow[];
}

export async function assignSupportWindow(
  windowId: string,
  studentName: string,
  subject: ClassSubject,
): Promise<void> {
  const { error } = await db.rpc("staff_assign_support_by_name", {
    p_window_id: windowId,
    p_name: studentName.trim(),
    p_subject: subject,
  });
  raise(error);
}

export async function setSupportWindowOpen(windowId: string, open: boolean): Promise<void> {
  const { error } = await db.rpc("teacher_set_support_window_open", {
    p_window_id: windowId,
    p_open: open,
  });
  raise(error);
}

export async function loadBookableWindows(): Promise<SupportWindow[]> {
  const { data, error } = await db.rpc("support_bookable_windows");
  raise(error);
  return (data ?? []) as SupportWindow[];
}

export async function bookSupportWindow(windowId: string, subject: ClassSubject): Promise<void> {
  const { error } = await db.rpc("student_book_support_window", {
    p_window_id: windowId,
    p_subject: subject,
  });
  raise(error);
}

export async function loadStaffSessions(): Promise<SupportSession[]> {
  const { data, error } = await db.rpc("support_staff_sessions");
  raise(error);
  return (data ?? []) as SupportSession[];
}

export async function requestSupport(
  subject: ClassSubject,
  notes: string,
  day: string,
  start: string,
): Promise<void> {
  const { error } = await db.rpc("student_request_support", {
    p_subject: subject,
    p_notes: notes.trim() || null,
    p_day: day,
    p_start: start,
  });
  raise(error);
}

export async function cancelSupport(sessionId: string): Promise<void> {
  const { error } = await db.rpc("student_cancel_support", { p_session_id: sessionId });
  raise(error);
}

export async function addSupportSlot(start: string, end: string): Promise<void> {
  const { error } = await db.rpc("teacher_add_support_slot", {
    p_start: tashkentInput(start),
    p_end: tashkentInput(end),
    p_teacher_id: null,
  });
  raise(error);
}

export async function deleteSupportSlot(slotId: string): Promise<void> {
  const { error } = await db.rpc("teacher_delete_support_slot", { p_slot_id: slotId });
  raise(error);
}

export async function claimSupport(sessionId: string, start: string | null): Promise<void> {
  const { error } = await db.rpc("teacher_claim_support", {
    p_session_id: sessionId,
    p_start: start,
  });
  raise(error);
}

export async function declineSupport(sessionId: string, note: string): Promise<void> {
  const { error } = await db.rpc("teacher_decline_support", {
    p_session_id: sessionId,
    p_note: note.trim() || null,
  });
  raise(error);
}

export async function setSupportStart(sessionId: string, start: string | null): Promise<void> {
  const { error } = await db.rpc("support_set_start", {
    p_session_id: sessionId,
    p_start: start,
  });
  raise(error);
}

export async function completeSupport(sessionId: string): Promise<void> {
  const { error } = await db.rpc("teacher_complete_support", { p_session_id: sessionId });
  raise(error);
}

export async function addSupportMaterial(input: {
  sessionId: string;
  title: string;
  url?: string;
  testId?: string;
}): Promise<void> {
  const { error } = await db.rpc("teacher_add_support_material", {
    p_session_id: input.sessionId,
    p_title: input.title,
    p_url: input.url ?? null,
    p_test_id: input.testId || null,
  });
  raise(error);
}

export type SupportSlotRow = {
  id: string;
  teacher_id: string;
  starts_at: string;
  ends_at: string;
};

export async function loadOwnSlots(): Promise<SupportSlotRow[]> {
  const { data, error } = await db
    .from("teacher_availability_slots")
    .select("id,teacher_id,starts_at,ends_at")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at");
  raise(error);
  return (data ?? []) as SupportSlotRow[];
}

export type SupportOrigin = "request" | "assigned";
export type SlotState = "free" | "taken" | "mine" | "break";
export type DutyStatus = "off" | "break" | "teaching" | "duty";

export type SupportTeacherOption = { id: string; name: string };
export type TeacherSlot = { id: string; starts_at: string; ends_at: string; state: SlotState };
export type ComingStudent = {
  id: string;
  starts_at: string;
  ends_at: string;
  origin: SupportOrigin;
  attended: boolean | null;
  subject: ClassSubject;
  student_name: string;
  groups: string;
};
export type SupportTeacherCard = {
  id: string;
  name: string;
  status: DutyStatus;
  duty_ends_at: string | null;
  done_count: number;
  planned_count: number;
};
export type NamedSession = {
  id: string;
  starts_at: string;
  ends_at: string;
  origin: SupportOrigin;
  status?: string;
  attended?: boolean | null;
  student_name: string;
  teacher_name?: string;
};
export type TeacherDetail = { done: NamedSession[]; planned: NamedSession[] };

export const DUTY_LABEL: Record<DutyStatus, string> = {
  off: "Not here",
  break: "On break",
  teaching: "Teaching",
  duty: "On duty",
};

export const ORIGIN_LABEL: Record<SupportOrigin, string> = {
  request: "By request",
  assigned: "Assigned",
};

export async function loadSupportTeachers(): Promise<SupportTeacherOption[]> {
  const { data, error } = await db.rpc("support_teacher_directory");
  raise(error);
  return (data ?? []) as SupportTeacherOption[];
}

export async function loadTeacherSlots(teacherId: string): Promise<TeacherSlot[]> {
  const { data, error } = await db.rpc("support_teacher_slots", { p_teacher: teacherId });
  raise(error);
  return (data ?? []) as TeacherSlot[];
}

export async function confirmSupport(sessionId: string): Promise<void> {
  const { error } = await db.rpc("teacher_confirm_support", { p_session_id: sessionId });
  raise(error);
}

export async function setSupportAttendance(sessionId: string, present: boolean): Promise<void> {
  const { error } = await db.rpc("teacher_set_support_attendance", {
    p_session_id: sessionId,
    p_present: present,
  });
  raise(error);
}

export async function startSupportBreak(minutes: number): Promise<void> {
  const { error } = await db.rpc("teacher_start_support_break", { p_minutes: minutes });
  raise(error);
}

export async function loadComingStudents(): Promise<ComingStudent[]> {
  const { data, error } = await db.rpc("support_coming");
  raise(error);
  return (data ?? []) as ComingStudent[];
}

export async function loadAdminTeachers(): Promise<SupportTeacherCard[]> {
  const { data, error } = await db.rpc("admin_support_teachers");
  raise(error);
  return (data ?? []) as SupportTeacherCard[];
}

export async function loadTeacherDetail(teacherId: string): Promise<TeacherDetail> {
  const { data, error } = await db.rpc("admin_support_teacher_detail", { p_teacher: teacherId });
  raise(error);
  return (data ?? { done: [], planned: [] }) as TeacherDetail;
}

export async function prepareSupportWindows(): Promise<void> {
  const { error } = await db.rpc("support_prepare_windows", { p_days: 14 });
  raise(error);
}

export type DaySlot = {
  id: string;
  teacher_id: string;
  teacher_name: string;
  starts_at: string;
  ends_at: string;
  student_id: string | null;
  student_name: string | null;
  session_id: string | null;
  subject: ClassSubject | null;
  attended: boolean | null;
  homework_done: boolean | null;
  task: string | null;
  closed: boolean;
};

/** Tashkent calendar days in [fromDay, toDay] that already have support slots. */
export async function loadScheduledSupportDays(fromDay: string, toDay: string): Promise<string[]> {
  const end = new Date(`${toDay}T12:00:00+05:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  const endDay = TASHKENT_DAY.format(end);
  const { data, error } = await db
    .from("support_windows")
    .select("starts_at")
    .gte("starts_at", tashkentInput(`${fromDay}T00:00`))
    .lt("starts_at", tashkentInput(`${endDay}T00:00`));
  raise(error);
  const days = new Set<string>();
  for (const row of (data ?? []) as { starts_at: string }[]) {
    days.add(TASHKENT_DAY.format(new Date(row.starts_at)));
  }
  return [...days];
}

export async function loadDaySheet(day: string, teacherId?: string | null): Promise<DaySlot[]> {
  const { data, error } = await db.rpc("support_day_sheet", {
    p_day: day,
    p_teacher: teacherId ?? null,
  });
  raise(error);
  return (data ?? []) as DaySlot[];
}

export async function loadReceivedStudents(teacherId?: string | null): Promise<{
  id: string;
  name: string;
  subject: ClassSubject;
  class_name: string;
  sent_by: string;
}[]> {
  const { data, error } = await db.rpc("support_received_students", { p_teacher: teacherId ?? null });
  raise(error);
  return (data ?? []) as {
    id: string;
    name: string;
    subject: ClassSubject;
    class_name: string;
    sent_by: string;
  }[];
}

export type SendBoard = {
  teachers: { id: string; name: string }[];
  students: {
    id: string;
    name: string;
    class_name: string;
    support_teacher_id: string | null;
    support_teacher_name: string | null;
    subject: ClassSubject | null;
  }[];
};

export async function loadSendBoard(): Promise<SendBoard> {
  const { data, error } = await db.rpc("support_send_board");
  raise(error);
  return (data ?? { teachers: [], students: [] }) as SendBoard;
}

export async function sendSupportStudent(
  studentId: string,
  supportTeacherId: string,
  subject: ClassSubject,
): Promise<void> {
  const { error } = await db.rpc("support_send_student", {
    p_student: studentId,
    p_support_teacher: supportTeacherId,
    p_subject: subject,
  });
  raise(error);
}

export async function unsendSupportStudent(studentId: string, supportTeacherId: string): Promise<void> {
  const { error } = await db.rpc("support_unsend_student", {
    p_student: studentId,
    p_support_teacher: supportTeacherId,
  });
  raise(error);
}

export async function clearSupportWindow(windowId: string): Promise<void> {
  const { error } = await db.rpc("support_clear_window", { p_window_id: windowId });
  raise(error);
}

export async function loadGroupStudents(teacherId: string): Promise<{ id: string; name: string }[]> {
  const { data, error } = await db.rpc("support_group_students", { p_teacher: teacherId });
  raise(error);
  return (data ?? []) as { id: string; name: string }[];
}

export async function setSupportTick(
  sessionId: string,
  field: "attendance" | "homework",
  value: boolean,
): Promise<void> {
  const { error } = await db.rpc("support_set_tick", {
    p_session_id: sessionId,
    p_field: field,
    p_value: value,
  });
  raise(error);
}

export async function setSupportTask(sessionId: string, task: string): Promise<void> {
  const { error } = await db.rpc("support_set_task", {
    p_session_id: sessionId,
    p_task: task,
  });
  raise(error);
}

export async function assignSupportStudent(
  windowId: string,
  studentId: string,
  subject: ClassSubject,
): Promise<void> {
  const { error } = await db.rpc("staff_assign_support_window", {
    p_window_id: windowId,
    p_student_id: studentId,
    p_subject: subject,
  });
  raise(error);
}

export async function setSupportDuty(teacherId: string, minutes: number): Promise<void> {
  const { error } = await db.rpc("admin_set_support_duty", {
    p_teacher: teacherId,
    p_minutes: minutes,
  });
  raise(error);
}

export async function loadPublishedTests(): Promise<{ id: string; title: string }[]> {
  const { data, error } = await db
    .from("tests")
    .select("id,title")
    .eq("published", true)
    .order("title")
    .limit(80);
  raise(error);
  return (data ?? []) as { id: string; title: string }[];
}
