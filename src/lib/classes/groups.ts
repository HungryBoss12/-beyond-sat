import { supabase } from "@/integrations/supabase/client";
import type { ClassSubject, MemberStatus } from "./types";
import type { HwItem } from "./schemes";

// Group RPCs and tables ship ahead of regenerated Database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as any;

export type ClassGroup = {
  id: string;
  class_id: string;
  subject: ClassSubject;
  name: string;
  teacher_id: string | null;
  schedule_days: number[] | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  level: string | null;
  active: boolean;
};

export type GroupMember = {
  group_id: string;
  user_id: string;
  class_id: string;
  subject: ClassSubject;
  status: Exclude<MemberStatus, "left">;
  enrolled_on: string;
  activated_on: string | null;
  joined_at: string;
};

export type GroupLesson = {
  id: string;
  group_id: string;
  class_id: string;
  subject: ClassSubject;
  lesson_date: string;
  topic: string | null;
};

export type AttendanceRow = { user_id: string; lesson_date: string; participated: boolean };

export type HwMark = {
  lesson_id: string;
  user_id: string;
  item: HwItem;
  done: boolean;
  source: "manual" | "auto";
};

export type LevelSection = {
  id: string;
  subject: ClassSubject;
  slug: string;
  name: string;
  display_order: number;
  weight: number;
  active: boolean;
};

export type LevelBoardRow = {
  user_id: string;
  scores: Record<string, { score: number; assessed_on: string }>;
  overall: number | null;
  scored: number;
  sections: number;
  last_assessed_on: string | null;
  previous_overall: number | null;
};

export type LevelScoreEntry = {
  id: string;
  user_id: string;
  group_id: string;
  section_id: string;
  score: number;
  assessed_on: string;
  lesson_id: string | null;
  note: string | null;
  created_at: string;
  voided_at: string | null;
  void_reason: string | null;
};

export type ResultRow = {
  lesson_id: string;
  user_id: string;
  m1: number | null;
  m2: number | null;
};

const GROUP_COLS =
  "id,class_id,subject,name,teacher_id,schedule_days,start_time,end_time,room,level,active";
const MEMBER_COLS = "group_id,user_id,class_id,subject,status,enrolled_on,activated_on,joined_at";
const LESSON_COLS = "id,group_id,class_id,subject,lesson_date,topic";

function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const next = new Date(Date.UTC(y!, m!, 1));
  return { start: `${month}-01`, end: next.toISOString().slice(0, 10) };
}

// Groups ---------------------------------------------------------------------

export async function listGroups(classId?: string): Promise<ClassGroup[]> {
  let query = db.from("class_groups").select(GROUP_COLS).order("subject");
  if (classId) query = query.eq("class_id", classId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ClassGroup[];
}

export async function updateGroup(
  groupId: string,
  patch: Partial<
    Pick<
      ClassGroup,
      | "name"
      | "teacher_id"
      | "schedule_days"
      | "start_time"
      | "end_time"
      | "room"
      | "level"
      | "active"
    >
  >,
): Promise<void> {
  const { error } = await db.from("class_groups").update(patch).eq("id", groupId);
  if (error) throw error;
}

// Members --------------------------------------------------------------------

export async function listGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await db
    .from("class_group_memberships")
    .select(MEMBER_COLS)
    .eq("group_id", groupId)
    .order("joined_at");
  if (error) throw error;
  return (data ?? []) as GroupMember[];
}

export async function listClassGroupMembers(classId: string): Promise<GroupMember[]> {
  const { data, error } = await db
    .from("class_group_memberships")
    .select(MEMBER_COLS)
    .eq("class_id", classId)
    .order("joined_at");
  if (error) throw error;
  return (data ?? []) as GroupMember[];
}

/** Staff: every sub-class membership (small table; one query for the class list). */
export async function listAllGroupMembers(): Promise<GroupMember[]> {
  const { data, error } = await db.from("class_group_memberships").select(MEMBER_COLS);
  if (error) throw error;
  return (data ?? []) as GroupMember[];
}

