import type { SupabaseConfig } from "@/lib/server-env";
import { emptyFsrsState } from "./fsrs";
import { restFetch } from "./rest";
import type { UserCardState } from "./types";

/** Queue missed quiz words for immediate SRS review. */
export async function enqueueMissedWords(
  config: SupabaseConfig,
  token: string,
  userId: string,
  cardIds: string[],
): Promise<void> {
  const unique = [...new Set(cardIds.filter(Boolean))];
  if (unique.length === 0) return;

  const nowIso = new Date().toISOString();

  for (const cardId of unique) {
    const { data: existing } = await restFetch<UserCardState[]>(
      config,
      token,
      `user_card_states?user_id=eq.${userId}&card_id=eq.${cardId}&select=*`,
    );

    if (existing?.[0]) {
      await restFetch(config, token, `user_card_states?id=eq.${existing[0].id}`, {
        method: "PATCH",
        body: JSON.stringify({
          due: nowIso,
          state: existing[0].reps > 0 ? 3 : 0,
          lapses: existing[0].lapses + 1,
        }),
        headers: { Prefer: "return=minimal" },
      });
    } else {
      const seed = emptyFsrsState();
      await restFetch(config, token, "user_card_states", {
        method: "POST",
        body: JSON.stringify({
          user_id: userId,
          card_id: cardId,
          ...seed,
          due: nowIso,
        }),
        headers: { Prefer: "return=minimal" },
      });
    }
  }
}
