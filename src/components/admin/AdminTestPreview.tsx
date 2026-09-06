import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  QuestionCard,
  emptyAnswer,
  type QuestionRow,
} from "@/components/QuestionCard";
import { SECTION_LABEL } from "@/lib/sat";
import { applyResolvedImageUrls } from "@/lib/storage-url";

type QuestionFull = QuestionRow & {
  correct_choice_id: string | null;
  correct_grid_answers: string[] | null;
};

type Props = {
  title: string;
  section?: "reading_writing" | "math";
  questionIds: string[];
  onClose: () => void;
};

export async function loadTestPreviewQuestions(questionIds: string[]): Promise<QuestionFull[]> {
  if (questionIds.length === 0) return [];

  const [{ data: qs, error: qErr }, { data: ans, error: aErr }] = await Promise.all([
    supabase
      .from("questions")
      .select(
        "id,section,skill,difficulty,kind,prompt,question_text,choices,image_url,time_limit_seconds",
      )
      .in("id", questionIds),
    supabase.rpc("get_answers_for_review", { p_question_ids: questionIds }),
  ]);

  if (qErr) throw new Error(qErr.message);
  if (aErr) throw new Error(aErr.message);

  const ansById = new Map((ans ?? []).map((r) => [r.question_id, r]));
  const byId = new Map(
    (qs ?? []).map((q) => {
      const row = ansById.get(q.id);
      return [
        q.id,
        {
          ...q,
          choices: (q.choices ?? []) as QuestionRow["choices"],
          correct_choice_id: row?.correct_choice_id ?? null,
          correct_grid_answers: row?.correct_grid_answers ?? null,
        } as QuestionFull,
      ];
    }),
  );

  return applyResolvedImageUrls(
    questionIds.map((id) => byId.get(id)).filter(Boolean) as QuestionFull[],
  );
}

export function AdminTestPreview({ title, section, questionIds, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionFull[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const rows = await loadTestPreviewQuestions(questionIds);
        if (cancelled) return;
        if (rows.length === 0) {
          setErr("This test has no questions to preview.");
          setQuestions([]);
        } else {
          setQuestions(rows);
          setIdx(0);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Could not load preview.");
          setQuestions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [questionIds]);

  const q = questions[idx];
  const sectionLabel = useMemo(() => {
    if (section) return SECTION_LABEL[section];
    return q ? SECTION_LABEL[q.section] : null;
  }, [section, q]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-test-canvas">
      <header className="shrink-0 bg-test-chrome">
        <div className="grid grid-cols-3 items-center gap-2 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="tap grid h-7 w-7 shrink-0 place-items-center rounded text-test-muted hover:bg-test-well hover:text-test-ink"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="truncate text-[15px] font-bold text-test-ink">Test preview</span>
          </div>
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-test-line bg-white px-3 py-1 text-xs font-bold text-test-muted">
              <Eye className="h-3.5 w-3.5" />
              Admin view · answers shown
            </span>
          </div>
          <div className="truncate text-right text-sm font-semibold text-test-ink">
            {loading ? "…" : `${idx + 1} / ${questions.length}`}
          </div>
        </div>
        <div className="border-b border-dashed border-test-edge px-4 pb-2 sm:px-6">
          <div className="truncate text-sm font-bold text-test-ink">{title}</div>
          {sectionLabel ? (
            <div className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-test-muted">
              {sectionLabel}
            </div>
          ) : null}
        </div>
      </header>

      {loading ? (
        <div className="grid flex-1 place-items-center bg-test-canvas">
          <Loader2 className="h-8 w-8 animate-spin text-test-accent" />
        </div>
      ) : err ? (
        <div className="grid flex-1 place-items-center bg-test-canvas px-4">
          <div className="w-full max-w-md rounded-lg border border-test-line bg-white p-8 text-center shadow-panel">
            <h2 className="text-lg font-black text-test-ink">{err}</h2>
            <button
              type="button"
              onClick={onClose}
              className="btn-test mt-6 rounded-full bg-test-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-test-accent-deep"
            >
              Close
            </button>
          </div>
        </div>
      ) : q ? (
        <QuestionCard
          q={q}
          index={idx}
          answer={emptyAnswer()}
          onChange={() => {}}
          reveal
          correctChoiceId={q.correct_choice_id ?? null}
        />
      ) : null}

      {!loading && !err && questions.length > 0 ? (
        <div className="flex h-16 shrink-0 items-center justify-between border-t border-test-line bg-test-chrome px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="group tap inline-flex items-center gap-1.5 rounded-full border border-test-accent bg-white px-5 py-2 text-sm font-bold text-test-accent hover:bg-test-tint disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
            Previous
          </button>
          <button
            type="button"
            onClick={() => {
              if (idx >= questions.length - 1) onClose();
              else setIdx((i) => i + 1);
            }}
            className="btn-test group inline-flex items-center gap-1.5 rounded-full bg-test-accent px-5 py-2 text-sm font-bold text-white hover:bg-test-accent-deep"
          >
            {idx >= questions.length - 1 ? "Close" : "Next"}
            {idx < questions.length - 1 ? (
              <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            ) : null}
          </button>
        </div>
      ) : null}
    </div>
  );
}
