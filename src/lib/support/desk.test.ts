import { describe, expect, it } from "vitest";
import type { DaySlot } from "./api";
import {
  buildHandoffRows,
  initialSupportDay,
  monthGridCells,
  resolveSupportDeskTab,
  tashkentDayKey,
  visibleBoards,
} from "./desk";

function makeSlot(overrides: Partial<DaySlot> = {}): DaySlot {
  return {
    id: "win-1",
    teacher_id: "tea-ebrw",
    teacher_name: "Mukhammadali Achildiyev",
    starts_at: "2026-11-17T11:00:00.000Z",
    ends_at: "2026-11-17T11:30:00.000Z",
    student_id: null,
    student_name: null,
    session_id: null,
    subject: null,
    attended: null,
    homework_done: null,
    task: null,
    note: null,
    closed: false,
    ...overrides,
  };
}

describe("support teacher booking visibility logic", () => {
  it("defaults the selected support calendar day to today in Tashkent and rejects malformed dates", () => {
    const now = new Date("2026-11-16T20:30:00.000Z");
    expect(initialSupportDay(now)).toBe("2026-11-17");
    expect(tashkentDayKey("2026-11-16T20:30:00.000Z")).toBe("2026-11-17");
    expect(tashkentDayKey("not-a-valid-iso")).toBe("");
  });

  it("builds a 42-day Monday-first grid covering the full visible month", () => {
    const grid = monthGridCells(new Date(2026, 10, 17));
    expect(grid.cells).toHaveLength(42);
    expect(grid.cells[0]?.date.getDay()).toBe(1);
    expect(grid.cells[41]?.date.getDay()).toBe(0);
    expect(grid.fromDay).toBe("2026-10-26");
    expect(grid.toDay).toBe("2026-12-06");
    expect(grid.cells.find((c) => c.key === "2026-11-01")?.inMonth).toBe(true);
    expect(grid.cells.find((c) => c.key === "2026-10-31")?.inMonth).toBe(false);
  });

  it("returns both boards for shared views and always returns a board in own mode", () => {
    expect(visibleBoards(false, undefined, []).map((b) => b.subject)).toEqual(["ebrw", "math"]);
    expect(visibleBoards(true, "math", [])).toEqual([{ subject: "math", label: "Math" }]);
    expect(visibleBoards(true, "ebrw", [])).toEqual([{ subject: "ebrw", label: "English" }]);

    const mathBooked = makeSlot({
      student_id: "stu-1",
      student_name: "Habibullayeva Laziza",
      session_id: "ses-1",
      subject: "math",
    });
    expect(visibleBoards(true, undefined, [mathBooked])).toEqual([
      { subject: "math", label: "Math" },
    ]);
    expect(visibleBoards(true, null, [])).toEqual([{ subject: "ebrw", label: "Sessions" }]);
  });

  it("never hides a booked student slot even if the window was marked closed", () => {
    const closedBooked = makeSlot({
      id: "win-booked-closed",
      student_id: "stu-1",
      student_name: "Musurmonqulov Ramazon",
      session_id: "ses-1",
      subject: "ebrw",
      task: "Read passage 2",
      closed: true,
    });
    const closedEmpty = makeSlot({
      id: "win-empty-closed",
      starts_at: "2026-11-17T11:30:00.000Z",
      ends_at: "2026-11-17T12:00:00.000Z",
      closed: true,
    });

    const ownRows = buildHandoffRows({
      subject: "ebrw",
      slots: [closedBooked, closedEmpty],
      past: false,
      picked: {},
      allowed: null,
      own: true,
      defaultTeacherId: null,
    });
    expect(ownRows.map((r) => r.id)).toEqual(["win-booked-closed"]);
    expect(ownRows[0]?.note).toBe("Read passage 2");

    const adminRows = buildHandoffRows({
      subject: "ebrw",
      slots: [closedBooked, closedEmpty],
      past: false,
      picked: {},
      allowed: new Set(["tea-ebrw"]),
      own: false,
      defaultTeacherId: "tea-ebrw",
    });
    expect(adminRows.map((r) => r.id)).toEqual(["win-booked-closed"]);
  });

  it("drops unbooked slots on past days while sorting booked slots chronologically", () => {
    const laterBooked = makeSlot({
      id: "win-later",
      starts_at: "2026-11-14T12:00:00.000Z",
      ends_at: "2026-11-14T12:30:00.000Z",
      student_id: "stu-2",
      student_name: "Abdurasulova Iroda",
      subject: "ebrw",
      note: "Bring notebook",
    });
    const earlierBooked = makeSlot({
      id: "win-earlier",
      starts_at: "2026-11-14T10:30:00.000Z",
      ends_at: "2026-11-14T11:00:00.000Z",
      student_id: "stu-1",
      student_name: "Erkinov Javohir",
      subject: "ebrw",
    });
    const unbookedPast = makeSlot({
      id: "win-free-past",
      starts_at: "2026-11-14T11:00:00.000Z",
      ends_at: "2026-11-14T11:30:00.000Z",
    });

    const ownPast = buildHandoffRows({
      subject: "ebrw",
      slots: [laterBooked, unbookedPast, earlierBooked],
      past: true,
      picked: {},
      allowed: null,
      own: true,
      defaultTeacherId: null,
    });
    expect(ownPast.map((r) => r.id)).toEqual(["win-earlier", "win-later"]);
    expect(ownPast[1]?.note).toBe("Bring notebook");

    const sharedPast = buildHandoffRows({
      subject: "ebrw",
      slots: [laterBooked, unbookedPast, earlierBooked],
      past: true,
      picked: {},
      allowed: new Set(["tea-ebrw"]),
      own: false,
      defaultTeacherId: "tea-ebrw",
    });
    expect(sharedPast.map((r) => r.id)).toEqual(["win-earlier", "win-later"]);
  });

  it("falls back to the teacher subject and picks picked or default teachers on free slots", () => {
    const legacyBooked = makeSlot({
      id: "win-legacy",
      teacher_id: "tea-math-1",
      teacher_name: "Marjona Bozorova",
      starts_at: "2026-11-17T11:00:00.000Z",
      ends_at: "2026-11-17T11:30:00.000Z",
      student_id: "stu-2",
      student_name: "Habibullayeva Laziza",
      subject: null,
    });
    const freeMathDefault = makeSlot({
      id: "win-math-default",
      teacher_id: "tea-math-1",
      teacher_name: "Marjona Bozorova",
      starts_at: "2026-11-17T11:30:00.000Z",
      ends_at: "2026-11-17T12:00:00.000Z",
      note: "Algebra drill",
    });
    const freeMathAlt = makeSlot({
      id: "win-math-alt",
      teacher_id: "tea-math-2",
      teacher_name: "Magueltest",
      starts_at: "2026-11-17T11:30:00.000Z",
      ends_at: "2026-11-17T12:00:00.000Z",
    });
    const freeOtherSubject = makeSlot({
      id: "win-ebrw-free",
      teacher_id: "tea-ebrw",
      starts_at: "2026-11-17T12:00:00.000Z",
      ends_at: "2026-11-17T12:30:00.000Z",
    });

    const mathRows = buildHandoffRows({
      subject: "math",
      slots: [freeMathAlt, freeOtherSubject, freeMathDefault, legacyBooked],
      past: false,
      picked: { "math:2026-11-17T11:30:00.000Z": "tea-math-2" },
      allowed: new Set(["tea-math-1", "tea-math-2"]),
      own: false,
      defaultTeacherId: "tea-math-1",
      teacherSubjects: new Map([
        ["tea-math-1", "math"],
        ["tea-math-2", "math"],
        ["tea-ebrw", "ebrw"],
      ]),
    });

    expect(mathRows.map((r) => r.id)).toEqual(["win-legacy", "win-math-alt"]);
    expect(mathRows[1]?.note).toBe("Algebra drill");
  });

  it("shows Booked by default, falls back to Students when no upcoming bookings exist, and respects manual selection", () => {
    expect(
      resolveSupportDeskTab(null, { comingCount: 0, receivedCount: 20, loadingComing: true }),
    ).toBe("booked");
    expect(
      resolveSupportDeskTab(null, { comingCount: 2, receivedCount: 20, loadingComing: false }),
    ).toBe("booked");
    expect(
      resolveSupportDeskTab(null, { comingCount: 0, receivedCount: 20, loadingComing: false }),
    ).toBe("students");
    expect(
      resolveSupportDeskTab(null, { comingCount: 0, receivedCount: 0, loadingComing: false }),
    ).toBe("booked");
    expect(
      resolveSupportDeskTab("booked", { comingCount: 0, receivedCount: 20, loadingComing: false }),
    ).toBe("booked");
    expect(
      resolveSupportDeskTab("students", { comingCount: 3, receivedCount: 20, loadingComing: false }),
    ).toBe("students");
  });
});
