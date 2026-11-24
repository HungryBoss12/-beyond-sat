import { hydrateServerEnv } from "@/lib/server-env";
import { homeworkPeriodKey, type VocabHomeworkRecurrence } from "./homework";

type ActiveDeckAssignment = {
  id: string;
  recurrence: VocabHomeworkRecurrence;
};

/**
 * Records vocab review activity (1 card) and bumps any active deck homework
 * assignments for `deckId` using the server-side `service_role` client, so
 * `bs_record_vocab_activity_for_user` and `bs_bump_vocab_homework_for_user`
 * never need to be callable directly from the browser.
 */
export async function recordVerifiedCardReview(
  env: unknown,
  userId: string,
  deckId: string | null | undefined,
  rating: 1 | 2 | 3 | 4,
): Promise<void> {
  try {
    hydrateServerEnv(env);
    const { ensureSupabaseAdmin, supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    ensureSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;

    const { error: actErr } = await db.rpc("bs_record_vocab_activity_for_user", {
      p_user_id: userId,
      p_cards: 1,
    });
    if (actErr) console.error("[vocab/activity]", actErr.message);

    if (!deckId) return;
    const nowIso = new Date().toISOString();
    const { data: assignments, error: hwErr } = await db
      .from("vocab_homework_assignments")
      .select("id,recurrence")
      .eq("target_type", "deck")
      .eq("deck_id", deckId)
      .eq("active", true)
      .lte("starts_at", nowIso);
    if (hwErr || !Array.isArray(assignments) || assignments.length === 0) return;

    const isGreen = rating === 3 || rating === 4;
    for (const row of assignments as (ActiveDeckAssignment & { ends_at?: string | null })[]) {
      const { error } = await db.rpc("bs_bump_vocab_homework_for_user", {
        p_user_id: userId,
        p_assignment_id: row.id,
        p_period_key: homeworkPeriodKey(row.recurrence),
        p_green: isGreen,
      });
      if (error && !/not assigned/i.test(error.message ?? "")) {
        console.error("[vocab/homework] server bump", error.message);
      }
    }
  } catch (e) {
    console.error("[vocab/activity] server review hook failed", (e as Error).message);
  }
}
