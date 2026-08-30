import { recordUserActivity } from "../activity";
import { applyReview, previewIntervals } from "../fsrs";
import { jsonResponse, requireUser, restFetch } from "../rest";
import { fetchDueSession } from "../session";
import type { ReviewRating, SessionCard } from "../types";

export async function handleVocabSession(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const auth = await requireUser(request, env);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const deckId = url.searchParams.get("deckId") ?? undefined;
    const rows = await fetchDueSession(auth.config, auth.token, auth.user.id, deckId ?? undefined);
    const cards: SessionCard[] = rows
      .filter((r) => r.vocab_cards)
      .map((r) => ({
        stateId: r.id,
        card: r.vocab_cards,
        fsrs: {
          id: r.id,
          user_id: r.user_id,
          card_id: r.card_id,
          due: r.due,
          stability: r.stability,
          difficulty: r.difficulty,
          elapsed_days: r.elapsed_days,
          scheduled_days: r.scheduled_days,
          reps: r.reps,
          lapses: r.lapses,
          state: r.state,
          last_review: r.last_review,
        },
        intervals: previewIntervals(r),
      }));

    return jsonResponse({ cards, total: cards.length });
  } catch (e) {
    console.error("[vocab/session]", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Failed to load session" }, 500);
  }
}

export async function handleVocabReview(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const auth = await requireUser(request, env);
  if (!auth.ok) return auth.response;

  let body: { cardId?: unknown; rating?: unknown };
  try {
    body = (await request.json()) as { cardId?: unknown; rating?: unknown };
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const cardId = typeof body.cardId === "string" ? body.cardId : "";
  const rating = body.rating;
  if (!cardId) return jsonResponse({ error: "cardId required" }, 400);
  if (![1, 2, 3, 4].includes(rating as number)) {
    return jsonResponse({ error: "rating must be 1-4" }, 400);
  }

  const { data: rows, error } = await restFetch<
    {
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
    }[]
  >(
    auth.config,
    auth.token,
    `user_card_states?user_id=eq.${auth.user.id}&card_id=eq.${cardId}&select=*`,
  );

  if (error || !rows?.[0]) {
    return jsonResponse({ error: "Card state not found" }, 404);
  }

  const current = rows[0];
  const updated = applyReview(current, rating as ReviewRating);

  const patch = await restFetch(auth.config, auth.token, `user_card_states?id=eq.${current.id}`, {
    method: "PATCH",
    body: JSON.stringify(updated),
    headers: { Prefer: "return=representation" },
  });

  if (patch.error) {
    return jsonResponse({ error: patch.error }, 500);
  }

  await recordUserActivity(auth.config, auth.token, auth.user.id, 1);

  const next = { ...current, ...updated };
  return jsonResponse({
    state: next,
    intervals: previewIntervals(next),
  });
}
