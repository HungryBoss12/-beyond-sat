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

export async function saveVocabContent(input: {
  items: GeneratedVocabItem[];
  quizTitle?: string;
  quizId?: string;
  deckName?: string;
  /** Import SRS deck only — skips quiz creation (Anki imports). */
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
  lastStudied: string | null;
};

export async function fetchDeckPickerRows(): Promise<DeckPickerRow[]> {
  const decks = await fetchVocabDecks();
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;

  const rows = await Promise.all(
    decks.map(async (deck) => {
      const [{ count }, dueCount] = await Promise.all([
        supabase
          .from("vocab_cards")
          .select("id", { count: "exact", head: true })
          .eq("deck_id", deck.id),
        fetchDeckDueCount(deck.id),
      ]);

      let lastStudied: string | null = null;
      if (uid) {
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
        ...deck,
        cardCount: count ?? 0,
        dueCount,
        lastStudied,
      };
    }),
  );

  return rows;
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
