import type { ClassSubject, MemberStatus } from "@/lib/classes/types";
import { toUzs, type UzsLike } from "./money";

export type LedgerKind = "charge" | "payment" | "discount" | "refund";
export type PayMethod = "cash" | "card" | "transfer";
export type LedgerSource = "auto" | "manual";

export const PAY_METHOD_LABEL: Record<PayMethod, string> = {
  cash: "Cash",
  card: "Card",
  transfer: "Bank transfer",
};

export type BalanceGroup = {
  id: string;
  class_id?: string | null;
  name: string;
  subject: ClassSubject;
  status: MemberStatus;
  activated_on: string | null;
};

export type RecentEntry = {
  id: string;
  kind: LedgerKind;
  amount_uzs: bigint;
  note: string | null;
  occurred_on: string;
  source: LedgerSource;
};

export type BalanceRow = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  phone: string | null;
  class_id: string | null;
  class_name: string | null;
  status: MemberStatus | null;
  groups: BalanceGroup[];
  rw: number | null;
  math: number | null;
  total_score: number;
  rank_letter: "S" | "A" | "B" | "C" | "D";
  monthly_fee: bigint | null;
  /** One full class fee for this student, not one per class. */
  monthly_tuition: bigint | null;
  /** This month’s charge across every class, join month included. */
  expected_this_month: bigint | null;
  charged: bigint;
  paid: bigint;
  balance: bigint;
  last_payment_on: string | null;
  months_in_debt: number;
  recent: RecentEntry[];
};

export type LedgerRow = {
  id: string;
  user_id?: string;
  kind: LedgerKind;
  amount_uzs: bigint;
  period: string | null;
  method: PayMethod | null;
  occurred_on: string;
  note: string | null;
  source: LedgerSource;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
  group_id: string | null;
  group_name: string | null;
  subject: ClassSubject | null;
  prorate_lessons: number | null;
  prorate_total: number | null;
};

export type PaymentsSummary = {
  total_owed: bigint;
  debtors: number;
  credits: bigint;
  creditors: number;
  settled: number;
  priced_groups: number;
  active_groups: number;
  min_fee: bigint | null;
  max_fee: bigint | null;
};

export type GroupFeeRow = {
  group_id: string;
  class_id: string;
  class_name: string;
  group_name: string;
  subject: ClassSubject;
  active: boolean;
  monthly_fee_uzs: bigint | null;
  effective_from: string | null;
};

export type StudentBillingRow = {
  group_id: string;
  class_id: string;
  group_name: string;
  subject: ClassSubject;
  status: MemberStatus;
  enrolled_on: string;
  activated_on: string | null;
  monthly_fee_uzs: bigint | null;
  override_fee_uzs: bigint | null;
  join_amount_uzs: bigint | null;
  join_remaining: number | null;
  join_total: number | null;
  charged_uzs: bigint;
  charge_count: number;
};

export type ActivationPreviewRow = {
  id: string;
  period: string;
  amount_uzs: bigint;
  note: string | null;
};

export type BillingLimits = {
  min_payment_uzs: bigint;
  max_payment_uzs: bigint;
  confirm_over_uzs: bigint;
};

export function uzsOrNull(value: UzsLike | null | undefined): bigint | null {
  return value == null ? null : toUzs(value);
}
