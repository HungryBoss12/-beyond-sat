import { supabase } from "@/integrations/supabase/client";

const PAGE = 1000;

/** Every test's question count. The API returns at most 1000 rows per request. */
export async function fetchTestQuestionCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("test_questions")
      .select("test_id")
      .order("test_id", { ascending: true })
      .order("question_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) {
      counts.set(row.test_id, (counts.get(row.test_id) ?? 0) + 1);
    }
    if (rows.length < PAGE) break;
  }
  return counts;
}
