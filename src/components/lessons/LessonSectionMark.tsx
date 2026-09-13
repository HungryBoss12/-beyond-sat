import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

export type LessonSectionKind = "rw" | "math";
export type LessonMarkKind = LessonSectionKind | "lessons";

export function sectionKind(slug: string): LessonSectionKind {
  return slug === "math" ? "math" : "rw";
}

const FLIP_MS = 2320;
const CLOSE_MS = 560;

export function LessonSectionMark({
  kind,
  className,
  size = "lg",
  active = false,
}: {
  kind: LessonMarkKind;
  className?: string;
  size?: "sm" | "lg";
  active?: boolean;
}) {
  const box = size === "lg" ? "h-14 w-14" : "h-11 w-11";
  return (
    <span
      className={`lesson-mark-orb grid shrink-0 place-items-center rounded-full border border-brand-400/40 bg-brand-600 p-3 ${box} ${className ?? ""}`}
      aria-hidden
    >
      {kind === "rw" ? (
        <BookMark active={active} />
      ) : kind === "math" ? (
        <SigmaMark active={active} />
      ) : (
        <Sparkles className={size === "lg" ? "h-6 w-6 text-brand-100" : "h-5 w-5 text-brand-100"} />
      )}
    </span>
  );
}

function BookMark({ active }: { active: boolean }) {
  const [phase, setPhase] = useState<"closed" | "flipping" | "finishing">("closed");

  useEffect(() => {
    if (!active) {
      setPhase("closed");
      return;
    }
    setPhase("flipping");
    const closeId = window.setTimeout(() => setPhase("finishing"), FLIP_MS);
    const doneId = window.setTimeout(() => setPhase("closed"), FLIP_MS + CLOSE_MS);
    return () => {
      window.clearTimeout(closeId);
      window.clearTimeout(doneId);
    };
  }, [active]);

  return (
    <svg
      viewBox="0 0 24 24"
      className={`book-mark book-mark-${phase}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g className="book-closed">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      </g>
      <g className="book-open">
        <path
          className="book-page-left"
          d="M12 7a4 4 0 0 0-4-4H3a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h6a3 3 0 0 1 3 3"
        />
        <path d="M12 7a4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3" />
        <path
          className="book-flip-leaf"
          d="M12 7a4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3"
        />
        <path d="M12 7v14" />
      </g>
    </svg>
  );
}

function SigmaMark({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`sigma-mark ${active ? "is-drawn" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path className="sigma-ghost" d="M4.5 5h15L12 12l7.5 7H4.5" />
      <path className="sigma-stroke sigma-s1" d="M4.5 5h15" />
      <path className="sigma-stroke sigma-s2" d="M19.5 5 12 12" />
      <path className="sigma-stroke sigma-s3" d="M12 12 19.5 19" />
      <path className="sigma-stroke sigma-s4" d="M19.5 19H4.5" />
    </svg>
  );
}

export function LessonPageHead({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  kind?: LessonMarkKind;
}) {
  return (
    <div className="lesson-copy-enter min-w-0">
      <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
    </div>
  );
}
