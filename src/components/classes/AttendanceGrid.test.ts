import { describe, expect, it } from "vitest";
import { buildParticipationGrid } from "./AttendanceGrid";

const today = new Date(2026, 10, 5);

describe("buildParticipationGrid", () => {
  it("counts only lessons inside the visible weeks", () => {
    const grid = buildParticipationGrid(
      [
        { lesson_date: "2026-11-02", participated: true },
        { lesson_date: "2026-11-02", participated: true },
        { lesson_date: "2026-11-04", participated: false },
        { lesson_date: "2025-01-06", participated: true },
      ],
      26,
      today,
    );

    expect(grid.total).toBe(2);
    const monday = grid.cells.find((cell) => cell.date === "2026-11-02");
    expect(monday?.level).toBe(2);
    expect(monday?.future).toBe(false);
    expect(new Date(grid.cells[0].date + "T12:00:00").getDay()).toBe(0);
    expect(grid.cells.at(-1) && new Date(grid.cells.at(-1)!.date + "T12:00:00").getDay()).toBe(6);
  });

  it("keeps month names whole and leaves days that have not happened blank", () => {
    const grid = buildParticipationGrid([], 26, today);
    const names = grid.monthLabels.map((label) => label.label);
    expect(names).toContain("May");
    expect(names).toContain("Nov");
    expect(names.every((name) => name.length >= 3)).toBe(true);
    expect(grid.cells.find((cell) => cell.date === "2026-11-06")?.future).toBe(true);
    expect(grid.cells.find((cell) => cell.date === "2026-11-05")?.future).toBe(false);
  });
});
