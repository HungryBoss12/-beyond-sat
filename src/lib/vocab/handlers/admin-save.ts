import { jsonResponse, requireStaff } from "../rest";
import type { AnkiDeckNode, DifficultyTier, GeneratedVocabItem } from "../types";

type SavePayload = {
  items: GeneratedVocabItem[];
  deckTree?: AnkiDeckNode[];
  quizTitle?: string;
  quizId?: string;
  deckName?: string;
  cardsOnly?: boolean;
};

const DEFAULT_DECK_ID = "00000000-0000-4000-8000-000000000001";

async function upsertDeckTree(
  restFetch: typeof import("../rest").restFetch,
  config: import("@/lib/server-env").SupabaseConfig,
  token: string,
  tree: AnkiDeckNode[],
): Promise<Map<string, string>> {
  const pathToId = new Map<string, string>();
  const sorted = [...tree].sort((a, b) => {
    const depthA = a.path.split("::").length;
    const depthB = b.path.split("::").length;
    return depthA - depthB || a.sortOrder - b.sortOrder;
  });

  for (const node of sorted) {
    const parentId = node.parentPath ? pathToId.get(node.parentPath) ?? null : null;
    const { data: existing } = await restFetch<{ id: string }[]>(
      config,
      token,
      `vocab_decks?path=eq.${encodeURIComponent(node.path)}&select=id&limit=1`,
    );
    if (existing?.[0]) {
      pathToId.set(node.path, existing[0].id);
      await restFetch(config, token, `vocab_decks?id=eq.${existing[0].id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: node.title,
          parent_id: parentId,
          sort_order: node.sortOrder,
          is_folder: node.isFolder,
        }),
      });
      continue;
    }

    const { data: created, error } = await restFetch<{ id: string }[]>(
      config,
      token,
      "vocab_decks",
      {
        method: "POST",
        body: JSON.stringify({
          title: node.title,
          path: node.path,
          parent_id: parentId,
          sort_order: node.sortOrder,
          is_folder: node.isFolder,
          description: null,
        }),
        headers: { Prefer: "return=representation" },
      },
    );
    if (error || !created?.[0]) continue;
    pathToId.set(node.path, created[0].id);
  }

  return pathToId;
}

async function resolveDeckId(
  restFetch: typeof import("../rest").restFetch,
  config: import("@/lib/server-env").SupabaseConfig,
  token: string,
  deckName: string | undefined,
  cardsOnly: boolean,
  deckTree?: AnkiDeckNode[],
): Promise<{ defaultDeckId: string | null; pathToId: Map<string, string> }> {
  if (!cardsOnly) return { defaultDeckId: null, pathToId: new Map() };

  let pathToId = new Map<string, string>();
  if (deckTree?.length) {
    pathToId = await upsertDeckTree(restFetch, config, token, deckTree);
  }

  const title = deckName?.trim() || "Imported Deck";
  if (pathToId.size === 0) {
    const { data: existing } = await restFetch<{ id: string }[]>(
      config,
      token,
      `vocab_decks?title=eq.${encodeURIComponent(title)}&select=id&limit=1`,
    );
    if (existing?.[0]) return { defaultDeckId: existing[0].id, pathToId };

    const { data: created, error } = await restFetch<{ id: string }[]>(
      config,
      token,
      "vocab_decks",
      {
        method: "POST",
        body: JSON.stringify({ title, description: null }),
        headers: { Prefer: "return=representation" },
      },
    );
    if (error || !created?.[0]) return { defaultDeckId: DEFAULT_DECK_ID, pathToId };
    return { defaultDeckId: created[0].id, pathToId };
  }

  const firstLeaf = deckTree?.find((n) => !n.isFolder);
  const defaultDeckId = firstLeaf ? pathToId.get(firstLeaf.path) ?? null : null;
  return { defaultDeckId, pathToId };
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
  const { defaultDeckId, pathToId } = await resolveDeckId(
    restFetch,
    auth.config,
    auth.token,
    body.deckName,
    cardsOnly,
    body.deckTree,
  );

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
    const deckId =
      (item.ankiDeckPath && pathToId.get(item.ankiDeckPath)) || defaultDeckId;

    const cardPayload = {
      word: item.word.trim().toLowerCase(),
      part_of_speech: item.partOfSpeech,
      definition: item.definition,
      dsat_passage: item.dSatPassage,
      roots_etymology: item.rootsEtymology ?? null,
      synonyms: item.synonyms,
      sat_traps: item.satTraps ?? null,
      difficulty_tier: tier,
      deck_id: deckId,
      example_sentence: item.exampleSentence ?? null,
      antonym: item.antonym ?? null,
      set_label: item.setLabel ?? null,
    };

    const { data: cardRows, error: cardErr } = await restFetch<{ id: string }[]>(
      auth.config,
      auth.token,
      "vocab_cards",
      {
        method: "POST",
        body: JSON.stringify(cardPayload),
        headers: { Prefer: "return=representation" },
      },
    );

    let cardId: string | undefined = cardRows?.[0]?.id;

    if (cardErr) {
      if (cardErr.includes("duplicate") || cardErr.includes("23505")) {
        const deckFilter = deckId ? `&deck_id=eq.${deckId}` : "";
        const { data: existing } = await restFetch<{ id: string }[]>(
          auth.config,
          auth.token,
          `vocab_cards?word=eq.${encodeURIComponent(item.word.trim().toLowerCase())}${deckFilter}&select=id&limit=1`,
        );
        if (!existing?.[0]) {
          return jsonResponse({ error: `Duplicate word: ${item.word}` }, 409);
        }
        cardId = existing[0].id;
        await restFetch(auth.config, auth.token, `vocab_cards?id=eq.${cardId}`, {
          method: "PATCH",
          body: JSON.stringify(cardPayload),
        });
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
