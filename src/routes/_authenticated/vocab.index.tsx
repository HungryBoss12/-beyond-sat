import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, ArrowRight, X } from "lucide-react";
import { PageHead, Panel } from "@/components/ui/panel";
import { AmbientGlow, RevealLink } from "@/components/ui/reveal-card";
import { VocabStreakWidget } from "@/components/vocab/VocabStreakWidget";
import { VocabDueBanner } from "@/components/vocab/VocabDueBanner";
import { VocabDeckGlyph, VocabQuizGlyph } from "@/components/vocab/VocabHubGlyphs";
import { VocabMark } from "@/components/vocab/VocabMark";
import { fetchVocabDueSummary } from "@/lib/vocab/client";
import { startVocabReminderPoll } from "@/lib/vocab/reminders";
import { supabase } from "@/integrations/supabase/client";
import { VocabHomeworkPanel } from "@/components/vocab/VocabHomeworkPanel";
import { hasSeenTip, markTipSeen } from "@/lib/first-visit";

export const Route = createFileRoute("/_authenticated/vocab/")({
  component: VocabHub,
});

function VocabHubTip() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!hasSeenTip("vocab-hub"));
  }, []);

  if (!visible) return null;

  function dismiss() {
    markTipSeen("vocab-hub");
    setVisible(false);
  }

  return (
    <Panel className="p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-400 text-white">
          <BookOpen className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-white">Quick tip</h3>
            <button
              type="button"
              onClick={dismiss}
              className="tap cursor-pointer rounded-lg p-1 text-brand-100 hover:bg-brand-800 hover:text-white"
              aria-label="Dismiss tip"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-sm text-brand-100">
            Study cards daily to build your streak. Missed quiz words go straight into your SRS
            queue.
          </p>
        </div>
      </div>
    </Panel>
  );
}

function VocabHub() {
  const [due, setDue] = useState(0);
  const [topDeckId, setTopDeckId] = useState<string | undefined>();
  const [topDeckTitle, setTopDeckTitle] = useState<string | undefined>();
  const [dueError, setDueError] = useState<string | null>(null);
  const [cardCount, setCardCount] = useState(0);
  const [quizCount, setQuizCount] = useState(0);

  useEffect(() => {
    void (async () => {
      try {
        const [summary, cards, quizzes] = await Promise.all([
          fetchVocabDueSummary(),
          supabase.from("vocab_cards").select("id", { count: "exact", head: true }),
          supabase.from("vocab_quizzes").select("id", { count: "exact", head: true }),
        ]);
        setDue(summary.totalDue);
        setTopDeckId(summary.topDeck?.id);
        setTopDeckTitle(summary.topDeck?.title);
        setDueError(null);
        setCardCount(cards.count ?? 0);
        setQuizCount(quizzes.count ?? 0);
      } catch (e) {
        setDueError(e instanceof Error ? e.message : "Could not load due counts");
      }
    })();
    return startVocabReminderPoll(async () => {
      const summary = await fetchVocabDueSummary();
      setDue(summary.totalDue);
      setTopDeckId(summary.topDeck?.id);
      setTopDeckTitle(summary.topDeck?.title);
      setDueError(null);
      return summary.totalDue;
    }, "Vocab");
  }, []);

  return (
    <div className="relative isolate mx-auto max-w-3xl space-y-6 pb-10">
      <AmbientGlow />
      <PageHead
        title="Vocabulary"
        subtitle="Anki-style spaced repetition and Words-in-Context practice for the Digital SAT."
        action={
          <div
            className="group grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white shadow-brand ring-1 ring-brand-400/40 transition hover:bg-brand-500"
            aria-hidden
          >
            <VocabMark className="h-9 w-9" interactive />
          </div>
        }
      />

      <VocabStreakWidget />

      {dueError ? (
        <Panel className="border-brand-400/40 bg-brand-800/80 p-4 text-sm text-brand-100">
          Could not load review counts: {dueError}
        </Panel>
      ) : null}

      <VocabDueBanner dueCount={due} deckId={topDeckId} deckTitle={topDeckTitle} embedded />

      <VocabHomeworkPanel />

      <div className="grid gap-4 sm:grid-cols-2">
        <RevealLink to="/vocab/decks" className="block">
          <Panel className="group h-full p-5 transition hover:border-brand-400/40">
            <div className="flex items-start justify-between">
              <div className="vocab-hub-tile grid h-11 w-11 place-items-center rounded-xl bg-brand-400 text-white ring-1 ring-brand-300/25">
                <VocabDeckGlyph className="h-7 w-7" interactive />
              </div>
              {due > 0 ? <span className="vocab-due-badge">{due} due</span> : null}
            </div>
            <h2 className="mt-4 text-lg font-bold text-white">Decks</h2>
            <p className="mt-1 text-sm text-brand-100">
              Review {cardCount || "SAT"} vocab cards with FSRS intervals. Keyboard: Space, 1–4.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand-200 group-hover:gap-2 transition-all">
              Start review <ArrowRight className="h-4 w-4" />
            </span>
          </Panel>
        </RevealLink>

        <RevealLink to="/vocab/tests" className="block">
          <Panel className="group h-full p-5 transition hover:border-brand-400/40">
            <div className="vocab-hub-tile grid h-11 w-11 place-items-center rounded-xl bg-brand-400 text-white ring-1 ring-brand-300/25">
              <VocabQuizGlyph className="h-7 w-7" interactive />
            </div>
            <h2 className="mt-4 text-lg font-bold text-white">Practice tests</h2>
            <p className="mt-1 text-sm text-brand-100">
              {quizCount} Words-in-Context quiz{quizCount === 1 ? "" : "zes"}. Missed words
              auto-queue for review.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand-200 group-hover:gap-2 transition-all">
              Browse tests <ArrowRight className="h-4 w-4" />
            </span>
          </Panel>
        </RevealLink>
      </div>

      <VocabHubTip />
    </div>
  );
}
