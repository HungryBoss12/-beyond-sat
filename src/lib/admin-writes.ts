import { supabase } from "@/integrations/supabase/client";

type WriteResult = { error: { message: string } | null };

/** Throws the database message so a failed save is not mistaken for a success. */
export function mustSucceed<T extends WriteResult>(result: T, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result;
}

/** Runs an admin write and shows its error instead of quietly reloading. */
export async function adminWrite(label: string, run: () => PromiseLike<WriteResult>): Promise<boolean> {
  try {
    mustSucceed(await run(), label);
    return true;
  } catch (e) {
    alert(e instanceof Error ? e.message : `${label} failed.`);
    return false;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args: Record<string, unknown>) => (supabase as any).rpc(fn, args);

export async function replaceTestQuestions(testId: string, questionIds: string[]): Promise<void> {
  mustSucceed(
    await rpc("staff_replace_test_questions", { p_test_id: testId, p_question_ids: questionIds }),
    "Could not save the test's questions",
  );
}

export async function replaceDailyTests(dailyTestId: string, testIds: string[]): Promise<void> {
  mustSucceed(
    await rpc("staff_replace_daily_tests", { p_daily_test_id: dailyTestId, p_test_ids: testIds }),
    "Could not save the daily lineup",
  );
}

export async function replaceMockSections(
  mockId: string,
  rows: { module: number; section_index: number; section_name: string; test_id: string }[],
): Promise<void> {
  mustSucceed(
    await rpc("staff_replace_mock_sections", { p_mock_id: mockId, p_rows: rows }),
    "Could not save the mock sections",
  );
}
