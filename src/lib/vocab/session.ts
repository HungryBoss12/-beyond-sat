import type { SupabaseConfig } from "@/lib/server-env";
import { emptyFsrsState } from "./fsrs";
import { restFetch } from "./rest";
import type { UserCardState, VocabCard } from "./types";

const SESSION_LIMIT = 20;

export type StateRow = UserCardState & { vocab_cards: VocabCard };

/** Priority: Relearning(3) → Learning(1) → Review(2) → New(0), then due ASC. */
function statePriority(s: number): number {
  if (s === 3) return 0;
  if (s === 1) return 1;
  if (s === 2) return 2;
  return 3;
}

function sortStates(rows: StateRow[]): StateRow[] {
  return [...rows].sort((a, b) => {
    const pd = statePriority(a.state) - statePriority(b.state);
    if (pd !== 0) return pd;
    return new Date(a.due).getTime() - new Date(b.due).getTime();
  });
}

async function resolveDeckScopeIds(
  config: SupabaseConfig,
  token: string,
  deckId: string,
): Promise<string[]> {
  const { data, error } = await restFetch<string[]>(
    config,
    token,
    "rpc/vocab_deck_descendant_ids",
    {
      method: "POST",
      body: JSON.stringify({ p_deck_id: deckId }),
    },
  );
  if (error) throw new Error(error);
  const ids = (data ?? []).filter(Boolean);
  return ids.length ? ids : [deckId];
}

function deckIdInFilter(ids: string[]): string {
  return `in.(${ids.join(",")})`;
}

export async function fetchDueSession(
  config: SupabaseConfig,
  token: string,
  userId: string,
  deckId?: string,
): Promise<StateRow[]> {
  const nowIso = new Date().toISOString();
  const deckIds = deckId ? await resolveDeckScopeIds(config, token, deckId) : null;
  const deckFilter = deckIds ? `&vocab_cards.deck_id=${deckIdInFilter(deckIds)}` : "";

  const { data: dueRows, error: dueErr } = await restFetch<StateRow[]>(
    config,
    token,
    `user_card_states?user_id=eq.${userId}&due=lte.${nowIso}${deckFilter}&select=*,vocab_cards(*)&limit=50`,
  );
  if (dueErr) throw new Error(dueErr);

  let states = sortStates((dueRows ?? []).filter((r) => r.vocab_cards)).slice(0, SESSION_LIMIT);

  if (states.length < SESSION_LIMIT) {
    const need = SESSION_LIMIT - states.length;

    const { data: ownedStates } = await restFetch<{ card_id: string }[]>(
      config,
      token,
      `user_card_states?user_id=eq.${userId}&select=card_id`,
    );
    const ownedIds = new Set((ownedStates ?? []).map((s) => s.card_id));
    states.forEach((s) => ownedIds.add(s.card_id));

    const cardPath = deckIds
      ? `vocab_cards?deck_id=${deckIdInFilter(deckIds)}&select=*&order=created_at.asc&limit=500`
      : "vocab_cards?select=*&order=created_at.asc&limit=500";

    const { data: allCards } = await restFetch<VocabCard[]>(config, token, cardPath);

    const newCards = (allCards ?? []).filter((c) => !ownedIds.has(c.id)).slice(0, need);

    for (const card of newCards) {
      const seed = emptyFsrsState();
      const { data: inserted } = await restFetch<StateRow[]>(config, token, "user_card_states", {
        method: "POST",
        body: JSON.stringify({
          user_id: userId,
          card_id: card.id,
          ...seed,
        }),
        headers: { Prefer: "return=representation" },
      });
      const row = inserted?.[0];
      if (row) {
        states.push({ ...row, vocab_cards: card });
      }
    }
    states = sortStates(states).slice(0, SESSION_LIMIT);
  }

  return states;
}

export { SESSION_LIMIT };
