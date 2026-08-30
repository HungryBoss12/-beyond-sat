import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { GeneratedVocabItem, ReviewRating, SessionCard, VocabDeck } from "./types";

function friendlyVocabError(raw: string | undefined, status: number): string {
  if (!raw) return status === 404 ? "Vocab is not set up yet." : "Request failed";
  if (raw.includes("user_card_states") || raw.includes("PGRST205")) {
    return "Vocabulary tables are not installed yet. Ask an admin to run the database migration.";
  }
  try {
    const parsed = JSON.parse(raw) as { message?: string; code?: string };
    if (parsed.code === "PGRST205") {
      return "Vocabulary tables are not installed yet. Ask an admin to run the database migration.";
    }
    return parsed.message ?? raw;
  } catch {
    return raw;
  }
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in required");
  return {
    Authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}

export async function fetchVocabSession(
  deckId?: string,
): Promise<{ cards: SessionCard[]; total: number }> {
  const headers = await authHeaders();
  const url = deckId
    ? `/api/vocab/session?deckId=${encodeURIComponent(deckId)}`
    : "/api/vocab/session";
  const res = await fetch(url, { headers });
  const body = (await res.json()) as { cards?: SessionCard[]; total?: number; error?: string };
  if (!res.ok) throw new Error(friendlyVocabError(body.error, res.status));
  return { cards: body.cards ?? [], total: body.total ?? 0 };
}

export async function submitVocabReview(
  cardId: string,
  rating: ReviewRating,
): Promise<{ state: unknown; intervals: SessionCard["intervals"] }> {
  const headers = await authHeaders();
  const res = await fetch("/api/vocab/review", {
    method: "POST",
    headers,
    body: JSON.stringify({ cardId, rating }),
  });
  const body = (await res.json()) as {
    state?: unknown;
    intervals?: SessionCard["intervals"];
    error?: string;
  };
  if (!res.ok) throw new Error(body.error ?? "Review failed");
  return { state: body.state, intervals: body.intervals! };
}

export async function submitVocabQuiz(
  quizId: string,
  answers: { questionId: string; selected: string }[],
): Promise<{
  score: number;
  total: number;
  percent: number;
  results: { questionId: string; correct: boolean; correctAnswer: string; explanation: string }[];
  missedQueued: number;
}> {
  const headers = await authHeaders();
  const res = await fetch("/api/vocab/quiz/submit", {
    method: "POST",
    headers,
    body: JSON.stringify({ quizId, answers }),
  });
  const body = (await res.json()) as {
    score?: number;
    total?: number;
    percent?: number;
    results?: { questionId: string; correct: boolean; correctAnswer: string; explanation: string }[];
    missedQueued?: number;
    error?: string;
  };
  if (!res.ok) throw new Error(body.error ?? "Submit failed");
  return {
    score: body.score ?? 0,
    total: body.total ?? 0,
    percent: body.percent ?? 0,
    results: body.results ?? [],
    missedQueued: body.missedQueued ?? 0,
  };
}

export async function generateVocabContent(input: {
  words?: string;
  topic?: string;
  count?: number;
}): Promise<GeneratedVocabItem[]> {
  const headers = await authHeaders();
  const res = await fetch("/api/vocab/generate", {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  const body = (await res.json()) as { items?: GeneratedVocabItem[]; error?: string };
  if (!res.ok) throw new Error(body.error ?? "Generation failed");
  return body.items ?? [];
}

/** Generate SAT enrichment for one or more words (Fix with AI). */
export async function fixVocabWords(words: string[]): Promise<GeneratedVocabItem[]> {
  if (!words.length) return [];
  return generateVocabContent({ words: words.join(", ") });
}

export async function saveVocabContent(input: {
  items: GeneratedVocabItem[];
  deckTree?: import("./types").AnkiDeckNode[];
  quizTitle?: string;
  quizId?: string;
  deckName?: string;
  cardsOnly?: boolean;
}): Promise<{ quizId: string; count: number }> {
  const headers = await authHeaders();
  const res = await fetch("/api/vocab/admin/save", {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  const body = (await res.json()) as { quizId?: string; count?: number; error?: string };
  if (!res.ok) throw new Error(body.error ?? "Save failed");
  return { quizId: body.quizId ?? "", count: body.count ?? 0 };
}

export async function patchVocabDeck(deckId: string, title: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`/api/vocab/admin/decks/${encodeURIComponent(deckId)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ title }),
  });
  const body = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Update failed");
}

export async function deleteVocabDeck(deckId: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`/api/vocab/admin/decks/${encodeURIComponent(deckId)}`, {
    method: "DELETE",
    headers,
  });
  const body = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Delete failed");
}

export type AdminVocabCard = {
  id: string;
  word: string;
  part_of_speech: string;
  definition: string;
  dsat_passage: string;
  roots_etymology: string | null;
  synonyms: string[];
  sat_traps: string | null;
  difficulty_tier: string;
  example_sentence: string | null;
  antonym: string | null;
  set_label: string | null;
  deck_id: string | null;
};

export async function fetchAdminDeckCards(deckId: string): Promise<AdminVocabCard[]> {
  const { data, error } = await supabase
    .from("vocab_cards")
    .select(
      "id, word, part_of_speech, definition, dsat_passage, roots_etymology, synonyms, sat_traps, difficulty_tier, example_sentence, antonym, set_label, deck_id",
    )
    .eq("deck_id", deckId)
    .order("word", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminVocabCard[];
}

export async function patchVocabCard(
  cardId: string,
  patch: Partial<Omit<AdminVocabCard, "id" | "deck_id">>,
): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`/api/vocab/admin/cards/${encodeURIComponent(cardId)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(patch),
  });
  const body = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Update failed");
}

export async function deleteVocabCard(cardId: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`/api/vocab/admin/cards/${encodeURIComponent(cardId)}`, {
    method: "DELETE",
    headers,
  });
  const body = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Delete failed");
}

export async function fetchDeckDueCount(deckId?: string): Promise<number> {
  const { data, error } = await supabase.rpc("vocab_due_count", {
    p_deck_id: deckId ?? null,
  });
  if (error) throw new Error(error.message);
  return typeof data === "number" ? data : 0;
}

export async function fetchVocabDueCount(): Promise<number> {
  return fetchDeckDueCount();
}

export async function fetchVocabDecks(): Promise<VocabDeck[]> {
  const { data, error } = await supabase
    .from("vocab_decks")
    .select("*")
    .order("title", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as VocabDeck[];
}

export type DeckPickerRow = VocabDeck & {
  cardCount: number;
  dueCount: number;
  newCount: number;
  learningCount: number;
  reviewCount: number;
  lastStudied: string | null;
};

async function fetchDeckStats(deckId: string): Promise<{
  new_count: number;
  learning_count: number;
  review_count: number;
  total_count: number;
}> {
  const { data, error } = await supabase.rpc("vocab_deck_stats", { p_deck_id: deckId });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    new_count: row?.new_count ?? 0,
    learning_count: row?.learning_count ?? 0,
    review_count: row?.review_count ?? 0,
    total_count: row?.total_count ?? 0,
  };
}

export async function fetchDeckPickerRows(): Promise<DeckPickerRow[]> {
  const { data: decks, error } = await supabase
    .from("vocab_decks")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });
  if (error) throw new Error(error.message);

  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;

  const statsByDeck = new Map<
    string,
    { new_count: number; learning_count: number; review_count: number; total_count: number }
  >();

  await Promise.all(
    (decks ?? []).map(async (deck) => {
      try {
        const stats = await fetchDeckStats(deck.id);
        statsByDeck.set(deck.id, stats);
      } catch {
        statsByDeck.set(deck.id, { new_count: 0, learning_count: 0, review_count: 0, total_count: 0 });
      }
    }),
  );

  const childrenByParent = new Map<string | null, string[]>();
  for (const deck of decks ?? []) {
    const key = deck.parent_id as string | null;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key)!.push(deck.id);
  }

  function aggregateStats(deckId: string): {
    new_count: number;
    learning_count: number;
    review_count: number;
    total_count: number;
  } {
    const deck = (decks ?? []).find((d) => d.id === deckId);
    const direct = statsByDeck.get(deckId) ?? {
      new_count: 0,
      learning_count: 0,
      review_count: 0,
      total_count: 0,
    };
    if (!deck?.is_folder) return direct;
    const kids = childrenByParent.get(deckId) ?? [];
    return kids.reduce(
      (acc, kid) => {
        const s = aggregateStats(kid);
        return {
          new_count: acc.new_count + s.new_count,
          learning_count: acc.learning_count + s.learning_count,
          review_count: acc.review_count + s.review_count,
          total_count: acc.total_count + s.total_count,
        };
      },
      { new_count: 0, learning_count: 0, review_count: 0, total_count: 0 },
    );
  }

  const rows = await Promise.all(
    (decks ?? []).map(async (deck) => {
      const stats = aggregateStats(deck.id);
      let lastStudied: string | null = null;
      if (uid && !deck.is_folder) {
        const { data: states } = await supabase
          .from("user_card_states")
          .select("last_review, vocab_cards!inner(deck_id)")
          .eq("user_id", uid)
          .eq("vocab_cards.deck_id", deck.id)
          .not("last_review", "is", null)
          .order("last_review", { ascending: false })
          .limit(1);
        lastStudied = states?.[0]?.last_review ?? null;
      }

      return {
        ...(deck as VocabDeck),
        cardCount: stats.total_count,
        dueCount: stats.review_count + stats.new_count,
        newCount: stats.new_count,
        learningCount: stats.learning_count,
        reviewCount: stats.review_count,
        lastStudied,
      };
    }),
  );

  return rows.filter((r) => r.cardCount > 0);
}

export type VocabDueSummary = {
  totalDue: number;
  topDeck?: { id: string; title: string; dueCount: number };
};

export async function fetchVocabDueSummary(): Promise<VocabDueSummary> {
  const [totalDue, rows] = await Promise.all([fetchDeckDueCount(), fetchDeckPickerRows()]);
  const withDue = rows.filter((r) => r.dueCount > 0);
  const topDeck =
    withDue.length === 1
      ? { id: withDue[0].id, title: withDue[0].title, dueCount: withDue[0].dueCount }
      : undefined;
  return { totalDue, topDeck };
}

export async function fetchVocabActivityLast7(): Promise<string[]> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return [];

  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    dates.push(format(subDays(new Date(), i), "yyyy-MM-dd"));
  }

  const { data } = await supabase
    .from("vocab_activity_logs")
    .select("activity_date,cards_reviewed")
    .eq("user_id", uid)
    .in("activity_date", dates);

  const active = new Set(
    (data ?? []).filter((r) => (r.cards_reviewed ?? 0) > 0).map((r) => r.activity_date),
  );
  return dates.map((d) => (active.has(d) ? d : ""));
}
