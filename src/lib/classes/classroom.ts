import { supabase } from "@/integrations/supabase/client";
import type { ClassSubject, MemberStatus, VarKind, VarSource } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as any;

export type ClassLesson = {
  id: string;
  class_id: string;
  lesson_date: string;
  subject: ClassSubject | null;
  topic: string | null;
};

export type VarMark = {
  lesson_id: string;
  user_id: string;
  vocab: boolean;
  assignment: boolean;
  article: boolean;
  vocab_source: VarSource | null;
  assignment_source: VarSource | null;
  article_source: VarSource | null;
};

export type StudentScore = {
  user_id: string;
  rw: number;
  math: number;
};

export const CLASS_COLS =
  "id,name,description,active,created_at,schedule_days,start_time,end_time,room,level,teacher_id,starts_on,math_schedule_days,math_start_time,math_end_time,ebrw_schedule_days,ebrw_start_time,ebrw_end_time";

export async function ensureClassLessons(classId: string, month: string): Promise<number> {
  const { data, error } = await db.rpc("ensure_class_lessons", {
    p_class_id: classId,
    p_month: `${month}-01`,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function listClassLessons(classId: string, month: string): Promise<ClassLesson[]> {
  const start = `${month}-01`;
  const endDate = new Date(`${month}-01T00:00:00`);
  endDate.setMonth(endDate.getMonth() + 1);
  const end = endDate.toISOString().slice(0, 10);
  const { data, error } = await db
    .from("class_lessons")
    .select("id,class_id,lesson_date,subject,topic")
    .eq("class_id", classId)
    .gte("lesson_date", start)
    .lt("lesson_date", end)
    .order("lesson_date");
  if (error) throw error;
  return (data ?? []) as ClassLesson[];
}

export async function addClassLesson(classId: string, lessonDate: string): Promise<void> {
  const { error } = await db.from("class_lessons").insert({
    class_id: classId,
    lesson_date: lessonDate,
    subject: null,
  });
  if (error) throw error;
}

export async function setAttendanceState(input: {
  classId: string;
  userId: string;
  lessonDate: string;
  subject?: ClassSubject | null;
  state: "present" | "absent" | "empty";
}): Promise<void> {
  const { error } = await db.rpc("set_attendance", {
    p_class_id: input.classId,
    p_user_id: input.userId,
    p_lesson_date: input.lessonDate,
    p_subject: input.subject ?? null,
    p_state: input.state,
  });
  if (error) throw error;
}

export async function listVarMarks(lessonIds: string[]): Promise<VarMark[]> {
  if (!lessonIds.length) return [];
  const { data, error } = await db
    .from("lesson_var_marks")
    .select(
      "lesson_id,user_id,vocab,assignment,article,vocab_source,assignment_source,article_source",
    )
    .in("lesson_id", lessonIds);
  if (error) throw error;
  return (data ?? []) as VarMark[];
}

export async function setVarFlag(input: {
  classId: string;
  lessonId: string;
  userId: string;
  flag: VarKind;
  value: boolean;
}): Promise<void> {
  const sourceCol = `${input.flag}_source`;
  const patch = {
    class_id: input.classId,
    lesson_id: input.lessonId,
    user_id: input.userId,
    [input.flag]: input.value,
    [sourceCol]: "manual",
    updated_at: new Date().toISOString(),
  };
  const { error } = await db
    .from("lesson_var_marks")
    .upsert(patch, { onConflict: "lesson_id,user_id" });
  if (error) throw error;
}

export async function tickAllComplete(lessonId: string, userIds: string[]): Promise<void> {
  const { error } = await db.rpc("tick_all_complete", {
    p_lesson_id: lessonId,
    p_user_ids: userIds,
  });
  if (error) throw error;
}

export async function listScores(userIds: string[]): Promise<StudentScore[]> {
  if (!userIds.length) return [];
  const { data, error } = await db
    .from("student_scores")
    .select("user_id,rw,math")
    .in("user_id", userIds);
  if (error) throw error;
  return (data ?? []) as StudentScore[];
}

export async function saveStudentScore(userId: string, rw: number, math: number): Promise<void> {
  const { error } = await db.rpc("staff_set_student_score", {
    p_user_id: userId,
    p_rw: rw,
    p_math: math,
  });
  if (error) throw error;
}

export async function listMemberships(
  classId: string,
): Promise<{ user_id: string; joined_at: string; status: MemberStatus; enrolled_on: string }[]> {
  const { data, error } = await db
    .from("class_memberships")
    .select("user_id,joined_at,status,enrolled_on")
    .eq("class_id", classId)
    .order("joined_at");
  if (error) throw error;
  return (data ?? []) as {
    user_id: string;
    joined_at: string;
    status: MemberStatus;
    enrolled_on: string;
  }[];
}

export async function setMemberStatus(userId: string, status: MemberStatus): Promise<void> {
  const { error } = await db.rpc("staff_set_member_status", {
    p_user_id: userId,
    p_status: status,
  });
  if (error) throw error;
}

export async function listMyVar(userId: string): Promise<VarMark[]> {
  const { data, error } = await db
    .from("lesson_var_marks")
    .select(
      "lesson_id,user_id,vocab,assignment,article,vocab_source,assignment_source,article_source",
    )
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as VarMark[];
}

export async function getMyScore(userId: string): Promise<StudentScore | null> {
  const { data, error } = await db
    .from("student_scores")
    .select("user_id,rw,math")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as StudentScore | null) ?? null;
}

export function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y!, (m ?? 1) - 1 + delta, 1);
  return monthKey(d);
}

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
