export type LedgerKind = "charge" | "payment" | "discount" | "refund";
export type PayMethod = "cash" | "card" | "transfer";
export type LedgerSource = "auto" | "manual";

export type BalanceRow = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  phone: string | null;
  class_id: string;
  class_name: string;
  status: "active" | "trial" | "frozen" | "left";
  rw: number | null;
  math: number | null;
  total_score: number;
  rank_letter: "S" | "A" | "B" | "C" | "D";
  monthly_fee: number | null;
  charged: number;
  paid: number;
  balance: number;
  last_payment_on: string | null;
  months_in_debt: number;
};

export type LedgerRow = {
  id: string;
  user_id?: string;
  kind: LedgerKind;
  amount_uzs: number | string;
  period: string | null;
  method: PayMethod | null;
  occurred_on: string;
  note: string | null;
  source: LedgerSource;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
};

export function asInt(value: number | string | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return Math.trunc(value);
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}
