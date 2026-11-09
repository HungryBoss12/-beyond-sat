import { describe, expect, it, vi } from "vitest";

const SERVER_MAX_ROWS = 1000;
const ledger = Array.from({ length: 1174 }, (_, i) => ({
  id: `row-${i}`,
  user_id: "student",
  kind: "charge",
  amount_uzs: 1000,
  occurred_on: "2026-11-01",
  created_at: "2026-11-01T00:00:00Z",
  source: "auto",
}));

function ledgerQuery() {
  let from = 0;
  let to = Number.POSITIVE_INFINITY;
  const query = {
    select: () => query,
    order: () => query,
    limit: (n: number) => {
      to = n - 1;
      return query;
    },
    range: (start: number, end: number) => {
      from = start;
      to = end;
      return query;
    },
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      resolve({
        data: ledger.slice(from, Math.min(to + 1, from + SERVER_MAX_ROWS)),
        error: null,
      }),
  };
  return query;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ledgerQuery() },
}));

const { listAllLedger } = await import("./api");

describe("listAllLedger", () => {
  it("returns every row when the server caps each response at 1000", async () => {
    const rows = await listAllLedger();
    expect(rows).toHaveLength(1174);
    expect(new Set(rows.map((row) => row.id)).size).toBe(1174);
  });
});
