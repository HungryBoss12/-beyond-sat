import { supabase } from "@/integrations/supabase/client";

export type QuestionCountRow = {
  section: string;
  bank_format: string;
  difficulty: string;
  n: number;
};

export type PracticeCounts = {
  questions: QuestionCountRow[];
  mocks: number;
  sqb_tests: number;
};

/** Counted in the database: loading rows to count them stops at 1000. */
export async function fetchPracticeCounts(): Promise<PracticeCounts> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("practice_counts");
  if (error) throw new Error(error.message);
  const raw = (data ?? {}) as Partial<PracticeCounts>;
  return {
    questions: Array.isArray(raw.questions) ? raw.questions : [],
    mocks: Number(raw.mocks ?? 0),
    sqb_tests: Number(raw.sqb_tests ?? 0),
  };
}

export function sumQuestions(
  rows: QuestionCountRow[],
  match: (row: QuestionCountRow) => boolean,
): number {
  return rows.reduce((total, row) => (match(row) ? total + row.n : total), 0);
}
