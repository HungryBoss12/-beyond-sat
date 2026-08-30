import { jsonResponse, requireStaff } from "../rest";
import type { DifficultyTier, GeneratedVocabItem } from "../types";

type SavePayload = {
  items: GeneratedVocabItem[];
  quizTitle?: string;
  quizId?: string;
  deckName?: string;
  /** When true, import SRS cards only — no vocab_quizzes row or quiz questions. */
  cardsOnly?: boolean;
};

const DEFAULT_DECK_ID = "00000000-0000-4000-8000-000000000001";

async function resolveDeckId(
  restFetch: typeof import("../rest").restFetch,
  config: import("@/lib/server-env").SupabaseConfig,
  token: string,
  deckName: string | undefined,
  cardsOnly: boolean,
): Promise<string | null> {
  if (!cardsOnly) return null;

  const title = deckName?.trim() || "Imported Deck";
  const { data: existing } = await restFetch<{ id: string }[]>(
    config,
    token,
    `vocab_decks?title=eq.${encodeURIComponent(title)}&select=id&limit=1`,
  );
  if (existing?.[0]) return existing[0].id;

  const { data: created, error } = await restFetch<{ id: string }[]>(config, token, "vocab_decks", {
    method: "POST",
    body: JSON.stringify({ title, description: null }),
    headers: { Prefer: "return=representation" },
  });
  if (error || !created?.[0]) return DEFAULT_DECK_ID;
  return created[0].id;
}

export async function handleVocabAdminSave(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const auth = await requireStaff(request, env);
  if (!auth.ok) return auth.response;

  let body: SavePayload;
  try {
    body = (await request.json()) as SavePayload;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return jsonResponse({ error: "items required" }, 400);
  }

  const { restFetch } = await import("../rest");

  const cardsOnly = body.cardsOnly === true;
  const deckId = await resolveDeckId(restFetch, auth.config, auth.token, body.deckName, cardsOnly);

  let quizId = typeof body.quizId === "string" ? body.quizId : "";

  if (!cardsOnly && !quizId) {
    const title = body.quizTitle?.trim() || `Vocab Quiz ${new Date().toLocaleDateString()}`;
    const { data: quizRows, error: quizErr } = await restFetch<{ id: string }[]>(
      auth.config,
      auth.token,
      "vocab_quizzes",
      {
        method: "POST",
        body: JSON.stringify({ title, description: "AI-generated Words in Context practice" }),
        headers: { Prefer: "return=representation" },
      },
    );
    if (quizErr || !quizRows?.[0]) {
      return jsonResponse({ error: quizErr ?? "Failed to create quiz" }, 500);
    }
    quizId = quizRows[0].id;
  }

  const saved: { cardId: string; questionId: string; word: string }[] = [];
  let position = 0;

  for (const item of body.items) {
    const tier = (item.difficultyTier ?? "Medium") as DifficultyTier;
    const { data: cardRows, error: cardErr } = await restFetch<{ id: string }[]>(
      auth.config,
      auth.token,
      "vocab_cards",
      {
        method: "POST",
        body: JSON.stringify({
          word: item.word.trim().toLowerCase(),
          part_of_speech: item.partOfSpeech,
          definition: item.definition,
          dsat_passage: item.dSatPassage,
          roots_etymology: item.rootsEtymology ?? null,
          synonyms: item.synonyms,
          sat_traps: item.satTraps ?? null,
          difficulty_tier: tier,
          deck_id: deckId,
        }),
        headers: { Prefer: "return=representation" },
      },
    );

    let cardId: string | undefined = cardRows?.[0]?.id;

    if (cardErr) {
      if (cardErr.includes("duplicate") || cardErr.includes("23505")) {
        const { data: existing } = await restFetch<{ id: string }[]>(
          auth.config,
          auth.token,
          `vocab_cards?word=eq.${encodeURIComponent(item.word.trim().toLowerCase())}&select=id`,
        );
        if (!existing?.[0]) {
          return jsonResponse({ error: `Duplicate word: ${item.word}` }, 409);
        }
        cardId = existing[0].id;
        if (deckId) {
          await restFetch(auth.config, auth.token, `vocab_cards?id=eq.${cardId}`, {
            method: "PATCH",
            body: JSON.stringify({ deck_id: deckId }),
          });
        }
      } else {
        return jsonResponse({ error: cardErr }, 500);
      }
    }

    if (!cardId) return jsonResponse({ error: "Failed to save card" }, 500);

    if (cardsOnly) {
      saved.push({ cardId, questionId: "", word: item.word });
      continue;
    }

    const q = item.quizQuestion;
    const { data: qRows, error: qErr } = await restFetch<{ id: string }[]>(
      auth.config,
      auth.token,
      "vocab_quiz_questions",
      {
        method: "POST",
        body: JSON.stringify({
          quiz_id: quizId,
          vocab_card_id: cardId,
          passage_text: q.passageText,
          correct_answer: q.correctAnswer,
          options: q.options,
          explanation: q.explanation,
          position: position++,
        }),
        headers: { Prefer: "return=representation" },
      },
    );

    if (qErr) return jsonResponse({ error: qErr }, 500);

    saved.push({ cardId, questionId: qRows?.[0]?.id ?? "", word: item.word });
  }

  return jsonResponse({ quizId: cardsOnly ? "" : quizId, saved, count: saved.length });
}
