import { describe, expect, it } from "vitest";
import { monthStart, periodLabel, tashkentToday } from "./dates";
import { toCsv } from "./csv";

describe("billing dates", () => {
  it("uses the Tashkent calendar day", () => {
    expect(tashkentToday(new Date("2026-09-30T20:30:00Z"))).toBe("2026-10-01");
    expect(tashkentToday(new Date("2026-09-30T18:00:00Z"))).toBe("2026-09-30");
  });

  it("labels periods and month starts", () => {
    expect(periodLabel("2026-10-01")).toBe("October 2026");
    expect(periodLabel(null)).toBe("—");
    expect(monthStart("2026-10-17")).toBe("2026-10-01");
  });
});

describe("csv", () => {
  it("quotes only the fields that need it", () => {
    expect(
      toCsv([
        ["a", 'say "hi"', "x,y"],
        [1, 2n, null],
      ]),
    ).toBe('a,"say ""hi""","x,y"\r\n1,2,');
  });
});
