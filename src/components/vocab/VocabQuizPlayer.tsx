import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
} from "lucide-react";
import { submitVocabQuiz } from "@/lib/vocab/client";
import type { VocabQuiz, VocabQuizQuestion } from "@/lib/vocab/types";
import { cn } from "@/lib/utils";
import { sheetPeelVariants, vocabSheetStyle, vocabStageStyle } from "./vocab-motion";

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

type Props = {
  quiz: VocabQuiz;
  questions: VocabQuizQuestion[];
};

type ResultView = {
  score: number;
  total: number;
  percent: number;
  missedQueued: number;
  results: {
    questionId: string;
    correct: boolean;
    correctAnswer: string;
    explanation: string;
  }[];
};

export function VocabQuizPlayer({ quiz, questions }: Props) {
  const reduceMotion = useReducedMotion() ?? false;
  const peelVariants = sheetPeelVariants(reduceMotion);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [showNav, setShowNav] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ResultView | null>(null);
  const [timeLeft, setTimeLeft] = useState(quiz.time_limit_seconds ?? 0);
  const answersRef = useRef(answers);
  const submittingRef = useRef(submitting);
  const resultRef = useRef(result);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);
  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current || resultRef.current) return;
    setSubmitting(true);
    try {
      const payload = questions.map((qu) => ({
        questionId: qu.id,
        selected: answersRef.current[qu.id] ?? "",
      }));
      const res = await submitVocabQuiz(quiz.id, payload);
      setResult(res);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }, [questions, quiz.id]);

  useEffect(() => {
    if (!quiz.time_limit_seconds || result) return;
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          void handleSubmit();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [quiz.time_limit_seconds, result, handleSubmit]);

  const q = questions[idx];
  const selected = q ? answers[q.id] : undefined;

  const answeredCount = useMemo(
    () => questions.filter((qu) => answers[qu.id]).length,
    [questions, answers],
  );

  if (result) {
    return (
      <div className="vocab-surface flex min-h-[100dvh] flex-col bg-[#0b0761]">
        <header className="border-b border-white/10 px-4 py-4 text-center">
          <h1 className="text-xl font-bold text-white">Results</h1>
          <p className="mt-2 text-4xl font-black text-brand-200">{result.percent}%</p>
          <p className="text-white/60">
            {result.score} / {result.total} correct
          </p>
          {result.missedQueued > 0 ? (
            <p className="mt-2 text-sm text-brand-100">
              {result.missedQueued} missed word{result.missedQueued === 1 ? "" : "s"} added to your
              review deck
            </p>
          ) : null}
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {questions.map((qu, i) => {
            const r = result.results.find((x) => x.questionId === qu.id);
            return (
              <div
                key={qu.id}
                className={cn(
                  "rounded-xl border p-4",
                  r?.correct ? "border-brand-300/40 bg-brand-400/15" : "border-brand-400/30 bg-brand-800/60",
                )}
              >
                <div className="text-sm font-bold text-white/60">Question {i + 1}</div>
                <p className="mt-2 text-white/90">{qu.passage_text.replace("______", "_____")}</p>
                <p className="mt-2 text-sm">
                  Your answer: <strong>{answers[qu.id] || "—"}</strong>
                  {!r?.correct ? (
                    <>
                      {" "}
                      · Correct: <strong>{r?.correctAnswer}</strong>
                    </>
                  ) : null}
                </p>
                <p className="mt-2 text-sm text-white/70">{r?.explanation}</p>
              </div>
            );
          })}
        </div>
        <footer className="border-t border-white/10 p-4 flex gap-3">
          <Link
            to="/vocab/tests"
            className="flex-1 rounded-xl border border-white/20 py-3 text-center font-bold text-white"
          >
            All tests
          </Link>
          <Link
            to="/vocab/decks"
            className="flex-1 btn-brand rounded-xl py-3 text-center font-bold"
          >
            Review deck
          </Link>
        </footer>
      </div>
    );
  }

  if (!q) {
    return (
      <div className="vocab-surface flex min-h-[100dvh] items-center justify-center bg-[#0b0761]">
        No questions in this quiz.
      </div>
    );
  }

  return (
    <div className="vocab-surface flex min-h-[100dvh] flex-col bg-[#0b0761]">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <Link to="/vocab/tests" className="tap flex items-center gap-1 text-sm text-white/70">
          <ArrowLeft className="h-4 w-4" />
          Exit
        </Link>
        <div className="text-sm font-medium">{quiz.title}</div>
        {quiz.time_limit_seconds ? (
          <div className="flex items-center gap-1 text-sm tabular-nums">
            <Clock className="h-4 w-4" />
            {fmt(timeLeft)}
          </div>
        ) : (
          <div className="w-12" />
        )}
      </header>

      <main className="flex flex-1 flex-col lg:flex-row">
        <div className="flex-1 overflow-hidden p-6">
          <div className="relative min-h-[12rem] overflow-hidden" style={vocabStageStyle}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={q.id}
                style={vocabSheetStyle}
                variants={peelVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <div className="text-sm text-white/50">
                  Question {idx + 1} of {questions.length}
                </div>
                <p className="mt-4 text-lg leading-relaxed">{renderPassage(q.passage_text)}</p>
                <div className="mt-8 space-y-3">
                  {q.options.map((opt) => (
                    <motion.button
                      key={opt}
                      type="button"
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                      whileTap={reduceMotion ? undefined : { scale: 0.99 }}
                      className={cn(
                        "tap w-full rounded-xl border px-4 py-3 text-left transition-colors duration-200",
                        selected === opt
                          ? "border-brand-400 bg-brand-400/20 font-bold"
                          : "border-white/15 bg-white/5 hover:border-white/30",
                      )}
                    >
                      {opt}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {showNav ? (
          <aside className="border-t border-white/10 p-4 lg:w-64 lg:border-l lg:border-t-0">
            <div className="grid grid-cols-5 gap-2">
              {questions.map((qu, i) => (
                <button
                  key={qu.id}
                  type="button"
                  onClick={() => setIdx(i)}
                  className={cn(
                    "relative h-10 rounded-lg text-sm font-bold",
                    i === idx ? "bg-brand-400 text-[#0b0761]" : "bg-white/10",
                    answers[qu.id] ? "ring-1 ring-brand-300/50" : "",
                  )}
                >
                  {i + 1}
                  {flagged.has(qu.id) ? (
                    <Bookmark className="absolute -right-0.5 -top-0.5 h-3 w-3 fill-brand-200 text-brand-200" />
                  ) : null}
                </button>
              ))}
            </div>
          </aside>
        ) : null}
      </main>

      <footer className="flex items-center justify-between border-t border-white/10 px-4 py-3">
        <button
          type="button"
          disabled={idx === 0}
          onClick={() => setIdx((i) => i - 1)}
          className="tap flex items-center gap-1 rounded-lg px-3 py-2 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              setFlagged((f) => {
                const n = new Set(f);
                if (n.has(q.id)) n.delete(q.id);
                else n.add(q.id);
                return n;
              })
            }
            className={cn("tap rounded-lg p-2", flagged.has(q.id) ? "text-brand-200" : "text-white/50")}
          >
            <Bookmark className={cn("h-5 w-5", flagged.has(q.id) && "fill-current")} />
          </button>
          <button
            type="button"
            onClick={() => setShowNav((s) => !s)}
            className="tap rounded-lg px-3 py-2 text-sm text-white/70"
          >
            {answeredCount}/{questions.length} · Navigator
          </button>
        </div>

        {idx + 1 >= questions.length ? (
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmit()}
            className="btn-brand tap rounded-lg px-4 py-2 font-bold"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIdx((i) => i + 1)}
            className="tap flex items-center gap-1 rounded-lg px-3 py-2"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </footer>
    </div>
  );
}

function renderPassage(text: string): ReactNode {
  const parts = text.split("______");
  if (parts.length === 1) return text;
  return (
    <>
      {parts[0]}
      <span className="mx-1 inline-block min-w-[4rem] border-b-2 border-brand-300 font-bold text-brand-200">
        ______
      </span>
      {parts.slice(1).join("______")}
    </>
  );
}
