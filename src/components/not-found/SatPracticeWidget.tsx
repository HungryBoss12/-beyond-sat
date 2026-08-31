import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { useState } from "react";
import { RevealCard } from "@/components/ui/reveal-card";
import { ConfettiBurst } from "./ConfettiBurst";

const OPTIONS = [
  { id: "A", label: "Panic and lose 50 points", correct: false },
  { id: "B", label: "Blame the AI coach", correct: false },
  { id: "C", label: "Head back home and keep practicing", correct: true },
  { id: "D", label: "Double check the URL", correct: true },
] as const;

export function SatPracticeWidget() {
  const [selected, setSelected] = useState<string | null>(null);
  const [wrongId, setWrongId] = useState<string | null>(null);
  const [answeredCorrectly, setAnsweredCorrectly] = useState(false);

  function handleSelect(id: string) {
    if (answeredCorrectly) return;
    const option = OPTIONS.find((o) => o.id === id);
    if (!option) return;

    setSelected(id);
    if (option.correct) {
      setWrongId(null);
      setAnsweredCorrectly(true);
    } else {
      setWrongId(id);
      window.setTimeout(() => setWrongId(null), 500);
    }
  }

  return (
    <RevealCard className="relative overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 p-6 shadow-panel md:p-7">
      <ConfettiBurst active={answeredCorrectly} />

      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-400 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="text-sm font-bold text-white">SAT Practice Question</span>
      </div>

      <p id="not-found-quiz-question" className="text-sm font-semibold leading-relaxed text-white">
        If Page X equals 404, what is the best next step?
      </p>

      <div role="group" aria-labelledby="not-found-quiz-question" className="mt-4 space-y-2.5">
        {OPTIONS.map((opt) => {
          const isSelected = selected === opt.id;
          const isWrong = wrongId === opt.id;
          const isCorrectChoice = answeredCorrectly && isSelected && opt.correct;

          return (
            <button
              key={opt.id}
              type="button"
              disabled={answeredCorrectly}
              onClick={() => handleSelect(opt.id)}
              className={[
                "not-found-quiz-btn tap flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b7cff] focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600",
                isCorrectChoice
                  ? "border-brand-300/60 bg-brand-800 ring-2 ring-brand-300/40"
                  : isWrong
                    ? "not-found-shake border-brand-300/50 bg-brand-800"
                    : isSelected && !opt.correct
                      ? "border-brand-300/50 bg-brand-800"
                      : "border-brand-400/40 bg-brand-700/60",
                answeredCorrectly && !isSelected ? "opacity-60" : "",
              ].join(" ")}
            >
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-brand-400 text-xs font-black text-white">
                {opt.id}
              </span>
              <span className="font-medium text-brand-100">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {wrongId && !answeredCorrectly && (
        <p className="mt-3 text-xs font-semibold text-brand-200" role="status">
          Not quite — try another answer.
        </p>
      )}

      {answeredCorrectly && (
        <div className="mt-5 space-y-4" role="status">
          <div className="flex items-center gap-2 text-sm font-bold text-brand-100">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            Correct! Smart move — let&apos;s get you back on track.
          </div>
          <Link
            to="/"
            className="not-found-home-btn btn-brand group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-400 px-5 py-3 text-sm font-bold text-white sm:w-auto"
          >
            Back to Home <ArrowRight className="arrow-slide h-4 w-4" />
          </Link>
        </div>
      )}
    </RevealCard>
  );
}
