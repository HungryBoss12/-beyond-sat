import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Trophy } from "lucide-react";
import { AmbientGlow, RevealLink } from "@/components/ui/reveal-card";
import { usePointerGlow } from "@/hooks/usePointerGlow";
import { RATING_LABELS, type ReviewRating, type SessionSummary } from "@/lib/vocab/types";

type Props = {
  summary: SessionSummary;
  streak?: number;
  onStudyMore: () => void;
};

function GlowButton({
  children,
  className,
  onClick,
  to,
}: {
  children: React.ReactNode;
  className: string;
  onClick?: () => void;
  to?: string;
}) {
  const ref = usePointerGlow<HTMLButtonElement>();
  if (to) {
    return (
      <RevealLink to={to} className={`vocab-reveal-surface tap ${className}`}>
        {children}
      </RevealLink>
    );
  }
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={`vocab-reveal-surface tap ${className}`}
    >
      {children}
    </button>
  );
}

export function VocabSessionResults({ summary, streak, onStudyMore }: Props) {
  const minutes = Math.max(1, Math.round((Date.now() - summary.startedAt) / 60000));

  return (
    <div className="vocab-surface relative isolate flex min-h-[100dvh] flex-col bg-[#0b0761]">
      <AmbientGlow />
      <header className="border-b border-white/10 px-4 py-4 text-center">
        <Trophy className="mx-auto h-8 w-8 text-brand-200" />
        <h1 className="mt-2 text-xl font-bold">Session complete</h1>
        <p className="mt-1 text-sm text-white/60">{summary.deckTitle}</p>
      </header>

      <motion.main
        className="flex flex-1 flex-col items-center justify-center gap-6 p-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="text-center">
          <div className="text-5xl font-black tabular-nums">{summary.reviewed}</div>
          <div className="text-sm text-white/60">cards reviewed · ~{minutes} min</div>
          {streak != null ? (
            <div className="mt-2 text-sm text-white/70">
              Streak: <span className="font-bold text-white">{streak}</span> days
            </div>
          ) : null}
        </div>

        <div className="grid w-full max-w-sm grid-cols-2 gap-2">
          {([1, 2, 3, 4] as ReviewRating[]).map((r) => (
            <div
              key={r}
              className="vocab-reveal-surface rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-center ring-1 ring-white/10"
            >
              <div className="text-xs text-white/60">{RATING_LABELS[r]}</div>
              <div className="text-lg font-bold tabular-nums">{summary.ratings[r]}</div>
            </div>
          ))}
        </div>
      </motion.main>

      <footer className="mx-auto grid w-full max-w-sm gap-2 border-t border-white/10 p-4">
        <GlowButton onClick={onStudyMore} className="vocab-outline-btn-primary w-full">
          Study more
        </GlowButton>
        <GlowButton to="/vocab/decks" className="vocab-outline-btn-secondary w-full text-center">
          Back to decks
        </GlowButton>
        <GlowButton
          to="/vocab/tests"
          className="vocab-outline-btn-secondary w-full text-center text-white/80"
        >
          Take a practice test
        </GlowButton>
      </footer>
    </div>
  );
}
