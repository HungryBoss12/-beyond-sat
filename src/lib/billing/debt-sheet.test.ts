import { describe, expect, it } from "vitest";
import { collectNoteKey, type CollectNote } from "./collect-notes";
import { debtCsvRows, debtSheets } from "./debt-sheet";
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
    expect(sheets[0]?.english[0]).toMatchObject({
      name: "Ali",
      groups: "SAT 14",
      debt: 250000,
      expectOn: "2026-11-05",
      reason: "Will pay",
    });
    expect(sheets[0]?.math[0]?.groups).toBe("SAT 14");
    expect(sheets[0]?.math[0]?.debt).toBe(250000);
  });

  it("repeats a student on each class sheet and does not combine class names", () => {
    const classNames = new Map([
      ["c12", "SAT 12"],
      ["c13", "SAT 13"],
    ]);
    const notes = new Map<string, CollectNote>([
      [
        collectNoteKey("u1", "c12", "ebrw"),
        { user_id: "u1", class_id: "c12", subject: "ebrw", expect_on: "2026-11-01", reason: "SAT 12" },
      ],
      [
        collectNoteKey("u1", "c13", "ebrw"),
        { user_id: "u1", class_id: "c13", subject: "ebrw", expect_on: "2026-11-02", reason: "SAT 13" },
      ],
    ]);
    const sheets = debtSheets(
      [
        row({
          user_id: "u1",
          full_name: "Ali",
          class_id: "c12",
          class_name: "SAT 12, SAT 13",
          balance: -100000n,
          groups: [
            { id: "g1", class_id: "c12", name: "Morning", subject: "ebrw", status: "active", activated_on: null },
            { id: "g2", class_id: "c12", name: "Morning math", subject: "math", status: "active", activated_on: null },
            { id: "g3", class_id: "c13", name: "SAT 13 Eng", subject: "ebrw", status: "active", activated_on: null },
          ],
        }),
        row({
          user_id: "u2",
          full_name: "Bea",
          class_id: "c12",
          class_name: "SAT 12",
          balance: 0n,
          groups: [
            { id: "g4", class_id: "c12", name: "SAT 12 Eng", subject: "ebrw", status: "active", activated_on: null },
          ],
        }),
      ],
      notes,
      classNames,
    );
    expect(sheets.map((sheet) => sheet.title)).toEqual(["SAT 12", "SAT 13"]);
    const sat12 = sheets[0];
    const sat13 = sheets[1];
    expect(sat12?.english.map((side) => side.name)).toEqual(["Ali", "Bea"]);
    expect(sat12?.math.map((side) => side.name)).toEqual(["Ali"]);
    expect(sat13?.english.map((side) => side.name)).toEqual(["Ali"]);
    expect(sat13?.math).toEqual([]);
    expect(sat12?.english[0]).toMatchObject({
      groups: "SAT 12, SAT 13 Eng",
      debt: 100000,
      expectOn: "2026-11-01",
      reason: "SAT 12",
    });
    expect(sat12?.math[0]?.groups).toBe("SAT 12, SAT 13 Eng");
    expect(sat13?.english[0]).toMatchObject({
      groups: "SAT 12, SAT 13 Eng",
      debt: 100000,
      expectOn: "2026-11-02",
      reason: "SAT 13",
      classId: "c13",
    });
    expect(sat12?.english.find((side) => side.name === "Bea")?.groups).toBe("SAT 12 Eng");
  });

  it("stacks each class in the csv with English and Math side by side", () => {
    const classNames = new Map([
      ["c12", "SAT 12"],
      ["c13", "SAT 13"],
    ]);
    const csv = debtCsvRows(
      [
        row({
          user_id: "u1",
          full_name: "Ali",
          class_id: "c12",
          class_name: "SAT 12, SAT 13",
          balance: -100000n,
          groups: [
            { id: "g1", class_id: "c12", name: "SAT 12 Eng", subject: "ebrw", status: "active", activated_on: null },
            { id: "g2", class_id: "c13", name: "SAT 13 Maths", subject: "math", status: "active", activated_on: null },
          ],
        }),
      ],
      new Map(),
      classNames,
    );
    const titles = csv.filter((line) => line.length === 1).map((line) => line[0]);
    expect(titles).toEqual(["SAT 12", "SAT 13"]);
    expect(csv.some((line) => line[0] === "SAT 12, SAT 13")).toBe(false);
    const sat12 = csv.find((line) => line[1] === "Ali" && line[0] === 1);
    const sat13 = csv.filter((line) => line.includes("Ali"));
    expect(sat12?.[1]).toBe("Ali");
    expect(sat12?.[7]).toBe("");
    expect(sat13.some((line) => line[7] === 1 && line[8] === "Ali")).toBe(true);
  });
});
