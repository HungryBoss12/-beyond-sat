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
import { AnimatedNumber } from "@/components/AnimatedNumber";
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

  /* Clamped rather than indexed straight: `idx` can outrun the array if the
     question list ever shrinks, and an out-of-range read here reaches
     QuestionCard as `undefined` and throws mid-render. */
  const q = questions.length > 0 ? questions[Math.min(idx, questions.length - 1)] : undefined;
  /* Driven off `questions`, not `answers`. `answers` is seeded from the initial
     questions and kept in component state, so if the question list ever changes
     length the two fall out of sync and `questions[i].kind` reads undefined —
     which throws during render and blanks the screen. Walking `questions` keeps
     the lengths aligned by construction. */
  const answered = useMemo(
    () => questions.map((qq, i) => (answers[i] ? isAnswered(answers[i], qq.kind) : false)),
    [answers, questions],
  );
  const answeredCount = answered.filter(Boolean).length;
  const marked = answers.map((a) => a.markedForReview);

  if (result) return <ResultsView result={result} type={type} onExit={() => navigate({ to: "/practice" })} />;

  if (!q || questions.length === 0) {
    return (
      <div className="grid h-[100dvh] w-full place-items-center bg-white px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-brand-400/40 bg-brand-600 p-8 text-center shadow-panel">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-800 text-white">
            <X className="h-6 w-6" />
          </span>
          <h1 className="mt-5 text-xl font-black tracking-tight text-white">
            No questions available
          </h1>
          <p className="mt-2 text-sm text-brand-100">
            This session has no questions to display. The questions may have been removed.
          </p>
          <button
            onClick={() => (onExit ? onExit() : navigate({ to: "/practice" }))}
            className="btn-brand mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-400 px-4 py-2.5 text-sm font-bold text-white"
          >
            Back to practice
          </button>
        </div>
      </div>
    );
  }

  /* Sized with dvh rather than `fixed inset-0` so the runner can't be collapsed
     by an animated/transformed ancestor turning into its containing block, and
     so mobile browser chrome doesn't clip the bottom nav row. */
  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white">
      {/* top bar — Bluebook-style with centered timer */}
      <div className="grid h-14 shrink-0 grid-cols-3 items-center border-b border-brand-400/40 bg-brand-600 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => (onExit ? onExit() : navigate({ to: "/practice" }))}
            className="tap grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-brand-400/50 text-brand-100 hover:bg-brand-800 hover:text-white"
            aria-label="Exit"
          >
            <X className="h-4 w-4" />
          </button>
          <span className="truncate text-sm font-black tracking-tight text-white">
            Beyond<span className="text-brand-100">SAT</span>
          </span>
          <span className="hidden truncate text-xs font-bold uppercase tracking-wider text-brand-100 sm:inline">
            {type === "mock" ? "Mock exam" : type === "daily" ? "Daily test" : "Practice"}
          </span>
        </div>
        <div className="flex justify-center">
          {durationSeconds > 0 ? (
            <div className="inline-flex items-center gap-2 rounded-xl bg-brand-900 px-5 py-1.5 text-lg font-black tabular-nums tracking-wider text-white">
              <Clock className="h-4 w-4" /> {fmt(timeLeft)}
            </div>
          ) : (
            <span className="text-xs font-bold uppercase tracking-wider text-brand-100">Untimed</span>
          )}
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => setShowReview((v) => !v)}
            className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-400"
          >
            <Flag className="h-3.5 w-3.5" /> Review {answeredCount}/{questions.length}
          </button>
        </div>
      </div>

      {/* body — min-h-0 is what lets this scroll instead of stretching the
          column and pushing the nav row off-screen. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
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
    <div className="relative flex h-16 shrink-0 items-center justify-between border-t border-brand-400/40 bg-brand-600 px-4 sm:px-6">
      <button
        onClick={onPrev}
        disabled={idx === 0 || showReview}
        className="tap group inline-flex items-center gap-2 rounded-lg border border-brand-400/50 bg-brand-800 px-4 py-2 text-sm font-bold text-white hover:bg-brand-400 disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
        Back
      </button>

      <div className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center">
        <button
          onClick={() => setOpen((v) => !v)}
          className="tap inline-flex items-center gap-2 rounded-lg bg-brand-900 px-4 py-2 text-sm font-bold tabular-nums text-white hover:bg-brand-800"
        >
          Question {idx + 1} of {total}
          <ChevronRight
            className={
              "h-4 w-4 transition-transform duration-300 " + (open ? "-rotate-90" : "rotate-90")
            }
          />
        </button>
        {open && (
          <div className="rise-in absolute bottom-full mb-3 w-[min(92vw,520px)] rounded-2xl border border-brand-400/40 bg-brand-600 p-4 shadow-float">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-100">
                Jump to question
              </span>
              <span className="text-xs tabular-nums text-brand-100">
                {answeredCount}/{total} answered
              </span>
            </div>
            <div className="grid grid-cols-8 gap-2 stagger-fast sm:grid-cols-10">
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
                      "tap relative h-10 rounded-lg text-sm font-bold tabular-nums " +
                      (cur ? "ring-2 ring-brand-100 ring-offset-2 ring-offset-brand-600 " : "") +
                      (a
                        ? "bg-brand-400 text-white "
                        : "bg-brand-800 text-brand-100 hover:bg-brand-900 hover:text-white ")
                    }
                  >
                    {i + 1}
                    {/* The "marked" dot was amber; it's the lightest brand step now. */}
                    {m && (
                      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-brand-600 bg-brand-100" />
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
        className="btn-brand group inline-flex items-center gap-2 rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:pointer-events-none disabled:opacity-40"
      >
        {isLast ? "Finish" : "Next"} <ChevronRight className="arrow-slide h-4 w-4" />
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
    <div className="rise-in rounded-2xl border border-brand-400/40 bg-brand-600 p-6 shadow-panel">
      <h2 className="text-xl font-black tracking-tight text-white">Review your answers</h2>
      <p className="mt-1 text-sm text-brand-100">
        {unanswered > 0
          ? `${unanswered} unanswered. Tap any number to jump back.`
          : "All questions answered. Submit when you're ready."}
      </p>
      <div className="mt-5 grid grid-cols-6 gap-2 stagger-fast sm:grid-cols-8 md:grid-cols-10">
        {questions.map((_, i) => {
          const a = answered[i];
          const m = marked[i];
          const cur = i === current;
          return (
            <button
              key={i}
              onClick={() => onGoto(i)}
              className={
                "tap relative aspect-square rounded-lg text-sm font-bold tabular-nums " +
                (cur ? "ring-2 ring-brand-100 ring-offset-2 ring-offset-brand-600 " : "") +
                (a
                  ? "bg-brand-400 text-white "
                  : "bg-brand-800 text-brand-100 hover:bg-brand-900 hover:text-white ")
              }
            >
              {i + 1}
              {m && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-brand-600 bg-brand-100" />
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-6 flex justify-end">
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="btn-brand inline-flex items-center gap-2 rounded-lg bg-brand-400 px-5 py-2.5 text-sm font-bold text-white disabled:pointer-events-none disabled:opacity-60"
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
    <div className="relative h-[100dvh] w-full overflow-y-auto bg-grad-brand text-white">
      {/* Ambient decoration so the full-bleed gradient isn't a flat wall. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="drift absolute -right-24 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div
          className="drift absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-white/[0.07] blur-3xl"
          style={{ animationDelay: "-7s" }}
        />
      </div>
      <div className="relative mx-auto max-w-2xl space-y-6 px-6 py-12">
        <div className="rise-in text-center">
          {/* Labels are the light brand step at full opacity rather than faded
              white, so nothing on the gradient reads as dimmed. */}
          <div className="text-xs font-bold uppercase tracking-widest text-brand-100">
            {type === "mock" ? "Mock exam" : type === "daily" ? "Daily test" : "Practice"} complete
          </div>
          <div className="pop-in mt-3 text-7xl font-black">
            {result.scaled ? (
              <AnimatedNumber value={result.scaled.total} duration={1400} />
            ) : (
              <span className="tabular-nums">
                {result.correct}/{result.total}
              </span>
            )}
          </div>
          <p className="mt-2 text-brand-100">
            {result.scaled
              ? "Approximate scaled score. Not official Bluebook curve."
              : `${pct}% correct`}
          </p>
        </div>
        {result.scaled && (
          <div className="grid grid-cols-2 gap-4 stagger">
            <div className="rounded-2xl bg-brand-800 p-5 ring-1 ring-brand-300/40">
              <div className="text-xs font-bold uppercase tracking-wider text-brand-100">R&amp;W</div>
              <div className="mt-2 text-4xl font-black">
                <AnimatedNumber value={result.scaled.rw} duration={1100} />
              </div>
              <div className="mt-1 text-xs text-brand-100">
                {result.rwCorrect}/{result.rwTotal} correct
              </div>
            </div>
            <div className="rounded-2xl bg-brand-800 p-5 ring-1 ring-brand-300/40">
              <div className="text-xs font-bold uppercase tracking-wider text-brand-100">Math</div>
              <div className="mt-2 text-4xl font-black">
                <AnimatedNumber value={result.scaled.math} duration={1100} />
              </div>
              <div className="mt-1 text-xs text-brand-100">
                {result.mathCorrect}/{result.mathTotal} correct
              </div>
            </div>
          </div>
        )}
        <div className="rise-in flex items-center justify-between rounded-2xl bg-brand-800 p-5 ring-1 ring-brand-300/40">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-brand-100">Accuracy</div>
            <div className="mt-1 text-2xl font-black">
              <AnimatedNumber value={pct} suffix="%" duration={900} />
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold uppercase tracking-wider text-brand-100">Answered</div>
            <div className="mt-1 text-2xl font-black tabular-nums">
              {result.correct}/{result.total}
            </div>
          </div>
        </div>
        <button
          onClick={onExit}
          className="tap w-full rounded-xl bg-brand-400 px-6 py-3.5 text-sm font-bold text-white ring-1 ring-brand-200/50 hover:bg-brand-300"
        >
          Back to practice
        </button>
      </div>
    </div>
  );
}
