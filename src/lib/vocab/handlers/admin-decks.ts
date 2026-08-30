import { jsonResponse, requireStaff, restFetch } from "../rest";

type DeckPatch = { title?: unknown };

type CardPatch = {
  word?: unknown;
  part_of_speech?: unknown;
  definition?: unknown;
  dsat_passage?: unknown;
  roots_etymology?: unknown;
  synonyms?: unknown;
  sat_traps?: unknown;
  difficulty_tier?: unknown;
  example_sentence?: unknown;
  antonym?: unknown;
  set_label?: unknown;
};

export async function handleVocabAdminDeck(
  request: Request,
  env: unknown,
  deckId: string,
): Promise<Response> {
  const auth = await requireStaff(request, env);
  if (!auth.ok) return auth.response;

  if (request.method === "PATCH") {
    let body: DeckPatch;
    try {
      body = (await request.json()) as DeckPatch;
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return jsonResponse({ error: "title required" }, 400);

    const patch = await restFetch(auth.config, auth.token, `vocab_decks?id=eq.${deckId}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
      headers: { Prefer: "return=representation" },
    });
    if (patch.error) return jsonResponse({ error: patch.error }, patch.status);
    return jsonResponse({ deck: patch.data?.[0] ?? null });
  }

  if (request.method === "DELETE") {
    const del = await restFetch(auth.config, auth.token, `vocab_decks?id=eq.${deckId}`, {
      method: "DELETE",
    });
    if (del.error) return jsonResponse({ error: del.error }, del.status);
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
}

export async function handleVocabAdminCard(
  request: Request,
  env: unknown,
  cardId: string,
): Promise<Response> {
  const auth = await requireStaff(request, env);
  if (!auth.ok) return auth.response;

  if (request.method === "PATCH") {
    let body: CardPatch;
    try {
      body = (await request.json()) as CardPatch;
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    const patch: Record<string, unknown> = {};
    if (typeof body.word === "string") patch.word = body.word.trim();
    if (typeof body.part_of_speech === "string") patch.part_of_speech = body.part_of_speech.trim();
    if (typeof body.definition === "string") patch.definition = body.definition.trim();
    if (typeof body.dsat_passage === "string") patch.dsat_passage = body.dsat_passage.trim();
    if (typeof body.roots_etymology === "string") patch.roots_etymology = body.roots_etymology.trim();
    if (typeof body.sat_traps === "string") patch.sat_traps = body.sat_traps.trim();
    if (typeof body.difficulty_tier === "string") patch.difficulty_tier = body.difficulty_tier;
    if (typeof body.example_sentence === "string") patch.example_sentence = body.example_sentence.trim();
    if (typeof body.antonym === "string") patch.antonym = body.antonym.trim();
    if (typeof body.set_label === "string") patch.set_label = body.set_label.trim();
    if (Array.isArray(body.synonyms)) {
      patch.synonyms = body.synonyms.filter((s): s is string => typeof s === "string");
    }

    if (Object.keys(patch).length === 0) {
      return jsonResponse({ error: "No fields to update" }, 400);
    }

    const result = await restFetch(auth.config, auth.token, `vocab_cards?id=eq.${cardId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
      headers: { Prefer: "return=representation" },
    });
    if (result.error) return jsonResponse({ error: result.error }, result.status);
    return jsonResponse({ card: result.data?.[0] ?? null });
  }

  if (request.method === "DELETE") {
    const del = await restFetch(auth.config, auth.token, `vocab_cards?id=eq.${cardId}`, {
      method: "DELETE",
    });
    if (del.error) return jsonResponse({ error: del.error }, del.status);
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
}
