import { supabase } from "@/integrations/supabase/client";

const PAGE = 1000;

/**
 * Every test's question count. The API returns at most 1000 rows per request,
 * so the pages are fetched together instead of one after another.
 */
export async function fetchTestQuestionCounts(): Promise<Map<string, number>> {
  const head = await supabase
    .from("test_questions")
    .select("test_id", { count: "exact", head: true });
  if (head.error) throw head.error;

  const total = head.count ?? 0;
  const counts = new Map<string, number>();
  if (total === 0) return counts;

  const pages = Math.ceil(total / PAGE);
  const batches = await Promise.all(
    Array.from({ length: pages }, (_, page) => {
      const from = page * PAGE;
      return supabase
        .from("test_questions")
        .select("test_id")
        .order("test_id", { ascending: true })
        .order("question_id", { ascending: true })
        .range(from, from + PAGE - 1);
    }),
  );
  for (const batch of batches) {
    if (batch.error) throw batch.error;
    for (const row of batch.data ?? []) {
      counts.set(row.test_id, (counts.get(row.test_id) ?? 0) + 1);
    }
  }
  return counts;
}
