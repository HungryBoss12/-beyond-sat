import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Loader2,
  MoreVertical,
  NotebookPen,
  X,
} from "lucide-react";
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
  /** Total exam time in seconds; when 0, no timer. Used when mockSchedule is absent. */
  durationSeconds?: number;
  /** Full-mock section clocks + break between R&W and Math. */
  mockSchedule?: {
    rwSeconds: number;
    mathSeconds: number;
    breakSeconds: number;
  };
  /** Hydrated from test_sessions.metadata.draft_answers on Resume. */
  initialAnswers?: AnswerState[];
  /** Current session metadata (question_ids, etc.) — drafts are merged into this. */
  sessionMetadata?: Record<string, unknown>;
  onExit?: () => void;
};

type MockPhase = "rw" | "break" | "math";

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function readMockPhase(meta: Record<string, unknown> | undefined): MockPhase | null {
  const p = meta?.mock_phase;
  if (p === "rw" || p === "break" || p === "math") return p;
  return null;
}

function indicesForSection(questions: QuestionRow[], section: "reading_writing" | "math") {
  const out: number[] = [];
  questions.forEach((q, i) => {
    if (q.section === section) out.push(i);
  });
  return out;
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
  mockSchedule,
  initialAnswers,
  sessionMetadata,
  onExit,
}: Props) {
  const navigate = useNavigate();
  const rwIndices = useMemo(
    () => indicesForSection(questions, "reading_writing"),
    [questions],
  );
  const mathIndices = useMemo(() => indicesForSection(questions, "math"), [questions]);
  const useSections =
    type === "mock" && Boolean(mockSchedule) && rwIndices.length > 0 && mathIndices.length > 0;

  const [phase, setPhase] = useState<MockPhase>(() => {
    if (!(type === "mock" && mockSchedule)) return "rw";
    const rw = indicesForSection(questions, "reading_writing");
    const math = indicesForSection(questions, "math");
    if (rw.length === 0 || math.length === 0) return "rw";
    return readMockPhase(sessionMetadata) ?? "rw";
  });

  const [idx, setIdx] = useState(() => {
    if (!(type === "mock" && mockSchedule)) return 0;
    const rw = indicesForSection(questions, "reading_writing");
    const math = indicesForSection(questions, "math");
    if (rw.length === 0 || math.length === 0) return 0;
    const p = readMockPhase(sessionMetadata) ?? "rw";
    const savedIdx = sessionMetadata?.mock_idx;
    if (p === "math") {
      if (typeof savedIdx === "number" && math.includes(savedIdx)) return savedIdx;
      return math[0] ?? 0;
    }
    if (p === "break") return rw[rw.length - 1] ?? 0;
    if (typeof savedIdx === "number" && rw.includes(savedIdx)) return savedIdx;
    return rw[0] ?? 0;
  });

  const [answers, setAnswers] = useState<AnswerState[]>(() =>
    initialAnswers && initialAnswers.length === questions.length
      ? initialAnswers
      : questions.map(() => emptyAnswer()),
  );
  const [showReview, setShowReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (!(type === "mock" && mockSchedule)) return durationSeconds;
    const rw = indicesForSection(questions, "reading_writing");
    const math = indicesForSection(questions, "math");
    if (rw.length === 0 || math.length === 0) return durationSeconds;
    const p = readMockPhase(sessionMetadata) ?? "rw";
    const saved =
      typeof sessionMetadata?.mock_time_left === "number"
        ? (sessionMetadata.mock_time_left as number)
        : null;
    if (saved != null && saved >= 0) return saved;
    if (p === "break") return mockSchedule.breakSeconds;
    if (p === "math") return mockSchedule.mathSeconds;
    return mockSchedule.rwSeconds;
  });
  /* Bluebook chrome state. Directions and the notes panel are disclosures in
     the header; the clock has a Hide control because a visible countdown is a
     documented source of test anxiety and the real app lets you turn it off. */
  const [showDirections, setShowDirections] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [hideTimer, setHideTimer] = useState(false);
  const [studentName, setStudentName] = useState("");
  const startedRef = useRef<number>(Date.now());
  const questionStartRef = useRef<number>(Date.now());
  const timePerQ = useRef<number[]>(questions.map(() => 0));
  const metaRef = useRef<Record<string, unknown>>(sessionMetadata ?? {});
  const metadataWriteChainRef = useRef(Promise.resolve());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef(phase);
  const submittingRef = useRef(false);
  const submitRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (Object.keys(metaRef.current).length === 0 && sessionMetadata) {
      metaRef.current = sessionMetadata;
    }
  }, [sessionMetadata]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  /* The footer carries the candidate's name, as Bluebook's does. Fetched here
     rather than threaded down from the route because both callers would
     otherwise need it, and a failure is cosmetic — the slot just stays empty. */
  useEffect(() => {
    if (!userId) return;
    let live = true;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name,first_name")
        .eq("id", userId)
        .maybeSingle();
      if (live && data) setStudentName(data.full_name || data.first_name || "");
    })();
    return () => {
      live = false;
    };
  }, [userId]);

  // Keep a ref to the latest answers so the timer's auto-submit (whose closure
  // is captured on mount) reads current answers rather than the initial blanks.
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  /** Merge into metaRef sync, then serialize DB writes so mock progress and drafts cannot clobber each other. */
  function patchSessionMetadata(patch: Record<string, unknown>) {
    if (submittingRef.current) return Promise.resolve();
    metaRef.current = { ...metaRef.current, ...patch };
    metadataWriteChainRef.current = metadataWriteChainRef.current
      .then(async () => {
        if (submittingRef.current) return;
        const snapshot = { ...metaRef.current };
        const { error } = await supabase
          .from("test_sessions")
          .update({ metadata: snapshot })
          .eq("id", sessionId);
        if (error) console.error("[session metadata]", error);
      })
      .catch((e) => console.error("[session metadata]", e));
    return metadataWriteChainRef.current;
  }

  function persistMockProgress(patch: {
    phase?: MockPhase;
    timeLeft?: number;
    idx?: number;
  }) {
    if (!useSections) return;
    void patchSessionMetadata({
      ...(patch.phase != null ? { mock_phase: patch.phase } : {}),
      ...(patch.timeLeft != null ? { mock_time_left: patch.timeLeft } : {}),
      ...(patch.idx != null ? { mock_idx: patch.idx } : {}),
    });
  }

  function scheduleDraftSave(next: AnswerState[]) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void patchSessionMetadata({ draft_answers: next });
    }, 400);
  }

  function enterMath() {
    if (!mockSchedule) return;
    const first = mathIndices[0] ?? 0;
    setPhase("math");
    setTimeLeft(mockSchedule.mathSeconds);
    setIdx(first);
    setShowReview(false);
    questionStartRef.current = Date.now();
    persistMockProgress({
      phase: "math",
      timeLeft: mockSchedule.mathSeconds,
      idx: first,
    });
  }

  function enterBreakOrMath() {
    if (!mockSchedule) return;
    setShowReview(false);
    if (mockSchedule.breakSeconds > 0) {
      setPhase("break");
      setTimeLeft(mockSchedule.breakSeconds);
      persistMockProgress({
        phase: "break",
        timeLeft: mockSchedule.breakSeconds,
      });
    } else {
      enterMath();
    }
  }

  const showClock = useSections
    ? phase === "break"
      ? (mockSchedule?.breakSeconds ?? 0) > 0
      : phase === "rw"
        ? (mockSchedule?.rwSeconds ?? 0) > 0
        : (mockSchedule?.mathSeconds ?? 0) > 0
    : durationSeconds > 0;

  useEffect(() => {
    if (!showClock) return;
    const t = setInterval(() => {
      setTimeLeft((v) => {
        const next = v - 1;
        if (next <= 0) {
          clearInterval(t);
          const p = phaseRef.current;
          if (useSections) {
            if (p === "rw") {
              queueMicrotask(() => enterBreakOrMath());
              return 0;
            }
            if (p === "break") {
              queueMicrotask(() => enterMath());
              return 0;
            }
            void submitRef.current();
            return 0;
          }
          void submitRef.current();
          return 0;
        }
        if (useSections && next % 20 === 0) {
          persistMockProgress({ timeLeft: next, phase: phaseRef.current });
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showClock, phase, useSections]);

  function updateAnswer(i: number, a: AnswerState) {
    setAnswers((prev) => {
      const copy = [...prev];
      copy[i] = a;
      answersRef.current = copy;
      scheduleDraftSave(copy);
      return copy;
    });
  }

  function requestExit() {
    const hasProgress = questions.some((qq, i) =>
      answers[i] ? isAnswered(answers[i], qq.kind) || answers[i].markedForReview : false,
    );
    if (hasProgress) {
      const ok = window.confirm(
        "Leave without submitting? Your answers are saved and you can Resume this set.",
      );
      if (!ok) return;
    }
    if (useSections) {
      persistMockProgress({ phase, timeLeft, idx });
    }
    if (onExit) onExit();
    else navigate({ to: "/practice" });
  }

  function goto(i: number) {
    if (useSections) {
      if (phase === "break") return;
      if (phase === "rw" && !rwIndices.includes(i)) return;
      if (phase === "math" && !mathIndices.includes(i)) return;
    }
    // record time for current question
    const elapsed = Math.round((Date.now() - questionStartRef.current) / 1000);
    timePerQ.current[idx] = (timePerQ.current[idx] ?? 0) + elapsed;
    questionStartRef.current = Date.now();
    setIdx(i);
    setShowReview(false);
    if (useSections) persistMockProgress({ idx: i, phase, timeLeft });
  }

  async function submit() {
    if (submitting || result) return;
    setSubmitting(true);
    submittingRef.current = true;
    setSubmitError(null);
    try {
      const elapsed = Math.round((Date.now() - questionStartRef.current) / 1000);
      timePerQ.current[idx] = (timePerQ.current[idx] ?? 0) + elapsed;

      let correct = 0;
      let rwC = 0,
        rwT = 0,
        mC = 0,
        mT = 0;
      const currentAnswers = answersRef.current;
      const gradeFailures: string[] = [];
      const attempts = await Promise.all(
        questions.map(async (q, i) => {
          const a = currentAnswers[i];
          let isCorrect: boolean | null = null;
          const hasAnswer = q.kind === "grid_in" ? !!a.gridAnswer.trim() : !!a.selectedChoiceId;
          if (hasAnswer) {
            const { data, error: gradeErr } = await supabase.rpc("grade_answer", {
              p_question_id: q.id,
              p_choice_id: a.selectedChoiceId ?? "",
              p_grid_answer: a.gridAnswer || "",
            });
            if (gradeErr) {
              gradeFailures.push(gradeErr.message || `Question ${i + 1} could not be graded`);
            } else {
              isCorrect = (data as boolean | null) ?? null;
            }
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

      if (gradeFailures.length > 0) {
        throw new Error(
          `Could not grade ${gradeFailures.length} question${gradeFailures.length === 1 ? "" : "s"}. Your session is still saved — try Submit again.`,
        );
      }

      const { error: aErr } = await supabase.from("attempts").insert(attempts);
      if (aErr) {
        throw new Error(
          aErr.message || "Could not save your answers. Your session is still saved — try Submit again.",
        );
      }

      const scaled =
        type === "mock"
          ? {
              rw: scaledScore(rwC, rwT, "reading_writing"),
              math: scaledScore(mC, mT, "math"),
              total: scaledScore(rwC, rwT, "reading_writing") + scaledScore(mC, mT, "math"),
            }
          : null;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      await metadataWriteChainRef.current.catch(() => {});
      metaRef.current = { ...metaRef.current, draft_answers: null };
      const { error: completeErr } = await supabase
        .from("test_sessions")
        .update({
          completed_at: new Date().toISOString(),
          correct_count: correct,
          total_questions: questions.length,
          rw_score: scaled?.rw ?? null,
          math_score: scaled?.math ?? null,
          score: scaled?.total ?? correct,
          metadata: { ...metaRef.current },
        })
        .eq("id", sessionId);
      if (completeErr) {
        throw new Error(
          completeErr.message || "Could not finish the session. Try Submit again.",
        );
      }

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
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submit failed. Try again.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }
  submitRef.current = submit;

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

  if (result)
    return <ResultsView result={result} type={type} onExit={() => navigate({ to: "/practice" })} />;

  if (!q || questions.length === 0) {
    return (
      <div className="grid h-[100dvh] w-full place-items-center bg-test-chrome px-4 py-10">
        <div className="w-full max-w-md rounded-lg border border-test-line bg-white p-8 text-center shadow-panel">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-test-tint text-test-accent ring-1 ring-test-line">
            <X className="h-6 w-6" />
          </span>
          <h1 className="mt-5 text-xl font-black tracking-tight text-test-ink">
            No questions available
          </h1>
          <p className="mt-2 text-sm text-test-muted">
            This session has no questions to display. The questions may have been removed.
          </p>
          <button
            onClick={() => (onExit ? onExit() : navigate({ to: "/practice" }))}
            className="btn-test mt-6 inline-flex items-center gap-2 rounded-full bg-test-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-test-accent-deep"
          >
            Back to practice
          </button>
        </div>
      </div>
    );
  }

  const sectionLabel =
    phase === "break"
      ? "Break"
      : q.section === "math"
        ? "Math"
        : "Reading and Writing";
  const moduleLabel =
    type === "mock"
      ? `Mock · ${sectionLabel}`
      : `${type === "daily" ? "Daily Test" : "Practice"}: ${sectionLabel}`;

  const activeIndices = useSections
    ? phase === "math"
      ? mathIndices
      : rwIndices
    : questions.map((_, i) => i);
  const localPos = activeIndices.indexOf(idx);
  const isFirstInSection = localPos <= 0;
  const isLastInSection = localPos >= activeIndices.length - 1;
  const displayTotal = useSections ? activeIndices.length : questions.length;
  const displayNum = useSections ? Math.max(1, localPos + 1) : idx + 1;
  const sectionAnsweredCount = useSections
    ? activeIndices.filter((i) => answered[i]).length
    : answeredCount;

  /* Sized with dvh rather than `fixed inset-0` so the runner can't be collapsed
     by an animated/transformed ancestor turning into its containing block, and
     so mobile browser chrome doesn't clip the bottom nav row. */
  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-test-canvas">
      {/* ------------------------------------------------------------------
          Header. Bluebook's is a light bar, not dark chrome: module name and a
          Directions disclosure at the left, the clock dead centre with Hide
          beneath it, and the tool buttons at the right. The dashed rule below
          it is Bluebook's own separator and is the cue students read as "the
          bar above is chrome, everything below is the exam".
          ------------------------------------------------------------------ */}
      <header className="shrink-0 bg-test-chrome">
        <div className="grid grid-cols-3 items-start gap-2 px-4 pb-2 pt-3 sm:px-6">
          <div className="flex min-w-0 flex-col items-start">
            <div className="flex items-center gap-2">
              <button
                onClick={requestExit}
                className="tap grid h-7 w-7 shrink-0 place-items-center rounded text-test-muted hover:bg-test-well hover:text-test-ink"
                aria-label="Exit"
              >
                <X className="h-4 w-4" />
              </button>
              <span className="truncate text-[15px] font-bold text-test-ink">{moduleLabel}</span>
            </div>
            {phase !== "break" && (
              <button
                onClick={() => setShowDirections((v) => !v)}
                aria-expanded={showDirections}
                className="tap mt-0.5 inline-flex items-center gap-1 rounded pl-9 pr-1 text-[13px] text-test-ink hover:underline"
              >
                Directions
                {showDirections ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>

          <div className="flex flex-col items-center">
            {showClock ? (
              <>
                {/* The digits keep their box when hidden — a collapsing clock
                    shifts the whole header every time you toggle it. */}
                <div
                  className={
                    "text-[26px] font-bold leading-none tabular-nums text-test-ink " +
                    (hideTimer ? "invisible" : "")
                  }
                >
                  {fmt(timeLeft)}
                </div>
                <button
                  onClick={() => setHideTimer((v) => !v)}
                  className="tap mt-1 rounded-full border border-test-ink px-3 py-0.5 text-xs font-semibold text-test-ink hover:bg-test-well"
                >
                  {hideTimer ? "Show" : "Hide"}
                </button>
              </>
            ) : (
              <div className="inline-flex items-center gap-1.5 pt-1 text-sm font-semibold text-test-muted">
                <Clock className="h-4 w-4" /> Untimed
              </div>
            )}
          </div>

          <div className="flex items-start justify-end gap-1">
            {phase !== "break" && (
            <button
              onClick={() => setShowNotes((v) => !v)}
              aria-pressed={showNotes}
              className={
                "tap inline-flex flex-col items-center rounded px-2 py-1 text-[11px] font-semibold " +
                (showNotes ? "bg-test-well text-test-accent" : "text-test-ink hover:bg-test-well")
              }
            >
              <NotebookPen className="h-5 w-5" />
              <span className="mt-0.5 hidden sm:inline">Notes</span>
            </button>
            )}
            {/* Bluebook's ⋮ is a menu, not a shortcut, and the two things a
                student reaches for from it are the review page and the exit. */}
            <div className="relative">
              <button
                onClick={() => setShowMore((v) => !v)}
                aria-expanded={showMore}
                className={
                  "tap inline-flex flex-col items-center rounded px-2 py-1 text-[11px] font-semibold " +
                  (showMore ? "bg-test-well text-test-accent" : "text-test-ink hover:bg-test-well")
                }
              >
                <MoreVertical className="h-5 w-5" />
                <span className="mt-0.5 hidden sm:inline">More</span>
              </button>
              {showMore && (
                <>
                  {/* A menu left open floats over the question and swallows
                      clicks on the options underneath, which in a timed sitting
                      reads as the app having frozen. The backdrop both dismisses
                      it and absorbs that first stray click. */}
                  <button
                    aria-label="Close menu"
                    onClick={() => setShowMore(false)}
                    className="fixed inset-0 z-30 cursor-default"
                  />
                  <div className="pop-in absolute right-0 top-full z-40 mt-1 w-56 overflow-hidden rounded-lg border border-test-line bg-white py-1 text-left shadow-float">
                    {phase !== "break" && (
                    <button
                      onClick={() => {
                        setShowMore(false);
                        setShowReview(true);
                      }}
                      className="tap block w-full px-4 py-2 text-left text-sm text-test-ink hover:bg-test-well"
                    >
                      Go to Review Page
                    </button>
                    )}
                    {phase !== "break" && (
                    <button
                      onClick={() => {
                        setShowMore(false);
                        setShowDirections((v) => !v);
                      }}
                      className="tap block w-full px-4 py-2 text-left text-sm text-test-ink hover:bg-test-well"
                    >
                      {showDirections ? "Hide" : "Show"} directions
                    </button>
                    )}
                    <div className="my-1 border-t border-test-line" />
                    <button
                      onClick={() => {
                        setShowMore(false);
                        requestExit();
                      }}
                      className="tap block w-full px-4 py-2 text-left text-sm text-test-ink hover:bg-test-well"
                    >
                      Exit without submitting
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {showDirections && phase !== "break" && (
          <div className="rise-in max-h-[40vh] overflow-y-auto border-t border-test-line bg-white px-4 py-4 text-[15px] leading-relaxed text-test-ink sm:px-6">
            {q.section === "math" ? (
              <>
                <p>
                  The questions in this section address a number of important math skills. Use of a
                  calculator is permitted for all questions.
                </p>
                <p className="mt-3">
                  For multiple-choice questions, solve each problem and choose the correct answer
                  from the choices provided. For student-produced response questions, solve each
                  problem and enter your answer as described below.
                </p>
                <ul className="mt-3 list-disc space-y-1 pl-6">
                  <li>If you find more than one correct answer, enter only one answer.</li>
                  <li>
                    You can enter up to 5 characters for a positive answer and up to 6 characters
                    (including the negative sign) for a negative answer.
                  </li>
                  <li>
                    If your answer is a fraction that doesn't fit in the space, enter the decimal
                    equivalent.
                  </li>
                  <li>
                    If your answer is a decimal that doesn't fit, truncate or round at the fourth
                    digit.
                  </li>
                  <li>Don't enter symbols such as a percent sign, comma, or dollar sign.</li>
                </ul>
              </>
            ) : (
              <>
                <p>
                  The questions in this section address a number of important reading and writing
                  skills. Each question includes one or more passages, which may include a table or
                  graph. Read each passage and question carefully, then choose the best answer to
                  the question based on the passage or passages.
                </p>
                <p className="mt-3">
                  All questions in this section are multiple-choice with four answer options. Each
                  question has a single best answer.
                </p>
              </>
            )}
          </div>
        )}
        <div className="border-b border-dashed border-test-edge" />
      </header>

      {/* Bluebook's blue title strip. It carries the name of the thing you are
          sitting, which is the one piece of orientation the header itself
          doesn't give — the header names the section, not the test. */}
      <div className="shrink-0 bg-test-banner px-4 py-1 text-center sm:px-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white">
          {phase === "break"
            ? "Section Break"
            : type === "mock"
              ? "Mock Exam"
              : type === "daily"
                ? "Daily Test"
                : "Practice Test"}
          <span className="hidden sm:inline"> · BeyondSAT</span>
        </span>
      </div>

      {/* body — min-h-0 is what lets the panes scroll instead of stretching the
          column and pushing the footer off-screen. */}
      {phase === "break" ? (
        <BreakScreen
          timeLeft={timeLeft}
          onEndEarly={() => enterMath()}
        />
      ) : showReview ? (
        <div className="min-h-0 flex-1 overflow-y-auto bg-test-chrome px-4 py-8 sm:px-6">
          <ReviewPanel
            questions={questions}
            answered={answered}
            marked={marked}
            current={idx}
            moduleLabel={
              useSections
                ? phase === "math"
                  ? "Math"
                  : "Reading and Writing"
                : moduleLabel
            }
            rwIndices={useSections ? rwIndices : undefined}
            mathIndices={useSections ? mathIndices : undefined}
            allowedIndices={useSections ? activeIndices : undefined}
            onGoto={(i) => goto(i)}
            onSubmit={
              useSections && phase === "rw"
                ? () => enterBreakOrMath()
                : submit
            }
            submitLabel={
              useSections && phase === "rw"
                ? mockSchedule && mockSchedule.breakSeconds > 0
                  ? "Start break"
                  : "Continue to Math"
                : "Submit"
            }
            submitting={submitting}
            submitError={submitError}
          />
        </div>
      ) : (
        <QuestionCard
          q={q}
          index={idx}
          answer={answers[idx]}
          onChange={(a) => updateAnswer(idx, a)}
          showNotes={showNotes}
          onCloseNotes={() => setShowNotes(false)}
        />
      )}

      {/* bottom bar with centered question navigator popover */}
      {phase !== "break" && (
        <BottomBar
          displayNum={displayNum}
          displayTotal={displayTotal}
          idx={idx}
          answered={answered}
          marked={marked}
          answeredCount={sectionAnsweredCount}
          showReview={showReview}
          studentName={studentName}
          rwIndices={useSections ? rwIndices : undefined}
          mathIndices={useSections ? mathIndices : undefined}
          lockedIndices={
            useSections
              ? phase === "rw"
                ? mathIndices
                : rwIndices
              : undefined
          }
          onPrev={() => {
            if (useSections) {
              const pos = activeIndices.indexOf(idx);
              if (pos > 0) goto(activeIndices[pos - 1]!);
            } else {
              goto(Math.max(0, idx - 1));
            }
          }}
          onNext={() => {
            if (useSections) {
              const pos = activeIndices.indexOf(idx);
              if (pos >= 0 && pos < activeIndices.length - 1) {
                goto(activeIndices[pos + 1]!);
              } else {
                setShowReview(true);
              }
            } else if (idx < questions.length - 1) {
              goto(idx + 1);
            } else {
              setShowReview(true);
            }
          }}
          onGoto={(i) => goto(i)}
          isFirst={isFirstInSection}
          isLast={isLastInSection}
        />
      )}
      {phase !== "break" && q?.section === "math" && <DesmosCalculator />}
    </div>
  );
}

function BreakScreen({
  timeLeft,
  onEndEarly,
}: {
  timeLeft: number;
  onEndEarly: () => void;
}) {
  return (
    <div className="rise-in flex min-h-0 flex-1 flex-col items-center justify-center bg-test-chrome px-6 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-test-muted">Section break</p>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-test-ink">
        Reading and Writing complete
      </h2>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-test-ink">
        Take a break before Math. Time remaining counts down automatically — you can end early when
        you are ready.
      </p>
      <div className="mt-8 text-5xl font-bold tabular-nums text-test-ink">{fmt(timeLeft)}</div>
      <button
        onClick={onEndEarly}
        className="btn-test mt-8 rounded-full bg-test-accent px-8 py-2.5 text-sm font-bold text-white hover:bg-test-accent-deep"
      >
        End break · Start Math
      </button>
    </div>
  );
}

function QuestionSectionGrid({
  title,
  indices,
  answered,
  marked,
  current,
  locked,
  onGoto,
  onPicked,
}: {
  title: string;
  indices: number[];
  answered: boolean[];
  marked: boolean[];
  current: number;
  locked?: boolean;
  onGoto: (i: number) => void;
  onPicked?: () => void;
}) {
  if (indices.length === 0) return null;
  return (
    <div className={locked ? "opacity-50" : ""}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-test-muted">{title}</h3>
        {locked && <span className="text-[11px] font-semibold text-test-muted">Locked</span>}
      </div>
      <div className="grid grid-cols-8 gap-2 stagger-fast sm:grid-cols-10">
        {indices.map((i, local) => {
          const a = answered[i];
          const m = marked[i];
          const cur = i === current;
          return (
            <button
              key={i}
              disabled={locked}
              onClick={() => {
                if (locked) return;
                onGoto(i);
                onPicked?.();
              }}
              className={
                "tap relative h-9 rounded-sm text-sm font-semibold tabular-nums disabled:cursor-not-allowed " +
                (cur ? "ring-2 ring-test-accent ring-offset-2 ring-offset-white " : "") +
                (a
                  ? "bg-test-dark text-white "
                  : "border border-dashed border-test-ink text-test-ink hover:bg-test-well ")
              }
            >
              {local + 1}
              {m && (
                <Bookmark className="absolute -right-1 -top-1.5 h-3.5 w-3.5 fill-test-accent text-test-accent" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BottomBar({
  displayNum,
  displayTotal,
  idx,
  answered,
  marked,
  answeredCount,
  showReview,
  studentName,
  rwIndices,
  mathIndices,
  lockedIndices,
  onPrev,
  onNext,
  onGoto,
  isFirst,
  isLast,
}: {
  displayNum: number;
  displayTotal: number;
  idx: number;
  answered: boolean[];
  marked: boolean[];
  answeredCount: number;
  showReview: boolean;
  studentName: string;
  rwIndices?: number[];
  mathIndices?: number[];
  lockedIndices?: number[];
  onPrev: () => void;
  onNext: () => void;
  onGoto: (i: number) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(false);
  const split = Boolean(rwIndices && mathIndices);
  const locked = new Set(lockedIndices ?? []);
  const totalShown = split
    ? (rwIndices?.length ?? 0) + (mathIndices?.length ?? 0)
    : displayTotal;

  return (
    /* Bluebook's footer: candidate name at the left, the question navigator as
       a dark pill dead centre, Back and Next at the right. Same light grey as
       the header so the exam itself is the only white region on the screen. */
    <div className="relative flex h-16 shrink-0 items-center justify-between border-t border-test-line bg-test-chrome px-4 sm:px-6">
      <span className="hidden min-w-0 flex-1 truncate text-sm font-bold text-test-ink sm:block">
        {studentName}
      </span>

      <div className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="tap inline-flex items-center gap-2 rounded-md bg-test-dark px-4 py-1.5 text-sm font-semibold tabular-nums text-white hover:bg-test-accent-deep"
        >
          Question {displayNum} of {displayTotal}
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        {open && (
          <div className="rise-in absolute bottom-full mb-3 max-h-[70vh] w-[min(92vw,540px)] overflow-y-auto rounded-lg border border-test-line bg-white p-4 shadow-float">
            <div className="border-b border-test-line pb-3 text-center text-sm font-bold text-test-ink">
              Jump to question
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 py-3 text-xs text-test-ink">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded-sm border border-dashed border-test-ink" />
                Unanswered
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded-sm bg-test-dark" />
                Answered
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Bookmark className="h-3.5 w-3.5 fill-test-accent text-test-accent" />
                For review
              </span>
              <span className="tabular-nums text-test-muted">
                {answeredCount}/{displayTotal}
              </span>
            </div>
            {split ? (
              <div className="space-y-5">
                <QuestionSectionGrid
                  title="Reading and Writing"
                  indices={rwIndices!}
                  answered={answered}
                  marked={marked}
                  current={idx}
                  locked={rwIndices!.some((i) => locked.has(i))}
                  onGoto={onGoto}
                  onPicked={() => setOpen(false)}
                />
                <QuestionSectionGrid
                  title="Math"
                  indices={mathIndices!}
                  answered={answered}
                  marked={marked}
                  current={idx}
                  locked={mathIndices!.some((i) => locked.has(i))}
                  onGoto={onGoto}
                  onPicked={() => setOpen(false)}
                />
              </div>
            ) : (
              <div className="grid grid-cols-8 gap-2 stagger-fast sm:grid-cols-10">
                {Array.from({ length: totalShown }).map((_, i) => {
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
                        "tap relative h-9 rounded-sm text-sm font-semibold tabular-nums " +
                        (cur ? "ring-2 ring-test-accent ring-offset-2 ring-offset-white " : "") +
                        (a
                          ? "bg-test-dark text-white "
                          : "border border-dashed border-test-ink text-test-ink hover:bg-test-well ")
                      }
                    >
                      {i + 1}
                      {m && (
                        <Bookmark className="absolute -right-1 -top-1.5 h-3.5 w-3.5 fill-test-accent text-test-accent" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">
        <button
          onClick={onPrev}
          disabled={isFirst || showReview}
          className="tap group inline-flex items-center gap-1.5 rounded-full border border-test-accent bg-white px-5 py-2 text-sm font-bold text-test-accent hover:bg-test-tint disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
          Back
        </button>
        <button
          onClick={onNext}
          disabled={showReview}
          className="btn-test group inline-flex items-center gap-1.5 rounded-full bg-test-accent px-5 py-2 text-sm font-bold text-white hover:bg-test-accent-deep disabled:pointer-events-none disabled:opacity-40"
        >
          {isLast ? "Review" : "Next"} <ChevronRight className="arrow-slide h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ReviewPanel({
  questions,
  answered,
  marked,
  current,
  moduleLabel,
  rwIndices,
  mathIndices,
  allowedIndices,
  onGoto,
  onSubmit,
  submitLabel = "Submit",
  submitting,
  submitError,
}: {
  questions: QuestionRow[];
  answered: boolean[];
  marked: boolean[];
  current: number;
  moduleLabel: string;
  rwIndices?: number[];
  mathIndices?: number[];
  allowedIndices?: number[];
  onGoto: (i: number) => void;
  onSubmit: () => void;
  submitLabel?: string;
  submitting: boolean;
  submitError?: string | null;
}) {
  const allowed = allowedIndices ? new Set(allowedIndices) : null;
  const unanswered = (allowedIndices ?? questions.map((_, i) => i)).filter(
    (i) => !answered[i],
  ).length;
  const split = Boolean(rwIndices && mathIndices);

  return (
    /* Bluebook's Review Page: a centred column on the grey field, headed by the
       module name, with the same grid and legend as the footer navigator. */
    <div className="rise-in mx-auto max-w-3xl">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-test-ink">Check Your Work</h2>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-test-ink">
          On test day, you won't be able to move on to the next module until time expires. For these
          practice questions, you can click <strong>{submitLabel}</strong> when you're ready to move
          on.
        </p>
      </div>

      <div className="mt-8 rounded-lg border border-test-line bg-white p-6">
        <div className="border-b border-test-line pb-3 text-center text-sm font-bold text-test-ink">
          {moduleLabel}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 py-4 text-xs text-test-ink">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded-sm border border-dashed border-test-ink" />
            Unanswered
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded-sm bg-test-dark" />
            Answered
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Bookmark className="h-3.5 w-3.5 fill-test-accent text-test-accent" />
            For review
          </span>
        </div>
        {split ? (
          <div className="space-y-5">
            <QuestionSectionGrid
              title="Reading and Writing"
              indices={rwIndices!}
              answered={answered}
              marked={marked}
              current={current}
              locked={allowed ? rwIndices!.some((i) => !allowed.has(i)) : false}
              onGoto={onGoto}
            />
            <QuestionSectionGrid
              title="Math"
              indices={mathIndices!}
              answered={answered}
              marked={marked}
              current={current}
              locked={allowed ? mathIndices!.some((i) => !allowed.has(i)) : false}
              onGoto={onGoto}
            />
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-2.5 stagger-fast sm:grid-cols-8 md:grid-cols-10">
            {questions.map((_, i) => {
              const a = answered[i];
              const m = marked[i];
              const cur = i === current;
              return (
                <button
                  key={i}
                  onClick={() => onGoto(i)}
                  className={
                    "tap relative aspect-square rounded-sm text-sm font-semibold tabular-nums " +
                    (cur ? "ring-2 ring-test-accent ring-offset-2 ring-offset-white " : "") +
                    (a
                      ? "bg-test-dark text-white "
                      : "border border-dashed border-test-ink text-test-ink hover:bg-test-well ")
                  }
                >
                  {i + 1}
                  {m && (
                    <Bookmark className="absolute -right-1 -top-1.5 h-3.5 w-3.5 fill-test-accent text-test-accent" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        <p className="text-sm text-test-muted">
          {unanswered > 0
            ? `${unanswered} unanswered. Click any number to jump back.`
            : "All questions answered."}
        </p>
        {submitError ? (
          <p className="max-w-md text-center text-sm font-medium text-red-600" role="alert">
            {submitError}
          </p>
        ) : null}
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="btn-test inline-flex items-center gap-2 rounded-full bg-test-accent px-8 py-2.5 text-sm font-bold text-white hover:bg-test-accent-deep disabled:pointer-events-none disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitLabel}
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
              <div className="text-xs font-bold uppercase tracking-wider text-brand-100">
                R&amp;W
              </div>
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
            <div className="text-xs font-bold uppercase tracking-wider text-brand-100">
              Accuracy
            </div>
            <div className="mt-1 text-2xl font-black">
              <AnimatedNumber value={pct} suffix="%" duration={900} />
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold uppercase tracking-wider text-brand-100">
              Correct
            </div>
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
