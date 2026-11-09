import { describe, expect, it } from "vitest";
import {
  rankMockAttempts,
  recentMockRatings,
  studentLabel,
  type AttemptRow,
} from "./mock-standings";

const names = new Map([
  ["a", "Ada"],
  ["b", "Bea"],
  ["c", "Cy"],
]);

function nameOf(userId: string) {
  return names.get(userId) ?? "Student";
}

describe("rankMockAttempts", () => {
  it("keeps each student's higher score", () => {
    const attempts: AttemptRow[] = [
      {
        userId: "a",
        score: 1200,
        rwScore: 600,
        mathScore: 600,
        completedAt: "2026-01-01T00:00:00Z",
      },
      {
        userId: "a",
        score: 1400,
        rwScore: 700,
        mathScore: 700,
        completedAt: "2026-02-01T00:00:00Z",
      },
      {
        userId: "b",
        score: 1300,
        rwScore: 650,
        mathScore: 650,
        completedAt: "2026-01-15T00:00:00Z",
      },
    ];
    const places = rankMockAttempts(attempts, nameOf);
    expect(places.map((group) => group.people.map((person) => person.score))).toEqual([
      [1400],
      [1300],
    ]);
    expect(places[0]?.people[0]?.rwScore).toBe(700);
  });

  it("keeps the earlier finish when the totals match", () => {
    const attempts: AttemptRow[] = [
      {
        userId: "a",
        score: 1500,
        rwScore: 750,
        mathScore: 750,
        completedAt: "2026-03-02T00:00:00Z",
      },
      {
        userId: "a",
        score: 1500,
        rwScore: 760,
        mathScore: 740,
        completedAt: "2026-03-01T00:00:00Z",
      },
    ];
    const places = rankMockAttempts(attempts, nameOf);
    expect(places).toHaveLength(1);
    expect(places[0]?.people[0]?.rwScore).toBe(760);
    expect(places[0]?.people[0]?.completedAt).toBe("2026-03-01T00:00:00Z");
  });

  it("shares a place and leaves the next score on the next step", () => {
    const attempts: AttemptRow[] = [
      {
        userId: "a",
        score: 1500,
        rwScore: 750,
        mathScore: 750,
        completedAt: "2026-04-01T00:00:00Z",
      },
      {
        userId: "b",
        score: 1500,
        rwScore: 740,
        mathScore: 760,
        completedAt: "2026-04-02T00:00:00Z",
      },
      {
        userId: "c",
        score: 1400,
        rwScore: 700,
        mathScore: 700,
        completedAt: "2026-04-03T00:00:00Z",
      },
    ];
    const places = rankMockAttempts(attempts, nameOf);
    expect(places.map((group) => group.place)).toEqual([1, 2]);
    expect(places[0]?.people.map((person) => person.name).sort()).toEqual(["Ada", "Bea"]);
    expect(places[1]?.people[0]?.name).toBe("Cy");
  });

  it("drops unscored rows and still ranks a short field", () => {
    const attempts: AttemptRow[] = [
      {
        userId: "a",
        score: null,
        rwScore: null,
        mathScore: null,
        completedAt: "2026-05-01T00:00:00Z",
      },
      { userId: "b", score: 1100, rwScore: 550, mathScore: 550, completedAt: null },
      {
        userId: "c",
        score: 1000,
        rwScore: 500,
        mathScore: 500,
        completedAt: "2026-05-02T00:00:00Z",
      },
    ];
    const places = rankMockAttempts(attempts, nameOf);
    expect(places).toHaveLength(1);
    expect(places[0]?.place).toBe(1);
    expect(places[0]?.people[0]?.name).toBe("Cy");
  });
});

describe("studentLabel", () => {
  it("prefers the full name and falls back to the username", () => {
    expect(studentLabel({ username: "ada", full_name: " Ada Lovelace " })).toBe("Ada Lovelace");
    expect(studentLabel({ username: " ada ", full_name: "  " })).toBe("ada");
    expect(studentLabel({ username: null, full_name: null })).toBe("Student");
    expect(studentLabel(undefined)).toBe("Student");
  });
});

describe("recentMockRatings", () => {
  it("lists mocks that have a scored finish, newest first", () => {
    const titles = new Map([
      ["m1", "March"],
      ["m2", "June"],
    ]);
    const ratings = recentMockRatings(titles, [
      { mockId: "m1", userId: "a", score: 1200, completedAt: "2026-03-01T00:00:00Z" },
      { mockId: "m1", userId: "a", score: 1300, completedAt: "2026-03-02T00:00:00Z" },
      { mockId: "m2", userId: "b", score: null, completedAt: "2026-06-01T00:00:00Z" },
      { mockId: "m2", userId: "c", score: 1400, completedAt: "2026-06-02T00:00:00Z" },
      { mockId: "missing", userId: "a", score: 900, completedAt: "2026-01-01T00:00:00Z" },
    ]);
    expect(ratings.map((row) => row.title)).toEqual(["June", "March", "Full mock"]);
    expect(ratings[1]).toMatchObject({ finisherCount: 1, topScore: 1300 });
  });
});
