import { publicError } from "@/lib/http/public-error";
import { jsonReadError, readJsonLimited } from "@/lib/http/read-json";
import { sharedRateLimit } from "@/lib/shared-rate-limit";
import { recordVerifiedCardReview } from "../activity";
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

  const limit = await sharedRateLimit(env, `vocab-session:${auth.user.id}`, 30, 10);
  if (!limit.ok) {
    return jsonResponse(
      { error: "Too many session requests. Wait a moment." },
      { status: 429, headers: { "retry-after": String(limit.retryAfter || 10) } },
    );
  }

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
          learning_steps: r.learning_steps ?? 0,
          last_review: r.last_review,
        },
        intervals: previewIntervals(r),
      }));

    return jsonResponse({ cards, total: cards.length });
  } catch (e) {
    return jsonResponse(
      { error: publicError("vocab/session", e instanceof Error ? e.message : String(e), "Failed to load session.") },
      500,
    );
  }
}

export async function handleVocabReview(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const auth = await requireUser(request, env);
  if (!auth.ok) return auth.response;

  const limit = await sharedRateLimit(env, `vocab-review:${auth.user.id}`, 120, 60);
  if (!limit.ok) {
    return jsonResponse(
      { error: "Too many reviews too fast. Pause for a moment." },
      { status: 429, headers: { "retry-after": String(limit.retryAfter || 5) } },
    );
  }

  const read = await readJsonLimited<{ cardId?: unknown; rating?: unknown }>(request);
  if (!read.ok) return jsonResponse(jsonReadError(read.status), read.status);
  const body = read.value ?? {};

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
      learning_steps?: number;
      last_review: string | null;
      vocab_cards?: { deck_id?: string | null } | null;
    }[]
  >(
    auth.config,
    auth.token,
    `user_card_states?user_id=eq.${encodeURIComponent(auth.user.id)}&card_id=eq.${encodeURIComponent(cardId)}&select=*,vocab_cards(deck_id)`,
  );

  if (error || !rows?.[0]) {
    return jsonResponse({ error: "Card state not found" }, 404);
  }

  const current = rows[0];
  const dueMs = new Date(current.due).getTime();
  if (Number.isFinite(dueMs) && dueMs > Date.now() + 60_000) {
    return jsonResponse({ error: "This card is not due for review yet." }, 409);
  }
  const updated = applyReview(current, rating as ReviewRating);

  const patch = await restFetch(
    auth.config,
    auth.token,
    `user_card_states?id=eq.${encodeURIComponent(current.id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(updated),
      headers: { Prefer: "return=representation" },
    },
  );

  if (patch.error) {
    return jsonResponse(
      { error: publicError("vocab/review", patch.error, "Could not save review.") },
      500,
    );
  }

  await recordVerifiedCardReview(
    env,
    auth.user.id,
    current.vocab_cards?.deck_id ?? null,
    rating as 1 | 2 | 3 | 4,
  );

  const { vocab_cards: _dropCard, ...currentState } = current;
  const next = { ...currentState, ...updated };
  return jsonResponse({
    state: next,
    intervals: previewIntervals(next),
  });
}
