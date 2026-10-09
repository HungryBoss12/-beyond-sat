import type { SupabaseConfig } from "@/lib/server-env";
import { restFetch } from "./rest";

/**
 * Log vocab review activity and bump the streak. The database adds to the day's
 * row and updates the streak in one call, on the Tashkent day, so ratings sent
 * in parallel never overwrite each other.
 */
export async function recordUserActivity(
  config: SupabaseConfig,
  token: string,
  _userId: string,
  cardsReviewed = 1,
): Promise<void> {
  const { error } = await restFetch(config, token, "rpc/bs_record_vocab_activity", {
    method: "POST",
    body: JSON.stringify({ p_cards: cardsReviewed }),
  });
  if (error) console.error("[vocab/activity]", error);
}
