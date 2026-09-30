import { describe, expect, it } from "vitest";
import { formatUzs, parseUzsInput } from "./money";

describe("money", () => {
  it("formats integer sums with spaces and no decimals", () => {
    expect(formatUzs(1200000)).toBe("1 200 000 UZS");
    expect(formatUzs(750000n)).toBe("750 000 UZS");
    expect(formatUzs(-1200000)).toBe("1 200 000 UZS");
  });

  it("parses spaced digits and rejects notation", () => {
    expect(parseUzsInput("750 000")).toBe(750000);
    expect(parseUzsInput("1 200 000")).toBe(1200000);
    expect(parseUzsInput("1,2e6")).toBeNull();
    expect(parseUzsInput("12.5")).toBeNull();
    expect(parseUzsInput("")).toBeNull();
  });
});
