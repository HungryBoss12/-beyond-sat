import { describe, expect, it } from "vitest";
import { gridValuesMatch, parseGridNumber, sanitizeGridInput } from "./grid-answer";

describe("gridValuesMatch", () => {
  it("accepts exact strings and equivalent decimals", () => {
    expect(gridValuesMatch("3/10", "3/10")).toBe(true);
    expect(gridValuesMatch("0.3", ".3")).toBe(true);
    expect(gridValuesMatch("1.0588", "18/17")).toBe(true);
  });

  it("accepts SAT 4-decimal round or truncate for 1/3", () => {
    expect(gridValuesMatch(".333", "1/3")).toBe(true);
    expect(gridValuesMatch(".3333", "1/3")).toBe(true);
    expect(gridValuesMatch("0.333", "1/3")).toBe(true);
    expect(gridValuesMatch(".33", "1/3")).toBe(false);
    expect(gridValuesMatch(".3334", "1/3")).toBe(false);
  });

  it("accepts round or truncate for 2/3", () => {
    expect(gridValuesMatch(".666", "2/3")).toBe(true);
    expect(gridValuesMatch(".667", "2/3")).toBe(true);
    expect(gridValuesMatch(".6666", "2/3")).toBe(true);
    expect(gridValuesMatch(".6667", "2/3")).toBe(true);
  });
});

describe("parseGridNumber", () => {
  it("parses fractions and decimals", () => {
    expect(parseGridNumber("1/3")).toBeCloseTo(1 / 3);
    expect(parseGridNumber(".5")).toBe(0.5);
    expect(parseGridNumber("")).toBeNull();
  });
});

describe("sanitizeGridInput", () => {
  it("caps positive answers at 5 characters", () => {
    expect(sanitizeGridInput("123456")).toBe("12345");
    expect(sanitizeGridInput("-123456")).toBe("-12345");
  });

  it("strips symbols the grid does not allow", () => {
    expect(sanitizeGridInput("$1,200%")).toBe("1200");
  });
});