export async function listUserGroupMemberships(userIds: string[]): Promise<GroupMember[]> {
  if (!userIds.length) return [];
  const { data, error } = await db
    .from("class_group_memberships")
    .select(MEMBER_COLS)
    .in("user_id", userIds);
  if (error) throw error;
  return (data ?? []) as GroupMember[];
}

export async function addGroupMember(input: {
  groupId: string;
  userId: string;
  status?: Exclude<MemberStatus, "left">;
  enrolledOn?: string | null;
  activatedOn?: string | null;
  move?: boolean;
}): Promise<void> {
  const { error } = await db.rpc("staff_add_group_member", {
    p_group_id: input.groupId,
    p_user_id: input.userId,
    p_status: input.status ?? "active",
    p_enrolled_on: input.enrolledOn ?? null,
    p_activated_on: input.activatedOn ?? null,
    p_move: input.move ?? false,
  });
  if (error) throw error;
}

/** True when the RPC refused because the student belongs to another parent class. */
export function isOtherClassError(error: unknown): boolean {
  return error instanceof Object && "message" in error
    ? String((error as { message: unknown }).message).includes("already_in_other_class")
    : false;
}

export async function setGroupMemberStatus(
  groupId: string,
  userId: string,
  status: Exclude<MemberStatus, "left">,
): Promise<void> {
  const { error } = await db.rpc("staff_set_group_member_status", {
    p_group_id: groupId,
    p_user_id: userId,
    p_status: status,
  });
  if (error) throw error;
}

export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  const { error } = await db.rpc("staff_remove_group_member", {
    p_group_id: groupId,
    p_user_id: userId,
  });
  if (error) throw error;
}

// Lessons and attendance -----------------------------------------------------

