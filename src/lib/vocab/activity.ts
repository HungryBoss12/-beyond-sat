import { format, subDays } from "date-fns";
import type { SupabaseConfig } from "@/lib/server-env";
import { restFetch } from "./rest";

type StudentProfile = {
  current_streak: number;
  longest_streak: number;
  last_active_at: string | null;
};

type ActivityLog = {
  id: string;
  cards_reviewed: number;
};

/** Log vocab review activity and bump streak via last_active_at (not daily-test date). */
export async function recordUserActivity(
  config: SupabaseConfig,
  token: string,
  userId: string,
  cardsReviewed = 1,
): Promise<void> {
  const today = format(new Date(), "yyyy-MM-dd");
  const nowIso = new Date().toISOString();

  const { data: existing } = await restFetch<ActivityLog[]>(
    config,
    token,
    `vocab_activity_logs?user_id=eq.${userId}&activity_date=eq.${today}&select=id,cards_reviewed`,
  );

  const firstVocabToday = !existing?.[0];

  if (existing?.[0]) {
    await restFetch(config, token, `vocab_activity_logs?id=eq.${existing[0].id}`, {
      method: "PATCH",
      body: JSON.stringify({
        cards_reviewed: existing[0].cards_reviewed + cardsReviewed,
        completed_at: nowIso,
      }),
      headers: { Prefer: "return=minimal" },
    });
  } else {
    await restFetch(config, token, "vocab_activity_logs", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        activity_date: today,
        cards_reviewed: cardsReviewed,
        completed_at: nowIso,
      }),
      headers: { Prefer: "return=minimal" },
    });
  }

  const { data: spRows } = await restFetch<StudentProfile[]>(
    config,
    token,
    `student_profiles?user_id=eq.${userId}&select=current_streak,longest_streak,last_active_at`,
  );
  const sp = spRows?.[0];

  let patch: Record<string, unknown> = { last_active_at: nowIso };

  if (firstVocabToday) {
    const lastActiveDay = sp?.last_active_at
      ? format(new Date(sp.last_active_at), "yyyy-MM-dd")
      : null;
    let nextStreak = 1;
    if (lastActiveDay === today) {
      nextStreak = sp?.current_streak ?? 1;
    } else if (lastActiveDay) {
      const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
      if (lastActiveDay === yesterday) nextStreak = (sp?.current_streak ?? 0) + 1;
    }
    patch = {
      ...patch,
      current_streak: nextStreak,
      longest_streak: Math.max(sp?.longest_streak ?? 0, nextStreak),
    };
  }

  await restFetch(config, token, `student_profiles?user_id=eq.${userId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
    headers: { Prefer: "return=minimal" },
  });
}
