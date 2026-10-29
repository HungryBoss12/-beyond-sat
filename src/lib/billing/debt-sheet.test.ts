import { describe, expect, it } from "vitest";
import { collectNoteKey, type CollectNote } from "./collect-notes";
import { debtSheets } from "./debt-sheet";
import type { BalanceRow } from "./types";

function row(partial: Partial<BalanceRow> & Pick<BalanceRow, "user_id" | "class_id" | "class_name" | "balance">): BalanceRow {
  return {
    full_name: "Student",
    username: null,
    phone: null,
    status: "active",
    groups: [],
    rw: null,
    math: null,
    total_score: 0,
    rank_letter: "C",
    monthly_fee: null,
    monthly_tuition: null,
    expected_this_month: null,
    charged: 0n,
    paid: 0n,
    last_payment_on: null,
    months_in_debt: 0,
    recent: [],
    ...partial,
  };
}

describe("debtSheets", () => {
  it("puts English and Math beside one parent class and keeps the note", () => {
    const notes = new Map<string, CollectNote>([
      [
        collectNoteKey("u1", "c1", "ebrw"),
        { user_id: "u1", class_id: "c1", subject: "ebrw", expect_on: "2026-11-05", reason: "Will pay" },
      ],
    ]);
    const sheets = debtSheets(
      [
        row({
          user_id: "u1",
          full_name: "Ali",
          class_id: "c1",
          class_name: "SAT 14 Eng",
          balance: -250000n,
          groups: [
            { id: "g1", class_id: "c1", name: "SAT 14 Eng", subject: "ebrw", status: "active", activated_on: null },
            { id: "g2", class_id: "c1", name: "SAT 14 Math", subject: "math", status: "active", activated_on: null },
          ],
        }),
      ],
      notes,
    );
    expect(sheets).toHaveLength(1);
    expect(sheets[0]?.title).toBe("SAT 14");
    expect(sheets[0]?.english[0]).toMatchObject({ name: "Ali", debt: 250000, expectOn: "2026-11-05", reason: "Will pay" });
    expect(sheets[0]?.math[0]?.groups).toBe("SAT 14 Math");
    expect(sheets[0]?.math[0]?.debt).toBe(250000);
  });
});
