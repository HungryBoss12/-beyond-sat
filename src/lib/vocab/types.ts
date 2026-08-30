/** Vocabulary module types (Supabase-backed). */

export type DifficultyTier = "Foundational" | "Medium" | "Advanced";

export type VocabDeck = {
  id: string;
  title: string;
  description: string | null;
  parent_id: string | null;
  sort_order: number;
  is_folder: boolean;
  path: string | null;
  created_at: string;
};

export type VocabCard = {
  id: string;
  word: string;
  part_of_speech: string;
  definition: string;
  dsat_passage: string;
  roots_etymology: string | null;
  synonyms: string[];
  sat_traps: string | null;
  difficulty_tier: DifficultyTier;
  deck_id: string | null;
  example_sentence: string | null;
  antonym: string | null;
  set_label: string | null;
  created_at: string;
};

export type DeckStats = {
  new_count: number;
  learning_count: number;
  review_count: number;
  total_count: number;
};

export type UserCardState = {
  id: string;
  user_id: string;
  card_id: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
};

export type VocabQuiz = {
  id: string;
  title: string;
  description: string | null;
  time_limit_seconds: number | null;
  created_at: string;
};

export type VocabQuizQuestion = {
  id: string;
  quiz_id: string;
  vocab_card_id: string | null;
  passage_text: string;
  correct_answer: string;
  options: string[];
  explanation: string;
  position: number;
};

export type VocabQuizAttempt = {
  id: string;
  user_id: string;
  quiz_id: string;
  score: number;
  total: number;
  created_at: string;
};

export type VocabActivityLog = {
  id: string;
  user_id: string;
  activity_date: string;
  cards_reviewed: number;
  completed_at: string;
};

export type SessionCard = {
  stateId: string;
  card: VocabCard;
  fsrs: UserCardState;
  intervals: Record<1 | 2 | 3 | 4, string>;
};

export type GeneratedVocabItem = {
  word: string;
  partOfSpeech: string;
  definition: string;
  dSatPassage: string;
  rootsEtymology?: string;
  synonyms: string[];
  satTraps?: string;
  difficultyTier?: DifficultyTier;
  exampleSentence?: string;
  antonym?: string;
  setLabel?: string;
  ankiDeckPath?: string;
  quizQuestion: {
    passageText: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
  };
};

export type AnkiDeckNode = {
  path: string;
  title: string;
  parentPath: string | null;
  sortOrder: number;
  isFolder: boolean;
};

export type ReviewRating = 1 | 2 | 3 | 4;

export const RATING_LABELS: Record<ReviewRating, string> = {
  1: "Again",
  2: "Hard",
  3: "Good",
  4: "Easy",
};

export type SessionSummary = {
  deckId: string;
  deckTitle: string;
  reviewed: number;
  ratings: Record<ReviewRating, number>;
  startedAt: number;
};

export function emptySessionSummary(deckId: string, deckTitle: string): SessionSummary {
  return {
    deckId,
    deckTitle,
    reviewed: 0,
    ratings: { 1: 0, 2: 0, 3: 0, 4: 0 },
    startedAt: Date.now(),
  };
}
