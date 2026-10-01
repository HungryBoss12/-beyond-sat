import { describe, expect, it } from "vitest";
import {
  balanceKind,
  compactUzs,
  formatUzs,
  maskUzsInput,
  needsPaymentConfirm,
  parseUzsInput,
  toUzs,
} from "./money";

describe("money", () => {
  it("formats integer sums with spaces and no decimals", () => {
    expect(formatUzs(1200000)).toBe("1 200 000 UZS");
    expect(formatUzs(750000n)).toBe("750 000 UZS");
    expect(formatUzs(-1200000)).toBe("1 200 000 UZS");
    expect(formatUzs("999999999999")).toBe("999 999 999 999 UZS");
  });

  it("reads int8 from numbers and strings without floats", () => {
    expect(toUzs("232323232323232320000")).toBe(232323232323232320000n);
    expect(toUzs(-450000)).toBe(-450000n);
    expect(toUzs("12.5")).toBe(0n);
    expect(toUzs(null)).toBe(0n);
  });

  it("parses spaced digits and rejects notation", () => {
    expect(parseUzsInput("750 000")).toBe(750000n);
    expect(parseUzsInput("1 200 000")).toBe(1200000n);
    expect(parseUzsInput("1,2e6")).toBeNull();
    expect(parseUzsInput("12.5")).toBeNull();
    expect(parseUzsInput("-5")).toBeNull();
    expect(parseUzsInput("0")).toBeNull();
    expect(parseUzsInput("")).toBeNull();
  });

  it("caps at the configured maximum", () => {
    expect(parseUzsInput("100 000 000")).toBe(100000000n);
    expect(parseUzsInput("100 000 001")).toBeNull();
    expect(parseUzsInput("232323232323")).toBeNull();
    expect(parseUzsInput("5 000", 4000n)).toBeNull();
  });

  it("masks typing to grouped digits", () => {
    expect(maskUzsInput("1200000")).toBe("1 200 000");
    expect(maskUzsInput("1e6,5.-")).toBe("165");
    expect(maskUzsInput("")).toBe("");
  });

  it("compacts large amounts for tiles", () => {
    expect(compactUzs(1200000)).toBe("1.2 mln UZS");
    expect(compactUzs(1000000)).toBe("1 mln UZS");
    expect(compactUzs(450000)).toBe("450 000 UZS");
    expect(compactUzs("999999999999")).toBe("1 trln UZS");
    expect(compactUzs(-2550000000n)).toBe("2.6 mlrd UZS");
  });

  it("labels the balance kind", () => {
    expect(balanceKind(-1)).toBe("debt");
    expect(balanceKind("0")).toBe("settled");
    expect(balanceKind(5n)).toBe("credit");
  });

  it("asks for a confirm on large or outsized payments", () => {
    expect(needsPaymentConfirm(15000000n, -20000000)).toBe(true);
    expect(needsPaymentConfirm(9000000n, -1000000)).toBe(true);
    expect(needsPaymentConfirm(3000000n, -1000000)).toBe(false);
    expect(needsPaymentConfirm(500000n, 0)).toBe(false);
  });
});
