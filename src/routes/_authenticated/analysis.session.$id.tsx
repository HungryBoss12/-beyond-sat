import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  QuestionCard,
  emptyAnswer,
  type AnswerState,
  type QuestionRow,
} from "@/components/QuestionCard";

export const Route = createFileRoute("/_authenticated/analysis/session/$id")({
  component: SessionReview,
  head: () => ({ meta: [{ title: "Session review — BeyondSAT" }] }),
});

type AttemptRow = {
  id: string;
  question_id: string | null;
  is_correct: boolean | null;
  selected_choice_id: string | null;
  grid_answer: string | null;
  marked_for_review: boolean | null;
  eliminated_choice_ids: string[] | null;
};

type QuestionFull = QuestionRow & {
  correct_choice_id: string | null;
  correct_grid_answers: string[] | null;
};

function SessionReview() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionFull[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      const { data: att, error: aErr } = await supabase
        .from("attempts")
        .select(
          "id,question_id,is_correct,selected_choice_id,grid_answer,marked_for_review,eliminated_choice_ids",
        )
        .eq("session_id", id)
        .eq("user_id", uid);
      if (aErr) {
        setErr(aErr.message);
        setLoading(false);
        return;
      }
      const ids = (att ?? []).map((a) => a.question_id).filter((x): x is string => !!x);
      if (ids.length === 0) {
        setErr("No answers found for this session.");
        setLoading(false);
        return;
      }
      const { data: qs } = await supabase
        .from("questions")
        .select("id,section,skill,difficulty,kind,prompt,question_text,choices,image_url")
        .in("id", ids);
      const { data: ans } = await supabase.rpc("get_answers_for_review", {
        p_question_ids: ids,
      });
      const ansById = new Map((ans ?? []).map((r) => [r.question_id, r]));
      const merged = (qs ?? []).map((q) => {
        const a = ansById.get(q.id);
        return {
          ...q,
          correct_choice_id: a?.correct_choice_id ?? null,
          correct_grid_answers: a?.correct_grid_answers ?? null,
        } as QuestionFull;
      });
      const byId = new Map(merged.map((q) => [q.id, q]));
      const ordered = (att ?? [])
        .map((a) => (a.question_id ? byId.get(a.question_id) : undefined))
        .filter(Boolean) as QuestionFull[];

      setQuestions(ordered);
      setAttempts((att ?? []) as AttemptRow[]);
      setLoading(false);
    })();
  }, [id]);

  const currentAttempt = attempts.find((a) => a.question_id === questions[idx]?.id) ?? null;

  const answerState: AnswerState = useMemo(() => {
    if (!currentAttempt) return emptyAnswer();
    return {
      selectedChoiceId: currentAttempt.selected_choice_id,
      gridAnswer: currentAttempt.grid_answer ?? "",
      eliminated: currentAttempt.eliminated_choice_ids ?? [],
      markedForReview: !!currentAttempt.marked_for_review,
      highlights: [],
    };
  }, [currentAttempt]);

  /* This route is a full-screen overlay, so the skeleton has to reproduce the
     overlay's own chrome — top bar, question body, footer — on the white page
     rather than sitting inside the app shell. */
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-test-canvas">
        <div className="h-16 w-full shrink-0 border-b border-dashed border-test-edge bg-test-chrome" />
        <div className="flex min-h-0 flex-1 gap-0 overflow-hidden">
          <div className="hidden flex-1 border-r border-test-line p-6 md:block">
            <div className="skeleton-light h-full rounded" />
          </div>
          <div className="flex-1 space-y-4 p-6">
            <div className="skeleton-light h-4 w-40 rounded" />
            <div className="skeleton-light h-24 rounded" />
            <div className="skeleton-light h-14 rounded-lg" />
            <div className="skeleton-light h-14 rounded-lg" />
            <div className="skeleton-light h-14 rounded-lg" />
          </div>
        </div>
        <div className="flex h-16 items-center justify-between border-t border-test-line bg-test-chrome px-4 sm:px-6">
          <div className="skeleton-light h-10 w-28 rounded-full" />
          <div className="skeleton-light h-10 w-24 rounded-full" />
        </div>
      </div>
    );
  }
  if (err) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-test-chrome px-4 py-6 sm:px-6">
        <div className="w-full max-w-md rounded-lg border border-test-line bg-white p-8 text-center shadow-panel">
          <h1 className="text-xl font-black tracking-tight text-test-ink">{err}</h1>
          <p className="mt-2 text-sm text-test-muted">
            Answers are only kept for sessions you finished on this account.
          </p>
          <button
            onClick={() => navigate({ to: "/analysis" })}
            className="btn-test mt-6 rounded-full bg-test-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-test-accent-deep"
          >
            Back to analysis
          </button>
        </div>
      </div>
    );
  }

  const q = questions[idx];
  const isCorrect = currentAttempt?.is_correct;

  return (
    /* Same surface as the live runner — this screen embeds the identical
       QuestionCard, so it reproduces the Bluebook chrome exactly: light header
       bar, dashed rule, full-bleed question, light footer. The only difference
       is the verdict chip where the runner puts its clock. */
    <div className="fixed inset-0 z-50 flex flex-col bg-test-canvas">
      <header className="shrink-0 bg-test-chrome">
        <div className="grid grid-cols-3 items-center gap-2 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => navigate({ to: "/analysis" })}
              className="tap grid h-7 w-7 shrink-0 place-items-center rounded text-test-muted hover:bg-test-well hover:text-test-ink"
              aria-label="Exit"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="truncate text-[15px] font-bold text-test-ink">Review mode</span>
          </div>
          <div className="flex justify-center">
            {/* Still no green/red: correct is the accent fill, incorrect is a
                neutral outline, and the icon carries the rest. */}
            {isCorrect === true ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-test-accent px-3 py-1 text-sm font-bold text-white">
                <CheckCircle2 className="h-4 w-4" /> Correct
              </span>
            ) : isCorrect === false ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-test-edge bg-white px-3 py-1 text-sm font-bold text-test-ink">
                <XCircle className="h-4 w-4" /> Incorrect
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-test-line bg-white px-3 py-1 text-sm font-bold text-test-muted">
                Unanswered
              </span>
            )}
          </div>
          <div className="flex justify-end text-sm font-semibold tabular-nums text-test-ink">
            {idx + 1} / {questions.length}
          </div>
        </div>
        <div className="border-b border-dashed border-test-edge" />
      </header>

      {q && (
        <QuestionCard
          q={q}
          index={idx}
          answer={answerState}
          onChange={() => {}}
          reveal
          correctChoiceId={q.correct_choice_id ?? null}
        />
      )}

      <div className="flex h-16 shrink-0 items-center justify-between border-t border-test-line bg-test-chrome px-4 sm:px-6">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="group tap inline-flex items-center gap-1.5 rounded-full border border-test-accent bg-white px-5 py-2 text-sm font-bold text-test-accent hover:bg-test-tint disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
          Previous
        </button>
        <button
          onClick={() => {
            if (idx >= questions.length - 1) navigate({ to: "/analysis" });
            else setIdx((i) => i + 1);
          }}
          className="btn-test group inline-flex items-center gap-1.5 rounded-full bg-test-accent px-5 py-2 text-sm font-bold text-white hover:bg-test-accent-deep"
        >
          {idx >= questions.length - 1 ? "Finish" : "Next"}{" "}
          <ChevronRight className="arrow-slide h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