export async function ensureGroupLessons(groupId: string, month: string): Promise<number> {
  const { data, error } = await db.rpc("ensure_group_lessons", {
    p_group_id: groupId,
    p_month: `${month}-01`,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function listGroupLessons(groupId: string, month: string): Promise<GroupLesson[]> {
  const { start, end } = monthRange(month);
  const { data, error } = await db
    .from("class_lessons")
    .select(LESSON_COLS)
    .eq("group_id", groupId)
    .gte("lesson_date", start)
    .lt("lesson_date", end)
    .order("lesson_date");
  if (error) throw error;
  return (data ?? []) as GroupLesson[];
}

export async function listRecentGroupLessons(
  groupId: string,
  limit: number,
): Promise<GroupLesson[]> {
  const { data, error } = await db
    .from("class_lessons")
    .select(LESSON_COLS)
    .eq("group_id", groupId)
    .order("lesson_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as GroupLesson[]).reverse();
}

export async function addGroupLesson(groupId: string, lessonDate: string): Promise<void> {
  const { error } = await db
    .from("class_lessons")
    .insert({ group_id: groupId, lesson_date: lessonDate });
  if (error) throw error;
}

export async function listGroupAttendance(
  groupId: string,
  month: string,
): Promise<AttendanceRow[]> {
  const { start, end } = monthRange(month);
  const { data, error } = await db
    .from("lesson_attendance")
    .select("user_id,lesson_date,participated")
    .eq("group_id", groupId)
    .gte("lesson_date", start)
    .lt("lesson_date", end);
  if (error) throw error;
  return (data ?? []) as AttendanceRow[];
}

export async function listUserAttendance(
  userId: string,
  limit = 120,
): Promise<(AttendanceRow & { group_id: string })[]> {
  const { data, error } = await db
    .from("lesson_attendance")
    .select("user_id,group_id,lesson_date,participated")
    .eq("user_id", userId)
    .order("lesson_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as (AttendanceRow & { group_id: string })[];
}

export async function listGroupMonthCounts(
  groupIds: string[],
  month: string,
): Promise<Map<string, { lessons: number; attendance: number }>> {
  const counts = new Map<string, { lessons: number; attendance: number }>();
  for (const id of groupIds) counts.set(id, { lessons: 0, attendance: 0 });
  if (!groupIds.length) return counts;
  const { start, end } = monthRange(month);
  const [lessons, attendance] = await Promise.all([
    db
      .from("class_lessons")
      .select("group_id")
      .in("group_id", groupIds)
      .gte("lesson_date", start)
      .lt("lesson_date", end),
    db
      .from("lesson_attendance")
      .select("group_id")
      .in("group_id", groupIds)
      .gte("lesson_date", start)
      .lt("lesson_date", end),
  ]);
  if (lessons.error) throw lessons.error;
  if (attendance.error) throw attendance.error;
  for (const row of (lessons.data ?? []) as { group_id: string }[]) {
    const cur = counts.get(row.group_id);
    if (cur) cur.lessons += 1;
  }
  for (const row of (attendance.data ?? []) as { group_id: string }[]) {
    const cur = counts.get(row.group_id);
    if (cur) cur.attendance += 1;
  }
  return counts;
}

export async function setGroupAttendance(input: {
  groupId: string;
  userId: string;
  lessonDate: string;
  state: "present" | "absent" | "empty";
}): Promise<void> {
  const { error } = await db.rpc("set_group_attendance", {
    p_group_id: input.groupId,
    p_user_id: input.userId,
    p_lesson_date: input.lessonDate,
    p_state: input.state,
  });
  if (error) throw error;
}

// Homework marks (VAR / AFL) ---------------------------------------------------

export async function listHwMarks(lessonIds: string[]): Promise<HwMark[]> {
  if (!lessonIds.length) return [];
  const { data, error } = await db
    .from("lesson_hw_marks")
    .select("lesson_id,user_id,item,done,source")
    .in("lesson_id", lessonIds);
  if (error) throw error;
  return (data ?? []) as HwMark[];
}

export async function listUserHwMarks(userId: string): Promise<(HwMark & { group_id: string })[]> {
  const { data, error } = await db
    .from("lesson_hw_marks")
    .select("lesson_id,user_id,group_id,item,done,source")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as (HwMark & { group_id: string })[];
}

/** Sets one item for each listed live member of the lesson's group. Returns rows written. */
export async function setHwMarks(
  lessonId: string,
  userIds: string[],
  item: HwItem,
  done: boolean,
): Promise<number> {
  const { data, error } = await db.rpc("staff_set_hw_marks", {
    p_lesson_id: lessonId,
    p_user_ids: userIds,
    p_item: item,
    p_done: done,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function tickAllComplete(lessonId: string, userIds: string[]): Promise<void> {
  const { error } = await db.rpc("tick_all_complete", {
    p_lesson_id: lessonId,
    p_user_ids: userIds,
  });
  if (error) throw error;
}

export async function untickAll(lessonId: string, userIds: string[]): Promise<void> {
  const { error } = await db.rpc("untick_all", { p_lesson_id: lessonId, p_user_ids: userIds });
  if (error) throw error;
}

// Level ----------------------------------------------------------------------

export async function listLevelSections(subject: ClassSubject): Promise<LevelSection[]> {
  const { data, error } = await db
    .from("level_sections")
    .select("id,subject,slug,name,display_order,weight,active")
    .eq("subject", subject)
    .eq("active", true)
    .order("display_order");
  if (error) throw error;
  return (data ?? []) as LevelSection[];
}

export async function levelBoard(groupId: string): Promise<LevelBoardRow[]> {
  const { data, error } = await db.rpc("staff_level_board", { p_group_id: groupId });
  if (error) throw error;
  return ((data ?? []) as LevelBoardRow[]).map((row) => ({ ...row, scores: row.scores ?? {} }));
}

export async function saveLevelScores(input: {
  groupId: string;
  userId: string;
  assessedOn: string;
  scores: Record<string, number>;
  lessonId?: string | null;
}): Promise<number> {
  const { data, error } = await db.rpc("staff_save_level_scores", {
    p_group_id: input.groupId,
    p_user_id: input.userId,
    p_assessed_on: input.assessedOn,
    p_scores: input.scores,
    p_lesson_id: input.lessonId ?? null,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function voidLevelScore(id: string, reason: string): Promise<void> {
  const { error } = await db.rpc("staff_void_level_score", { p_id: id, p_reason: reason });
  if (error) throw error;
}

export async function listLevelHistory(
  groupId: string,
  userId: string,
): Promise<LevelScoreEntry[]> {
  const { data, error } = await db
    .from("student_level_scores")
    .select(
      "id,user_id,group_id,section_id,score,assessed_on,lesson_id,note,created_at,voided_at,void_reason",
    )
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .order("assessed_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LevelScoreEntry[];
}

/** Current (latest, not voided) score per section for one student, any group. */
export async function listUserLevelCurrent(userId: string): Promise<
  {
    group_id: string;
    section_id: string;
    slug: string;
    weight: number;
    score: number;
    assessed_on: string;
  }[]
> {
  const { data, error } = await db
    .from("student_level_current")
    .select("group_id,section_id,slug,weight,score,assessed_on")
    .eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

// Results --------------------------------------------------------------------

export async function listResults(lessonIds: string[]): Promise<ResultRow[]> {
  if (!lessonIds.length) return [];
  const { data, error } = await db
    .from("lesson_results")
    .select("lesson_id,user_id,m1,m2")
    .in("lesson_id", lessonIds);
  if (error) throw error;
  return (data ?? []) as ResultRow[];
}

export async function listUserResults(
  userId: string,
): Promise<(ResultRow & { group_id: string; updated_at: string })[]> {
  const { data, error } = await db
    .from("lesson_results")
    .select("lesson_id,user_id,group_id,m1,m2,updated_at")
    .eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

export async function setResult(
  lessonId: string,
  userId: string,
  m1: number | null,
  m2: number | null,
): Promise<void> {
  const { error } = await db.rpc("staff_set_result", {
    p_lesson_id: lessonId,
    p_user_id: userId,
    p_m1: m1,
    p_m2: m2,
  });
  if (error) throw error;
}

// People --------------------------------------------------------------------------

export type PersonProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
  last_seen_at: string | null;
};

/** Staff can read every profile; one query instead of one per student. */
export async function listProfiles(ids: string[]): Promise<Map<string, PersonProfile>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return new Map();
  const { data, error } = await db
    .from("profiles")
    .select("id,username,full_name,first_name,last_name,email,avatar_url,last_seen_at")
    .in("id", unique);
  if (error) throw error;
  return new Map(((data ?? []) as PersonProfile[]).map((p) => [p.id, p]));
}

export function personName(profile: PersonProfile | undefined, fallbackId: string): string {
  if (!profile) return fallbackId.slice(0, 8);
  const joined = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  return profile.full_name || joined || profile.username || profile.email || fallbackId.slice(0, 8);
}

/** Admins, editors, and teachers, for the teacher picker. Only admins can read roles; others get []. */
export async function listStaff(): Promise<PersonProfile[]> {
  const { data, error } = await db
    .from("user_roles")
    .select("user_id,role")
    .in("role", ["admin", "editor", "teacher"]);
  if (error || !data?.length) return [];
  const profiles = await listProfiles((data as { user_id: string }[]).map((r) => r.user_id));
  return [...profiles.values()].sort((a, b) =>
    personName(a, a.id).localeCompare(personName(b, b.id)),
  );
}

export type StudentSubmission = {
  id: string;
  assignment_id: string;
  status: string;
  score: number | null;
  created_at: string;
  homework_assignments: { title: string; subject: ClassSubject; max_score: number | null } | null;
};

export async function listStudentSubmissions(
  userId: string,
  limit = 20,
): Promise<StudentSubmission[]> {
  const { data, error } = await db
    .from("homework_submissions")
    .select(
      "id,assignment_id,status,score,created_at,homework_assignments(title,subject,max_score)",
    )
    .eq("student_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as StudentSubmission[];
}

export async function listLessonsById(ids: string[]): Promise<GroupLesson[]> {
  if (!ids.length) return [];
  const { data, error } = await db.from("class_lessons").select(LESSON_COLS).in("id", ids);
  if (error) throw error;
  return (data ?? []) as GroupLesson[];
}
