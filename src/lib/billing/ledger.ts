import { periodLabel } from "./dates";
import { PAY_METHOD_LABEL, type LedgerRow } from "./types";

/** "charge · auto", "charge · prorated", "payment". */
export function txType(row: Pick<LedgerRow, "kind" | "source" | "prorate_lessons">): string {
  if (row.kind !== "charge") return row.kind;
  if (row.prorate_lessons != null) return "charge · prorated";
  return `charge · ${row.source}`;
}

/** Charges and refunds take money from the balance. */
export function txSign(row: Pick<LedgerRow, "kind">): "−" | "+" {
  return row.kind === "charge" || row.kind === "refund" ? "−" : "+";
}

export function txMethodOrPeriod(row: Pick<LedgerRow, "method" | "period">): string {
  if (row.method) return PAY_METHOD_LABEL[row.method];
  if (row.period) return periodLabel(row.period);
  return "—";
}
