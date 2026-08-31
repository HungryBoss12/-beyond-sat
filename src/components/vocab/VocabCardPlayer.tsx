import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Loader2, RotateCcw } from "lucide-react";
import { fetchVocabSession, submitVocabReview } from "@/lib/vocab/client";
import { recordDeckHomeworkProgress } from "@/lib/vocab/homework";
import { supabase } from "@/integrations/supabase/client";
import { AmbientGlow } from "@/components/ui/reveal-card";
import { AnkiDeckCounts } from "@/components/vocab/AnkiDeckCounts";
import {
  emptySessionSummary,
  RATING_LABELS,
  type ReviewRating,
  type SessionCard,
  type SessionSummary,
} from "@/lib/vocab/types";
import { cn } from "@/lib/utils";
import { VocabSessionResults } from "./VocabSessionResults";
import {
  fadeInVariants,
  flipRevealVariants,
  footerSlideVariants,
  sheetPeelVariants,
  vocabSheetStyle,
  vocabStageStyle,
} from "./vocab-motion";

type Props = {
  deckId: string;
  deckTitle: string;
  onDone?: () => void;
};

function highlightWord(passage: string, word: string): ReactNode {
  const re = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i");
  const parts = passage.split(re);
  return parts.map((part, i) =>
    re.test(part) ? (
      <mark key={i} className="rounded bg-brand-400/30 px-0.5 font-bold text-brand-100">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function CardFront({ card }: { card: SessionCard["card"] }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm uppercase tracking-wide text-white/70">{card.part_of_speech}</div>
        {card.set_label ? (
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/80 ring-1 ring-white/20">
            {card.set_label}
          </span>
        ) : null}
      </div>
      <h1 className="mt-2 text-4xl font-black text-white">{card.word}</h1>
      <p className="mt-6 text-lg leading-relaxed text-white/85">
        {highlightWord(card.dsat_passage, card.word)}
      </p>
      <p className="mt-8 text-center text-sm text-white/40">Tap or press Space to reveal</p>
    </>
  );
}

function CardBack({ card }: { card: SessionCard["card"] }) {
  const example = card.example_sentence || card.dsat_passage;
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-bold text-white">{card.word}</h2>
        {card.set_label ? (
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/80 ring-1 ring-white/20">
            {card.set_label}
          </span>
        ) : null}
      </div>
      <div className="mt-4 space-y-3 text-sm">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-brand-200">Definition</div>
          <p className="mt-1 text-base text-white/90">{card.definition}</p>
        </div>
        {example ? (
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-brand-200">Example</div>
            <p className="mt-1 italic text-white/80">{example}</p>
          </div>
        ) : null}
        {card.antonym ? (
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-brand-200">Antonym</div>
            <p className="mt-1 text-white/80">{card.antonym}</p>
          </div>
        ) : null}
      </div>
      {card.roots_etymology ? (
        <p className="mt-4 text-sm text-white/60">
          <span className="font-semibold text-white/80">Roots: </span>
          {card.roots_etymology}
        </p>
      ) : null}
      {card.synonyms?.length ? (
        <p className="mt-2 text-sm text-white/60">
          <span className="font-semibold text-white/80">Synonyms: </span>
          {card.synonyms.join(", ")}
        </p>
      ) : null}
      {card.sat_traps ? (
        <div className="mt-4 rounded-lg border border-brand-400/40 bg-brand-800/70 p-3 text-sm text-brand-100">
          <span className="font-bold">SAT trap: </span>
          {card.sat_traps}
        </div>
      ) : null}
    </>
  );
}

export function VocabCardPlayer({ deckId, deckTitle, onDone }: Props) {
  const reduceMotion = useReducedMotion() ?? false;
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<SessionCard[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [streak, setStreak] = useState<number | undefined>();
  const [deckStats, setDeckStats] = useState({ new: 0, learning: 0, review: 0 });
  const [pressedRating, setPressedRating] = useState<ReviewRating | null>(null);

  const sessionRef = useRef<SessionSummary>(emptySessionSummary(deckId, deckTitle));
  const peelLockRef = useRef(false);
  const inFlightRef = useRef(new Set<string>());

  const peelVariants = sheetPeelVariants(reduceMotion);
  const flipVariants = flipRevealVariants(reduceMotion);
  const screenVariants = fadeInVariants(reduceMotion);
  const footerVariants = footerSlideVariants(reduceMotion);

  const resetSession = useCallback(() => {
    sessionRef.current = emptySessionSummary(deckId, deckTitle);
    setSummary(null);
  }, [deckId, deckTitle]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    resetSession();
    try {
      const [{ cards }, statsRes] = await Promise.all([
        fetchVocabSession(deckId),
        supabase.rpc("vocab_deck_stats", { p_deck_id: deckId }),
      ]);
      setQueue(cards);
      setIdx(0);
      setFlipped(false);
      const stats = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data;
      setDeckStats({
        new: stats?.new_count ?? 0,
        learning: stats?.learning_count ?? 0,
        review: stats?.review_count ?? 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load deck");
    } finally {
      setLoading(false);
    }
  }, [deckId, resetSession]);

  useEffect(() => {
    void load();
  }, [load]);

  const finishSession = useCallback(async () => {
    setSummary({ ...sessionRef.current, reviewed: sessionRef.current.reviewed });
    onDone?.();
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) return;
      const { data: sp } = await supabase
        .from("student_profiles")
        .select("current_streak")
        .eq("user_id", uid)
        .maybeSingle();
      setStreak(sp?.current_streak ?? 0);
    } catch {
      /* optional */
    }
  }, [onDone]);

  const current = summary ? null : queue[idx];

  const rate = useCallback(
    (rating: ReviewRating) => {
      const cardSnapshot = queue[idx];
      if (!cardSnapshot || peelLockRef.current) return;
      const cardId = cardSnapshot.card.id;
      const ratedIdx = idx;

      peelLockRef.current = true;
      setPressedRating(rating);
      window.setTimeout(
        () => {
          peelLockRef.current = false;
          setPressedRating(null);
        },
        reduceMotion ? 50 : 320,
      );

      sessionRef.current.reviewed += 1;
      sessionRef.current.ratings[rating] += 1;

      const isLast = idx + 1 >= queue.length;

      sessionRef.current.reviewed += 1;
      sessionRef.current.ratings[rating] += 1;

      if (!isLast) {
        setIdx((i) => i + 1);
        setFlipped(false);
      }

      inFlightRef.current.add(cardId);
      void submitVocabReview(cardId, rating)
        .then(() => {
          void recordDeckHomeworkProgress(deckId, rating);
          if (isLast) void finishSession();
        })
        .catch((e) => {
          const msg = e instanceof Error ? e.message : "Review failed";
          setError(msg);
          sessionRef.current.reviewed -= 1;
          sessionRef.current.ratings[rating] -= 1;
          if (!isLast) {
            setIdx(ratedIdx);
          }
          setFlipped(true);
        })
        .finally(() => {
          inFlightRef.current.delete(cardId);
        });
    },
    [idx, queue, finishSession, reduceMotion, deckId],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!current || peelLockRef.current) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (!flipped) setFlipped(true);
        else rate(3);
        return;
      }
      const map: Record<string, ReviewRating> = { "1": 1, "2": 2, "3": 3, "4": 4 };
      const r = map[e.key];
      if (r && flipped) {
        e.preventDefault();
        rate(r);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, flipped, rate]);

  if (summary) {
    return (
      <>
        {error ? (
          <div className="fixed inset-x-0 top-0 z-50 bg-brand-800 px-4 py-2 text-center text-sm text-white ring-1 ring-brand-400/40">
            {error}
          </div>
        ) : null}
        <VocabSessionResults summary={summary} streak={streak} onStudyMore={() => void load()} />
      </>
    );
  }

  if (loading) {
    return (
      <div className="vocab-surface flex min-h-[100dvh] flex-col bg-[#0b0761]">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <Link
            to="/vocab/decks"
            className="tap flex items-center gap-2 text-sm text-white/70 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Decks
          </Link>
          <span className="text-sm text-white/40">Loading…</span>
          <span className="w-4" />
        </header>
        <motion.div
          className="flex flex-1 items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.3 }}
        >
          <Loader2 className="h-8 w-8 animate-spin text-brand-300" />
        </motion.div>
      </div>
    );
  }

  if (error && !current) {
    return (
      <div className="vocab-surface flex min-h-[100dvh] flex-col bg-[#0b0761]">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <Link
            to="/vocab/decks"
            className="tap flex items-center gap-2 text-sm text-white/70 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Decks
          </Link>
          <span className="w-4" />
        </header>
        <motion.div
          className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
          variants={screenVariants}
          initial="initial"
          animate="animate"
        >
          <p className="text-brand-100">{error}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => void load()}
              className="btn-brand tap rounded-xl px-4 py-2"
            >
              Retry
            </button>
            <Link
              to="/vocab/decks"
              className="tap rounded-xl border border-white/20 px-4 py-2 text-sm font-bold text-white"
            >
              Back to decks
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!current) {
    return (
      <motion.div
        className="vocab-surface flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#0b0761] p-6 text-center"
        variants={screenVariants}
        initial="initial"
        animate="animate"
      >
        <p className="text-lg">No cards due right now. Great work!</p>
        <Link to="/vocab/decks" className="btn-brand tap rounded-xl px-4 py-2 text-sm font-bold">
          Back to decks
        </Link>
      </motion.div>
    );
  }

  const { card, intervals, stateId } = current;
  const cardKey = `${stateId}-${idx}`;

  return (
    <div className="vocab-surface relative isolate flex min-h-[100dvh] flex-col bg-[#0b0761]">
      <AmbientGlow />
      {error ? (
        <div className="bg-brand-800 px-4 py-2 text-center text-sm text-white ring-1 ring-brand-400/40">
          {error}
        </div>
      ) : null}
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <Link
          to="/vocab/decks"
          className="tap flex items-center gap-2 text-sm text-white/70 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {deckTitle}
        </Link>
        <AnkiDeckCounts
          newCount={deckStats.new}
          learningCount={deckStats.learning}
          reviewCount={deckStats.review}
        />
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={cardKey}
            className="text-sm tabular-nums text-white/60"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.22 }}
          >
            {idx + 1} / {queue.length}
          </motion.span>
        </AnimatePresence>
        <button
          type="button"
          onClick={() => void load()}
          title="Reload deck"
          aria-label="Reload deck"
          className="tap text-white/60 hover:text-white"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden p-6">
        <div className="relative w-full max-w-xl overflow-hidden" style={vocabStageStyle}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={cardKey}
              className="w-full cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur"
              style={vocabSheetStyle}
              variants={peelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              onClick={() => !flipped && setFlipped(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && !flipped && setFlipped(true)}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={flipped ? "back" : "front"}
                  variants={flipVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  {flipped ? <CardBack card={card} /> : <CardFront card={card} />}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence initial={false}>
        {flipped ? (
          <motion.footer
            key="rating-footer"
            className="grid grid-cols-4 gap-2 border-t border-white/10 p-4"
            variants={footerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {([1, 2, 3, 4] as ReviewRating[]).map((r) => (
              <motion.button
                key={r}
                type="button"
                onClick={() => rate(r)}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                className={cn(
                  "vocab-reveal-surface tap flex flex-col items-center rounded-xl py-3 text-sm font-bold text-white ring-1 ring-white/25 transition-colors duration-200",
                  pressedRating === r && "opacity-80",
                  r === 1 && "bg-brand-900/50 hover:bg-brand-900/70",
                  r === 2 && "bg-brand-800/55 hover:bg-brand-800/75",
                  r === 3 && "bg-brand-600/45 hover:bg-brand-600/60",
                  r === 4 && "bg-brand-400/30 hover:bg-brand-400/45",
                )}
              >
                <span>{RATING_LABELS[r]}</span>
                <span className="text-xs font-normal text-white/70">{intervals[r]}</span>
              </motion.button>
            ))}
          </motion.footer>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
