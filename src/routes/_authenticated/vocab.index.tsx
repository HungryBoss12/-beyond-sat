import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, ArrowRight } from "lucide-react";
import { PageHead, Panel } from "@/components/ui/panel";
import { RevealLink } from "@/components/ui/reveal-card";
import { VocabStreakWidget } from "@/components/vocab/VocabStreakWidget";
import { VocabDueBanner } from "@/components/vocab/VocabDueBanner";
import { VocabDeckGlyph, VocabQuizGlyph } from "@/components/vocab/VocabHubGlyphs";
import { VocabMark } from "@/components/vocab/VocabMark";
import { fetchVocabDueSummary } from "@/lib/vocab/client";
import { startVocabReminderPoll } from "@/lib/vocab/reminders";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/vocab/")({
  component: VocabHub,
});

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
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <PageHead
        title="Vocabulary"
        subtitle="Anki-style spaced repetition and Words-in-Context practice for the Digital SAT."
        action={
          <div
            className="group grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-400/15 text-brand-100 shadow-brand ring-1 ring-brand-300/35 transition hover:bg-brand-400/25"
            aria-hidden
          >
            <VocabMark className="h-9 w-9" interactive />
          </div>
        }
      />

      <VocabStreakWidget />

      {dueError ? (
        <Panel className="border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Could not load review counts: {dueError}
        </Panel>
      ) : null}

      <VocabDueBanner dueCount={due} deckId={topDeckId} deckTitle={topDeckTitle} />

      <div className="grid gap-4 sm:grid-cols-2">
        <RevealLink to="/vocab/decks" className="block">
          <Panel className="group h-full p-5 transition hover:border-brand-400/40">
            <div className="flex items-start justify-between">
              <div className="vocab-hub-tile grid h-11 w-11 place-items-center rounded-xl bg-brand-400/20 text-brand-100 ring-1 ring-brand-300/25">
                <VocabDeckGlyph className="h-7 w-7" interactive />
              </div>
              {due > 0 ? (
                <span className="rounded-full bg-orange-500/20 px-2.5 py-0.5 text-xs font-bold text-orange-200">
                  {due} due
                </span>
              ) : null}
            </div>
            <h2 className="mt-4 text-lg font-bold text-white">SRS Deck</h2>
            <p className="mt-1 text-sm text-white/60">
              Review {cardCount || "SAT"} vocab cards with FSRS intervals. Keyboard: Space, 1–4.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand-300 group-hover:gap-2 transition-all">
              Start review <ArrowRight className="h-4 w-4" />
            </span>
          </Panel>
        </RevealLink>

        <RevealLink to="/vocab/tests" className="block">
          <Panel className="group h-full p-5 transition hover:border-brand-400/40">
            <div className="vocab-hub-tile grid h-11 w-11 place-items-center rounded-xl bg-brand-400/20 text-brand-100 ring-1 ring-brand-300/25">
              <VocabQuizGlyph className="h-7 w-7" interactive />
            </div>
            <h2 className="mt-4 text-lg font-bold text-white">Practice tests</h2>
            <p className="mt-1 text-sm text-white/60">
              {quizCount} Words-in-Context quiz{quizCount === 1 ? "" : "zes"}. Missed words auto-queue
              for review.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand-300 group-hover:gap-2 transition-all">
              Browse tests <ArrowRight className="h-4 w-4" />
            </span>
          </Panel>
        </RevealLink>
      </div>

      <Panel className="p-5">
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-white/50" />
          <div>
            <h3 className="font-bold text-white">How it works</h3>
            <p className="text-sm text-white/60">
              Study cards daily to build your streak. Take quizzes to test Words-in-Context skills —
              anything you miss goes straight into your SRS queue.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
