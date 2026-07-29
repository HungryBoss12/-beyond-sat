import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Clock, Flag, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  QuestionCard,
  emptyAnswer,
  isAnswered,
  type AnswerState,
  type QuestionRow,
} from "@/components/QuestionCard";
import { DesmosCalculator } from "@/components/DesmosCalculator";
import { bumpDailyStreak, scaledScore, type TestType } from "@/lib/session";

type Props = {
  sessionId: string;
  type: TestType;
  userId: string;
  questions: QuestionRow[];
  /** Total exam time in seconds; when 0, no timer. */
  durationSeconds?: number;
  onExit?: () => void;
};

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

type Result = {
  correct: number;
  total: number;
  rwCorrect: number;
  rwTotal: number;
  mathCorrect: number;
  mathTotal: number;
  scaled: { rw: number; math: number; total: number } | null;
};

export function TestPlayer({
  sessionId,
  type,
  userId,
  questions,
  durationSeconds = 0,
  onExit,
}: Props) {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerState[]>(() => questions.map(() => emptyAnswer()));
  const [showReview, setShowReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(durationSeconds);
  const startedRef = useRef<number>(Date.now());
  const questionStartRef = useRef<number>(Date.now());
  const timePerQ = useRef<number[]>(questions.map(() => 0));

  // Keep a ref to the latest answers so the timer's auto-submit (whose closure
  // is captured on mount) reads current answers rather than the initial blanks.
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    if (!durationSeconds) return;
    const t = setInterval(() => {
      setTimeLeft((v) => {
        const next = v - 1;
        if (next <= 0) {
          clearInterval(t);
          // auto submit
          void submit();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationSeconds]);

  function updateAnswer(i: number, a: AnswerState) {
    setAnswers((prev) => {
      const copy = [...prev];
      copy[i] = a;
      return copy;
    });
  }

  function goto(i: number) {
    // record time for current question
    const elapsed = Math.round((Date.now() - questionStartRef.current) / 1000);
    timePerQ.current[idx] = (timePerQ.current[idx] ?? 0) + elapsed;
    questionStartRef.current = Date.now();
    setIdx(i);
    setShowReview(false);
  }

  async function submit() {
    if (submitting || result) return;
    setSubmitting(true);
    // finalize current question time
    const elapsed = Math.round((Date.now() - questionStartRef.current) / 1000);
    timePerQ.current[idx] = (timePerQ.current[idx] ?? 0) + elapsed;

    let correct = 0;
    let rwC = 0,
      rwT = 0,
      mC = 0,
      mT = 0;
    const currentAnswers = answersRef.current;
    const attempts = await Promise.all(
      questions.map(async (q, i) => {
        const a = currentAnswers[i];
        let isCorrect: boolean | null = null;
        const hasAnswer =
          q.kind === "grid_in" ? !!a.gridAnswer.trim() : !!a.selectedChoiceId;
        if (hasAnswer) {
          const { data } = await supabase.rpc("grade_answer" as any, {
            p_question_id: q.id,
            p_choice_id: a.selectedChoiceId ?? null,
            p_grid_answer: a.gridAnswer || null,
          });
          isCorrect = (data as boolean | null) ?? null;
        }
        if (isCorrect) correct += 1;
        if (q.section === "reading_writing") {
          rwT += 1;
          if (isCorrect) rwC += 1;
        } else {
          mT += 1;
          if (isCorrect) mC += 1;
        }
        return {
          user_id: userId,
          session_id: sessionId,
          question_id: q.id,
          test_type: type,
          selected_choice_id: a.selectedChoiceId,
          grid_answer: a.gridAnswer || null,
          is_correct: isCorrect,
          marked_for_review: a.markedForReview,
          eliminated_choice_ids: a.eliminated,
          time_spent_seconds: timePerQ.current[i] ?? 0,
        };
      }),
    );

    const { error: aErr } = await supabase.from("attempts").insert(attempts);
    if (aErr) console.error(aErr);


    const scaled =
      type === "mock"
        ? {
            rw: scaledScore(rwC, rwT, "reading_writing"),
            math: scaledScore(mC, mT, "math"),
            total:
              scaledScore(rwC, rwT, "reading_writing") + scaledScore(mC, mT, "math"),
          }
        : null;

    await supabase
      .from("test_sessions")
      .update({
        completed_at: new Date().toISOString(),
        correct_count: correct,
        total_questions: questions.length,
        rw_score: scaled?.rw ?? null,
        math_score: scaled?.math ?? null,
        score: scaled?.total ?? correct,
      })
      .eq("id", sessionId);

    if (type === "daily") await bumpDailyStreak(userId);

    setResult({
      correct,
      total: questions.length,
      rwCorrect: rwC,
      rwTotal: rwT,
      mathCorrect: mC,
      mathTotal: mT,
      scaled,
    });
    setSubmitting(false);
  }

  const q = questions[idx];
  const answered = useMemo(
    () => answers.map((a, i) => isAnswered(a, questions[i].kind)),
    [answers, questions],
  );
  const answeredCount = answered.filter(Boolean).length;
  const marked = answers.map((a) => a.markedForReview);

  if (result) return <ResultsView result={result} type={type} onExit={() => navigate({ to: "/practice" })} />;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* top bar — Bluebook-style with centered timer */}
      <div className="h-14 grid grid-cols-3 items-center px-4 sm:px-6 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => (onExit ? onExit() : navigate({ to: "/practice" }))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:text-blue-600 transition"
            aria-label="Exit"
          >
            <X className="h-4 w-4" />
          </button>
          <span className="text-sm font-black text-blue-600 tracking-tight truncate">BeyondSAT</span>
          <span className="hidden sm:inline text-xs text-slate-500 uppercase font-bold tracking-wider truncate">
            {type === "mock" ? "Mock exam" : type === "daily" ? "Daily test" : "Practice"}
          </span>
        </div>
        <div className="flex justify-center">
          {durationSeconds > 0 ? (
            <div className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-5 py-1.5 text-lg font-black tabular-nums tracking-wider">
              <Clock className="h-4 w-4" /> {fmt(timeLeft)}
            </div>
          ) : (
            <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Untimed</span>
          )}
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => setShowReview((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-blue-600/40 transition"
          >
            <Flag className="h-3.5 w-3.5" /> Review {answeredCount}/{questions.length}
          </button>
        </div>
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 pb-24">
          {showReview ? (
            <ReviewPanel
              questions={questions}
              answered={answered}
              marked={marked}
              current={idx}
              onGoto={(i) => goto(i)}
              onSubmit={submit}
              submitting={submitting}
            />
          ) : (
            <QuestionCard
              q={q}
              index={idx}
              total={questions.length}
              answer={answers[idx]}
              onChange={(a) => updateAnswer(idx, a)}
            />
          )}
        </div>
      </div>

      {/* bottom bar with centered question navigator popover */}
      <BottomBar
        idx={idx}
        total={questions.length}
        answered={answered}
        marked={marked}
        answeredCount={answeredCount}
        showReview={showReview}
        onPrev={() => goto(Math.max(0, idx - 1))}
        onNext={() => (idx < questions.length - 1 ? goto(idx + 1) : setShowReview(true))}
        onGoto={(i) => goto(i)}
        isLast={idx === questions.length - 1}
      />
      {q?.section === "math" && <DesmosCalculator />}
    </div>
  );
}

function BottomBar({
  idx,
  total,
  answered,
  marked,
  answeredCount,
  showReview,
  onPrev,
  onNext,
  onGoto,
  isLast,
}: {
  idx: number;
  total: number;
  answered: boolean[];
  marked: boolean[];
  answeredCount: number;
  showReview: boolean;
  onPrev: () => void;
  onNext: () => void;
  onGoto: (i: number) => void;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative h-16 border-t border-slate-200 bg-white flex items-center justify-between px-4 sm:px-6">
      <button
        onClick={onPrev}
        disabled={idx === 0 || showReview}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40 hover:border-blue-600/40 transition"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </button>

      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-bold hover:bg-slate-800 transition tabular-nums"
        >
          Question {idx + 1} of {total}
          <ChevronRight className={"h-4 w-4 transition " + (open ? "-rotate-90" : "rotate-90")} />
        </button>
        {open && (
          <div className="absolute bottom-full mb-3 w-[min(92vw,520px)] rounded-2xl border border-slate-200 bg-white shadow-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Jump to question
              </span>
              <span className="text-xs text-slate-500 tabular-nums">
                {answeredCount}/{total} answered
              </span>
            </div>
            <div className="grid grid-cols-8 sm:grid-cols-10 gap-2">
              {Array.from({ length: total }).map((_, i) => {
                const a = answered[i];
                const m = marked[i];
                const cur = i === idx;
                return (
                  <button
                    key={i}
                    onClick={() => {
                      onGoto(i);
                      setOpen(false);
                    }}
                    className={
                      "relative h-10 rounded-lg text-sm font-bold tabular-nums transition " +
                      (cur ? "ring-2 ring-primary ring-offset-1 " : "") +
                      (a
                        ? "bg-primary text-white "
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200 ")
                    }
                  >
                    {i + 1}
                    {m && (
                      <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-400 border border-white" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onNext}
        disabled={showReview}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition"
      >
        {isLast ? "Finish" : "Next"} <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function ReviewPanel({
  questions,
  answered,
  marked,
  current,
  onGoto,
  onSubmit,
  submitting,
}: {
  questions: QuestionRow[];
  answered: boolean[];
  marked: boolean[];
  current: number;
  onGoto: (i: number) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const unanswered = answered.filter((x) => !x).length;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 soft-shadow">
      <h2 className="text-xl font-black text-blue-600">Review your answers</h2>
      <p className="text-sm text-slate-600 mt-1">
        {unanswered > 0
          ? `${unanswered} unanswered. Tap any number to jump back.`
          : "All questions answered. Submit when you're ready."}
      </p>
      <div className="mt-5 grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
        {questions.map((_, i) => {
          const a = answered[i];
          const m = marked[i];
          const cur = i === current;
          return (
            <button
              key={i}
              onClick={() => onGoto(i)}
              className={
                "relative aspect-square rounded-lg text-sm font-bold tabular-nums transition " +
                (cur
                  ? "ring-2 ring-primary "
                  : "") +
                (a
                  ? "bg-primary text-white "
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 ")
              }
            >
              {i + 1}
              {m && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-400 border border-white" />
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-6 flex justify-end">
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60 hover:bg-blue-700 transition"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Submit test
        </button>
      </div>
    </div>
  );
}

function ResultsView({
  result,
  type,
  onExit,
}: {
  result: Result;
  type: TestType;
  onExit: () => void;
}) {
  const pct = Math.round((result.correct / Math.max(1, result.total)) * 100);
  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-blue-600 to-blue-700 text-white overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-12 space-y-6">
        <div className="text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-white/60">
            {type === "mock" ? "Mock exam" : type === "daily" ? "Daily test" : "Practice"} complete
          </div>
          <div className="mt-3 text-7xl font-black tabular-nums">
            {result.scaled?.total ?? `${result.correct}/${result.total}`}
          </div>
          <p className="mt-2 text-white/70">
            {result.scaled
              ? "Approximate scaled score. Not official Bluebook curve."
              : `${pct}% correct`}
          </p>
        </div>
        {result.scaled && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white/10 p-5">
              <div className="text-xs uppercase tracking-wider text-white/60 font-bold">R&W</div>
              <div className="mt-2 text-4xl font-black tabular-nums">{result.scaled.rw}</div>
              <div className="mt-1 text-xs text-white/60">
                {result.rwCorrect}/{result.rwTotal} correct
              </div>
            </div>
            <div className="rounded-2xl bg-white/10 p-5">
              <div className="text-xs uppercase tracking-wider text-white/60 font-bold">Math</div>
              <div className="mt-2 text-4xl font-black tabular-nums">{result.scaled.math}</div>
              <div className="mt-1 text-xs text-white/60">
                {result.mathCorrect}/{result.mathTotal} correct
              </div>
            </div>
          </div>
        )}
        <div className="rounded-2xl bg-white/10 p-5 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/60 font-bold">Accuracy</div>
            <div className="mt-1 text-2xl font-black tabular-nums">{pct}%</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-white/60 font-bold">Answered</div>
            <div className="mt-1 text-2xl font-black tabular-nums">
              {result.correct}/{result.total}
            </div>
          </div>
        </div>
        <button
          onClick={onExit}
          className="w-full rounded-lg bg-white text-blue-600 px-6 py-3 text-sm font-bold hover:bg-white/90 transition"
        >
          Back to practice
        </button>
      </div>
    </div>
  );
}
