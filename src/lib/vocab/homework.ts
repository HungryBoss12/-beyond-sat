import { formatISO, getISOWeek, getISOWeekYear } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { createNotification } from "@/lib/notifications/client";
import type { NotificationAudience } from "@/lib/notifications/types";

export type VocabHomeworkTarget = "deck" | "quiz";
export type VocabHomeworkRecurrence = "once" | "daily" | "weekly";
export type VocabHomeworkStatus = "in_progress" | "completed" | "failed";

export type VocabHomeworkAssignment = {
  id: string;
  title: string;
  instructions: string | null;
  target_type: VocabHomeworkTarget;
  deck_id: string | null;
  quiz_id: string | null;
  card_target: number | null;
  require_green_only: boolean;
  recurrence: VocabHomeworkRecurrence;
  starts_at: string;
  ends_at: string | null;
  due_at: string | null;
  audience_type: NotificationAudience;
  class_id: string | null;
  display_seconds: number;
  active: boolean;
  created_at: string;
};

export type VocabHomeworkCompletion = {
  id: string;
  assignment_id: string;
  user_id: string;
  period_key: string;
  cards_reviewed: number;
  green_reviews: number;
  quiz_score: number | null;
  quiz_total: number | null;
  status: VocabHomeworkStatus;
  completed_at: string | null;
};

export type CreateVocabHomeworkInput = {
  title: string;
  instructions?: string;
  targetType: VocabHomeworkTarget;
  deckId?: string;
  quizId?: string;
  cardTarget?: number;
  requireGreenOnly?: boolean;
  recurrence: VocabHomeworkRecurrence;
  startsAt?: string;
  endsAt?: string;
  dueAt?: string;
  audienceType: NotificationAudience;
  classId?: string;
  userIds?: string[];
  displaySeconds?: number;
};

export function homeworkPeriodKey(recurrence: VocabHomeworkRecurrence, at = new Date()): string {
  if (recurrence === "once") return "once";
  if (recurrence === "daily") return formatISO(at, { representation: "date" });
  return `${getISOWeekYear(at)}-W${String(getISOWeek(at)).padStart(2, "0")}`;
}

export async function listVocabHomeworkAssignments(): Promise<VocabHomeworkAssignment[]> {
  const { data, error } = await supabase
    .from("vocab_homework_assignments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as VocabHomeworkAssignment[];
}

export async function listActiveHomeworkForUser(): Promise<VocabHomeworkAssignment[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("vocab_homework_assignments")
    .select("*")
    .eq("active", true)
    .lte("starts_at", now)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("due_at", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as VocabHomeworkAssignment[];
}

export async function listHomeworkCompletions(
  assignmentId: string,
): Promise<(VocabHomeworkCompletion & { profile?: { full_name: string | null } })[]> {
  const { data, error } = await supabase
    .from("vocab_homework_completions")
    .select("*, profiles:profiles!vocab_homework_completions_user_id_fkey(full_name)")
    .eq("assignment_id", assignmentId);
  if (error) {
    const { data: rows, error: err2 } = await supabase
      .from("vocab_homework_completions")
      .select("*")
      .eq("assignment_id", assignmentId);
    if (err2) throw new Error(err2.message);
    return (rows ?? []) as VocabHomeworkCompletion[];
  }
  return (data ?? []) as (VocabHomeworkCompletion & { profile?: { full_name: string | null } })[];
}

export async function listMyHomeworkCompletions(): Promise<VocabHomeworkCompletion[]> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("vocab_homework_completions")
    .select("*")
    .eq("user_id", uid);
  if (error) throw new Error(error.message);
  return (data ?? []) as VocabHomeworkCompletion[];
}

export async function createVocabHomework(input: CreateVocabHomeworkInput): Promise<string> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;

  const { data: row, error } = await supabase
    .from("vocab_homework_assignments")
    .insert({
      title: input.title.trim(),
      instructions: input.instructions?.trim() || null,
      created_by: uid,
      target_type: input.targetType,
      deck_id: input.targetType === "deck" ? input.deckId : null,
      quiz_id: input.targetType === "quiz" ? input.quizId : null,
      card_target: input.targetType === "deck" ? input.cardTarget : null,
      require_green_only: input.requireGreenOnly ?? true,
      recurrence: input.recurrence,
      starts_at: input.startsAt ?? new Date().toISOString(),
      ends_at: input.endsAt ?? null,
      due_at: input.dueAt ?? null,
      audience_type: input.audienceType,
      class_id: input.audienceType === "class" ? input.classId : null,
      display_seconds: input.displaySeconds ?? 604800,
    })
    .select("id,title,target_type,deck_id,quiz_id")
    .single();

  if (error || !row) throw new Error(error?.message ?? "Could not create assignment");

  if (input.audienceType === "users" && input.userIds?.length) {
    const { error: juErr } = await supabase
      .from("vocab_homework_assignment_users")
      .insert(input.userIds.map((user_id) => ({ assignment_id: row.id, user_id })));
    if (juErr) throw new Error(juErr.message);
  }

  const linkUrl =
    row.target_type === "deck" && row.deck_id
      ? `/vocab/deck/${row.deck_id}`
      : row.target_type === "quiz" && row.quiz_id
        ? `/vocab/tests/${row.quiz_id}`
        : "/vocab";

  await createNotification({
    title: `Vocab homework: ${row.title}`,
    body: input.instructions || "Complete your assigned vocabulary work.",
    linkUrl,
    linkLabel: row.target_type === "deck" ? "Study deck" : "Take quiz",
    audienceType: input.audienceType,
    classId: input.classId,
    userIds: input.userIds,
    displaySeconds: input.displaySeconds ?? 604800,
    sourceType: "vocab_homework",
    sourceId: row.id,
  });

  return row.id;
}

