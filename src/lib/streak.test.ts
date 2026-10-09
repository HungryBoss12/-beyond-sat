import { describe, expect, it } from "vitest";
import { liveStreak, tashkentDayOffset } from "./streak";

const now = new Date("2026-10-09T15:00:00Z"); // 20:00 in Tashkent

describe("liveStreak", () => {
  it("keeps the streak when the last activity was yesterday", () => {
    expect(liveStreak({ current_streak: 4, last_active_at: "2026-10-08T10:00:00Z" }, now)).toBe(4);
  });

  it("drops to 0 when the last activity was three days ago", () => {
    expect(liveStreak({ current_streak: 4, last_active_at: "2026-10-06T10:00:00Z" }, now)).toBe(0);
  });

  it("uses the later of vocab activity and the daily test", () => {
    expect(
      liveStreak(
        { current_streak: 2, last_active_at: "2026-10-01T10:00:00Z", last_daily_completed_date: "2026-10-09" },
        now,
      ),
    ).toBe(2);
  });

  it("counts a 01:00 Tashkent review as that Tashkent day", () => {
    const early = new Date("2026-10-09T20:30:00Z"); // 01:30 on Oct 10 in Tashkent
    expect(tashkentDayOffset(0, early)).toBe("2026-10-10");
    expect(liveStreak({ current_streak: 3, last_active_at: "2026-10-08T21:00:00Z" }, early)).toBe(3);
  });
});
