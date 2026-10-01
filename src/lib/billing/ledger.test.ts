import { describe, expect, it } from "vitest";
import { txMethodOrPeriod, txSign, txType } from "./ledger";

describe("ledger labels", () => {
  it("names the transaction type", () => {
    expect(txType({ kind: "charge", source: "auto", prorate_lessons: null })).toBe("charge · auto");
    expect(txType({ kind: "charge", source: "auto", prorate_lessons: 5 })).toBe(
      "charge · prorated",
    );
    expect(txType({ kind: "payment", source: "manual", prorate_lessons: null })).toBe("payment");
  });

  it("signs charges and refunds negative", () => {
    expect(txSign({ kind: "charge" })).toBe("−");
    expect(txSign({ kind: "refund" })).toBe("−");
    expect(txSign({ kind: "discount" })).toBe("+");
  });

  it("shows the method, else the period", () => {
    expect(txMethodOrPeriod({ method: "transfer", period: null })).toBe("Bank transfer");
    expect(txMethodOrPeriod({ method: null, period: "2026-10-01" })).toBe("October 2026");
    expect(txMethodOrPeriod({ method: null, period: null })).toBe("—");
  });
});
