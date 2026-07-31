import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { QuestionCard, emptyAnswer, type AnswerState, type QuestionRow } from "@/components/QuestionCard";
import { EmptyState, Skeleton } from "@/components/ui/panel";

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
        .select("id,question_id,is_correct,selected_choice_id,grid_answer,marked_for_review,eliminated_choice_ids")
        .eq("session_id", id)
        .eq("user_id", uid);
      if (aErr) {
        setErr(aErr.message);
        setLoading(false);
        return;
      }
      const ids = (att ?? [])
        .map((a) => a.question_id)
        .filter((x): x is string => !!x);
      if (ids.length === 0) {
        setErr("No answers found for this session.");
        setLoading(false);
        return;
      }
      const { data: qs } = await supabase
        .from("questions")
        .select("id,section,skill,difficulty,kind,prompt,question_text,choices,image_url")
        .in("id", ids);
      const { data: ans } = await supabase.rpc("get_answers_for_review" as any, {
        p_question_ids: ids,
      });
      const ansById = new Map(
        ((ans as any[]) ?? []).map((r) => [r.question_id, r]),
      );
      const merged = (qs ?? []).map((q) => {
        const a = ansById.get(q.id) ?? {};
        return {
          ...(q as any),
          correct_choice_id: a.correct_choice_id ?? null,
          correct_grid_answers: a.correct_grid_answers ?? null,
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
      <div className="fixed inset-0 z-50 flex flex-col bg-white">
        <div className="grid h-14 grid-cols-3 items-center gap-3 border-b border-brand-400/40 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="mx-auto h-7 w-28 rounded-full" />
          <Skeleton className="ml-auto h-3 w-12" />
        </div>
        <div className="flex-1 overflow-hidden px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-7xl space-y-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-[46vh] rounded-2xl" />
          </div>
        </div>
        <div className="flex h-16 items-center justify-between border-t border-brand-400/40 px-4 sm:px-6">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    );
  }
  if (err) {
    return (
      <EmptyState
        title={err}
        body="Answers are only kept for sessions you finished on this account."
        className="py-14"
        action={
          <button
            onClick={() => navigate({ to: "/analysis" })}
            className="btn-brand rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold text-white"
          >
            Back to analysis
          </button>
        }
      />
    );
  }

  const q = questions[idx];
  const isCorrect = currentAttempt?.is_correct;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="grid h-14 grid-cols-3 items-center border-b border-brand-400/40 bg-brand-600 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/analysis" })}
            className="tap grid h-9 w-9 place-items-center rounded-lg bg-brand-800 text-white hover:bg-brand-400"
            aria-label="Exit"
          >
            <X className="h-4 w-4" />
          </button>
          <span className="text-sm font-black tracking-tight text-white">Review mode</span>
        </div>
        <div className="flex justify-center">
          {/* Correct/incorrect is carried by the icon plus the ramp step — a
              lighter chip for correct — so the overlay stays inside the brand
              palette instead of introducing green and red. */}
          {isCorrect === true ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-400 px-3 py-1 text-sm font-bold text-white">
              <CheckCircle2 className="h-4 w-4" /> Correct
            </span>
          ) : isCorrect === false ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-800 px-3 py-1 text-sm font-bold text-white ring-1 ring-brand-300/60">
              <XCircle className="h-4 w-4" /> Incorrect
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-800 px-3 py-1 text-sm font-bold text-brand-100">
              Unanswered
            </span>
          )}
        </div>
        <div className="flex justify-end text-xs tabular-nums text-brand-100">
          {idx + 1} / {questions.length}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
          {q && (
            <QuestionCard
              q={q}
              index={idx}
              total={questions.length}
              answer={answerState}
              onChange={() => {}}
              reveal
              correctChoiceId={q.correct_choice_id ?? null}
            />
          )}
        </div>
      </div>

      <div className="flex h-16 items-center justify-between border-t border-brand-400/40 bg-brand-600 px-4 sm:px-6">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="group btn-ghost inline-flex items-center gap-2 rounded-lg bg-brand-800 px-4 py-2 text-sm font-bold text-white disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
          Previous
        </button>
        <button
          onClick={() => {
            if (idx >= questions.length - 1) navigate({ to: "/analysis" });
            else setIdx((i) => i + 1);
          }}
          className="btn-brand group inline-flex items-center gap-2 rounded-lg bg-grad-brand px-4 py-2 text-sm font-bold text-white"
        >
          {idx >= questions.length - 1 ? "Finish" : "Next"}{" "}
          <ChevronRight className="arrow-slide h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
