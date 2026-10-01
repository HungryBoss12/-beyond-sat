import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as any;

// Lessons, attendance, marks, Level and Results are per sub-class: see ./groups.

export type StudentScore = {
  user_id: string;
  rw: number;
  math: number;
};

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
