import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, X, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { QuestionCard, emptyAnswer, type AnswerState, type QuestionRow } from "@/components/QuestionCard";

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

  if (loading) {
    return (
      <div className="grid place-items-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (err) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center">
        <div className="text-lg font-bold text-slate-800">{err}</div>
        <button
          onClick={() => navigate({ to: "/analysis" })}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white"
        >
          Back to analysis
        </button>
      </div>
    );
  }

  const q = questions[idx];
  const isCorrect = currentAttempt?.is_correct;

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col">
      <div className="h-14 grid grid-cols-3 items-center px-4 sm:px-6 border-b border-border bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/analysis" })}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-slate-600 hover:text-primary transition"
            aria-label="Exit"
          >
            <X className="h-4 w-4" />
          </button>
          <span className="text-sm font-black text-primary tracking-tight">Review mode</span>
        </div>
        <div className="flex justify-center">
          {isCorrect === true ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-sm font-bold">
              <CheckCircle2 className="h-4 w-4" /> Correct
            </span>
          ) : isCorrect === false ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 text-red-700 px-3 py-1 text-sm font-bold">
              <XCircle className="h-4 w-4" /> Incorrect
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-600 px-3 py-1 text-sm font-bold">
              Unanswered
            </span>
          )}
        </div>
        <div className="flex justify-end text-xs text-slate-500 tabular-nums">
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

      <div className="h-16 border-t border-border bg-white flex items-center justify-between px-4 sm:px-6">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40 hover:border-primary/40 transition"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        <button
          onClick={() => {
            if (idx >= questions.length - 1) navigate({ to: "/analysis" });
            else setIdx((i) => i + 1);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-[#002a56] transition"
        >
          {idx >= questions.length - 1 ? "Finish" : "Next"} <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
