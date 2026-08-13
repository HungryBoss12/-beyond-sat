export type ImportWizardStep = "setup" | "source" | "extract" | "answers" | "review";

const STEPS = [
  { id: "setup", label: "Setup", blurb: "Name & defaults" },
  { id: "source", label: "Source", blurb: "Paper, sheet, or JSON" },
  { id: "extract", label: "Extract", blurb: "Read questions" },
  { id: "answers", label: "Answers", blurb: "Key & AI fix" },
  { id: "review", label: "Review", blurb: "Check against page" },
] as const;

export function WizardSteps({
  step,
  onStepClick,
  unlocked,
}: {
  step: ImportWizardStep;
  onStepClick?: (s: ImportWizardStep) => void;
  unlocked: Set<ImportWizardStep> | ImportWizardStep[];
}) {
  const unlockedSet = unlocked instanceof Set ? unlocked : new Set(unlocked);
  const activeIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <nav
      aria-label="Import steps"
      className="rise-in overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 shadow-panel"
    >
      <ol className="flex flex-col sm:flex-row">
        {STEPS.map((s, i) => {
          const isActive = s.id === step;
          const isDone = i < activeIndex;
          const isReachable = unlockedSet.has(s.id);
          const clickable = Boolean(onStepClick) && isReachable && !isActive;

          return (
            <li
              key={s.id}
              className={
                "relative flex flex-1 items-stretch border-brand-400/30 " +
                (i > 0 ? "border-t sm:border-l sm:border-t-0" : "")
              }
            >
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick?.(s.id)}
                aria-current={isActive ? "step" : undefined}
                className={
                  "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors " +
                  (isActive
                    ? "bg-brand-500 text-white"
                    : isReachable
                      ? "text-brand-100 hover:bg-brand-800 hover:text-white"
                      : "cursor-default text-brand-200/60") +
                  (clickable ? " tap cursor-pointer" : "")
                }
              >
                <span
                  className={
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums " +
                    (isActive
                      ? "bg-brand-200 text-brand-900"
                      : isDone
                        ? "bg-brand-400 text-white"
                        : "bg-brand-800 text-brand-100 ring-1 ring-brand-400/40")
                  }
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{s.label}</span>
                  <span
                    className={
                      "mt-0.5 block text-[11px] leading-snug " +
                      (isActive ? "text-brand-100" : "text-brand-200")
                    }
                  >
                    {s.blurb}
                  </span>
                </span>
              </button>
              {isActive && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand-200 sm:inset-y-0 sm:bottom-auto sm:left-auto sm:right-0 sm:h-auto sm:w-0.5" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