export async function deleteVocabHomework(id: string): Promise<void> {
  const { error } = await supabase.from("vocab_homework_assignments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function recordDeckHomeworkProgress(
  deckId: string,
  rating: 1 | 2 | 3 | 4,
): Promise<void> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return;

  const assignments = (await listActiveHomeworkForUser()).filter(
    (a) => a.target_type === "deck" && a.deck_id === deckId,
  );
  if (!assignments.length) return;

  const isGreen = rating === 3 || rating === 4;

  for (const a of assignments) {
    const periodKey = homeworkPeriodKey(a.recurrence);
    const { data: existing } = await supabase
      .from("vocab_homework_completions")
      .select("*")
      .eq("assignment_id", a.id)
      .eq("user_id", uid)
      .eq("period_key", periodKey)
      .maybeSingle();

    const cards = (existing?.cards_reviewed ?? 0) + 1;
    const green = (existing?.green_reviews ?? 0) + (isGreen ? 1 : 0);
    const target = a.card_target ?? 1;
    const greenOk = !a.require_green_only || green === cards;
    const done = cards >= target && greenOk;

    const payload = {
      assignment_id: a.id,
      user_id: uid,
      period_key: periodKey,
      cards_reviewed: cards,
      green_reviews: green,
      status: done ? ("completed" as const) : ("in_progress" as const),
      completed_at: done ? new Date().toISOString() : null,
    };

    if (existing) {
      await supabase.from("vocab_homework_completions").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("vocab_homework_completions").insert(payload);
    }
  }
}

export async function recordQuizHomeworkCompletion(
  quizId: string,
  score: number,
  total: number,
): Promise<void> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid || total <= 0 || score < total) return;

  const assignments = (await listActiveHomeworkForUser()).filter(
    (a) => a.target_type === "quiz" && a.quiz_id === quizId,
  );

  for (const a of assignments) {
    const periodKey = homeworkPeriodKey(a.recurrence);
    const payload = {
      assignment_id: a.id,
      user_id: uid,
      period_key: periodKey,
      quiz_score: score,
      quiz_total: total,
      status: "completed" as const,
      completed_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("vocab_homework_completions")
      .select("id")
      .eq("assignment_id", a.id)
      .eq("user_id", uid)
      .eq("period_key", periodKey)
      .maybeSingle();

    if (existing) {
      await supabase.from("vocab_homework_completions").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("vocab_homework_completions").insert(payload);
    }
  }
}
