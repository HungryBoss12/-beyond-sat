import { supabase } from "@/integrations/supabase/client";
import { toUzs, uzsParam } from "./money";
import {
  uzsOrNull,
  type ActivationPreviewRow,
  type BalanceGroup,
  type BalanceRow,
  type BillingLimits,
  type GroupFeeRow,
  type LedgerRow,
  type PayMethod,
  type PaymentsSummary,
  type RecentEntry,
  type StudentBillingRow,
} from "./types";

// Billing RPCs ship ahead of regenerated Database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => any };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

async function call<T = Raw[]>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc.rpc(fn, args);
  if (error) throw new Error(error.message || "Request failed");
  return data as T;
}

function mapRecent(raw: unknown): RecentEntry[] {
  return ((raw ?? []) as Raw[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    amount_uzs: toUzs(r.amount_uzs),
    note: r.note ?? null,
    occurred_on: r.occurred_on,
    source: r.source,
  }));
}

function mapLedger(r: Raw): LedgerRow {
  return {
    id: r.id,
    user_id: r.user_id,
    kind: r.kind,
    amount_uzs: toUzs(r.amount_uzs),
    period: r.period ?? null,
    method: r.method ?? null,
    occurred_on: r.occurred_on,
    note: r.note ?? null,
    source: r.source,
    voided_at: r.voided_at ?? null,
    void_reason: r.void_reason ?? null,
    created_at: r.created_at,
    group_id: r.group_id ?? null,
    group_name: r.group_name ?? null,
    subject: r.subject ?? null,
    prorate_lessons: r.prorate_lessons ?? null,
    prorate_total: r.prorate_total ?? null,
  };
}

export type BalanceFilters = {
  search?: string;
  groupId?: string;
  classId?: string;
  status?: string;
  kind?: string;
  minBalance?: bigint | null;
  maxBalance?: bigint | null;
  month?: string;
  rank?: string;
  monthsInDebt?: number | null;
};

export async function listBalances(filters: BalanceFilters = {}): Promise<BalanceRow[]> {
  const rows = await call("admin_student_balances", {
    p_search: filters.search || null,
    p_group_id: filters.groupId || null,
    p_class_id: filters.classId || null,
    p_status: filters.status || null,
    p_kind: filters.kind || null,
    p_min_balance: filters.minBalance == null ? null : uzsParam(filters.minBalance),
    p_max_balance: filters.maxBalance == null ? null : uzsParam(filters.maxBalance),
    p_month: filters.month ? `${filters.month}-01` : null,
    p_rank: filters.rank || null,
    p_months_in_debt: filters.monthsInDebt ?? null,
  });
  return (rows ?? []).map((r) => ({
    user_id: r.user_id,
    full_name: r.full_name ?? null,
    username: r.username ?? null,
    phone: r.phone ?? null,
    class_id: r.class_id ?? null,
    class_name: r.class_name ?? null,
    status: r.status ?? null,
    groups: (r.groups ?? []) as BalanceGroup[],
    rw: r.rw ?? null,
    math: r.math ?? null,
    total_score: Number(r.total_score ?? 0),
    rank_letter: r.rank_letter,
    monthly_fee: uzsOrNull(r.monthly_fee),
    monthly_tuition: uzsOrNull(r.monthly_tuition),
    expected_this_month: uzsOrNull(r.expected_this_month),
    charged: toUzs(r.charged),
    paid: toUzs(r.paid),
    balance: toUzs(r.balance),
    last_payment_on: r.last_payment_on ?? null,
    months_in_debt: Number(r.months_in_debt ?? 0),
    recent: mapRecent(r.recent),
  }));
}

export async function paymentsSummary(): Promise<PaymentsSummary> {
  const rows = await call("admin_payments_summary");
  const r = rows?.[0] ?? {};
  return {
    total_owed: toUzs(r.total_owed),
    debtors: Number(r.debtors ?? 0),
    credits: toUzs(r.credits),
    creditors: Number(r.creditors ?? 0),
    settled: Number(r.settled ?? 0),
    priced_groups: Number(r.priced_groups ?? 0),
    active_groups: Number(r.active_groups ?? 0),
    min_fee: uzsOrNull(r.min_fee),
    max_fee: uzsOrNull(r.max_fee),
  };
}

export async function groupFees(): Promise<GroupFeeRow[]> {
  const rows = await call("admin_group_fees");
  return (rows ?? []).map((r) => ({
    group_id: r.group_id,
    class_id: r.class_id,
    class_name: r.class_name,
    group_name: r.group_name,
    subject: r.subject,
    active: Boolean(r.active),
    monthly_fee_uzs: uzsOrNull(r.monthly_fee_uzs),
    effective_from: r.effective_from ?? null,
  }));
}

export type ClassFeeRow = {
  class_id: string;
  class_name: string;
  active: boolean;
  monthly_fee_uzs: bigint | null;
  effective_from: string | null;
};

export async function classFees(): Promise<ClassFeeRow[]> {
  const rows = await call("admin_class_fees");
  return (rows ?? []).map((r) => ({
    class_id: r.class_id,
    class_name: r.class_name,
    active: Boolean(r.active),
    monthly_fee_uzs: uzsOrNull(r.monthly_fee_uzs),
    effective_from: r.effective_from ?? null,
  }));
}

/** `fee = null` makes the class unpriced from that month. One fee covers both sub-classes. */
export async function setClassFee(
  classId: string,
  fee: bigint | null,
  effectiveFrom?: string | null,
): Promise<void> {
  await call("admin_set_class_fee", {
    p_class_id: classId,
    p_fee_uzs: fee == null ? null : uzsParam(fee),
    p_effective_from: effectiveFrom ?? null,
  });
}

/** `fee = null` makes the group unpriced from that month. */
export async function setGroupFee(
  groupId: string,
  fee: bigint | null,
  effectiveFrom?: string | null,
): Promise<void> {
  await call("admin_set_group_fee", {
    p_group_id: groupId,
    p_fee_uzs: fee == null ? null : uzsParam(fee),
    p_effective_from: effectiveFrom ?? null,
  });
}

/** Per-student price for one class, or every class they are in when classId is omitted. */
export async function setStudentFee(
  userId: string,
  fee: bigint,
  effectiveFrom?: string | null,
  classId?: string | null,
): Promise<number> {
  const saved = await call<number>("admin_set_student_fee", {
    p_user_id: userId,
    p_class_id: classId ?? null,
    p_fee_uzs: uzsParam(fee),
    p_effective_from: effectiveFrom ?? null,
  });
  return Number(saved ?? 0);
}

export async function billingNote(userId: string): Promise<string> {
  const data = await call<string | null>("admin_billing_note", { p_user_id: userId });
  return data ?? "";
}

export async function setBillingNote(userId: string, note: string): Promise<void> {
  await call("admin_set_billing_note", { p_user_id: userId, p_note: note });
}

/** `fee = null` goes back to the group fee; `0n` makes the group free for this student. */
export async function setFeeOverride(
  userId: string,
  groupId: string,
  fee: bigint | null,
  effectiveFrom?: string | null,
): Promise<void> {
  await call("admin_set_fee_override", {
    p_user_id: userId,
    p_group_id: groupId,
    p_fee_uzs: fee == null ? null : uzsParam(fee),
    p_effective_from: effectiveFrom ?? null,
  });
}

export async function studentBilling(userId: string): Promise<StudentBillingRow[]> {
  const rows = await call("admin_student_billing", { p_user_id: userId });
  return (rows ?? []).map((r) => ({
    group_id: r.group_id,
    class_id: r.class_id,
    group_name: r.group_name,
    subject: r.subject,
    status: r.status,
    enrolled_on: r.enrolled_on,
    activated_on: r.activated_on ?? null,
    monthly_fee_uzs: uzsOrNull(r.monthly_fee_uzs),
    override_fee_uzs: uzsOrNull(r.override_fee_uzs),
    join_amount_uzs: uzsOrNull(r.join_amount_uzs),
    join_remaining: r.join_remaining ?? null,
    join_total: r.join_total ?? null,
    charged_uzs: toUzs(r.charged_uzs),
    charge_count: Number(r.charge_count ?? 0),
  }));
}

export async function studentLedger(userId: string): Promise<LedgerRow[]> {
  const rows = await call("admin_student_ledger", { p_user_id: userId });
  return (rows ?? []).map((r) => mapLedger({ ...r, user_id: userId }));
}

export async function previewActivationChange(
  userId: string,
  groupId: string,
  date: string,
): Promise<ActivationPreviewRow[]> {
  const rows = await call("admin_preview_activation_change", {
    p_user_id: userId,
    p_group_id: groupId,
    p_date: date,
  });
  return (rows ?? []).map((r) => ({
    id: r.id,
    period: r.period,
    amount_uzs: toUzs(r.amount_uzs),
    note: r.note ?? null,
  }));
}

/** Returns how many auto charges were voided before re-applying. */
export async function setActivationDate(
  userId: string,
  groupId: string,
  date: string,
): Promise<number> {
  const voided = await call<number>("admin_set_activation_date", {
    p_user_id: userId,
    p_group_id: groupId,
    p_date: date,
  });
  return Number(voided ?? 0);
}

export async function billingLimits(): Promise<BillingLimits> {
  const rows = await call("admin_billing_limits");
  const r = rows?.[0] ?? {};
  return {
    min_payment_uzs: toUzs(r.min_payment_uzs ?? 1000),
    max_payment_uzs: toUzs(r.max_payment_uzs ?? 100000000),
    confirm_over_uzs: toUzs(r.confirm_over_uzs ?? 10000000),
  };
}

export async function applyRecurringFees(): Promise<number> {
  const added = await call<number>("admin_apply_recurring_fees");
  return Number(added ?? 0);
}

/** Charges the month for every priced sub-class not yet charged. Returns rows added. */
export async function chargeMonth(userId: string, period: string): Promise<number> {
  const added = await call<number>("admin_charge_month", {
    p_user_id: userId,
    p_period: period,
  });
  return Number(added ?? 0);
}

export function isNoPricedGroupsError(error: unknown): boolean {
  return error instanceof Object && "message" in error
    ? String((error as { message: unknown }).message).includes("no_priced_groups")
    : false;
}

type EntryInput = {
  userId: string;
  amount: bigint;
  occurredOn: string;
  note: string;
  idempotencyKey: string;
};

export async function recordPayment(input: EntryInput & { method: PayMethod }): Promise<string> {
  return call<string>("admin_record_payment", {
    p_user_id: input.userId,
    p_amount_uzs: uzsParam(input.amount),
    p_method: input.method,
    p_occurred_on: input.occurredOn,
    p_note: input.note,
    p_idempotency_key: input.idempotencyKey,
  });
}

export async function recordDiscount(input: EntryInput): Promise<string> {
  return call<string>("admin_record_discount", {
    p_user_id: input.userId,
    p_amount_uzs: uzsParam(input.amount),
    p_occurred_on: input.occurredOn,
    p_note: input.note,
    p_idempotency_key: input.idempotencyKey,
  });
}

export async function recordRefund(input: EntryInput): Promise<string> {
  return call<string>("admin_record_refund", {
    p_user_id: input.userId,
    p_amount_uzs: uzsParam(input.amount),
    p_occurred_on: input.occurredOn,
    p_note: input.note,
    p_idempotency_key: input.idempotencyKey,
  });
}

export type StudentDiscount = {
  id: string;
  user_id: string;
  full_name: string | null;
  class_id: string;
  class_name: string;
  mode: "percent" | "amount";
  value: bigint;
  ends_on: string | null;
};

export type DiscountStudent = {
  user_id: string;
  full_name: string | null;
  class_id: string;
  class_name: string;
};

export async function listStudentDiscounts(): Promise<StudentDiscount[]> {
  const rows = await call("admin_list_student_discounts");
  return (rows ?? []).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    full_name: r.full_name ?? null,
    class_id: r.class_id,
    class_name: r.class_name,
    mode: r.mode === "percent" ? "percent" : "amount",
    value: toUzs(r.value),
    ends_on: r.ends_on ?? null,
  }));
}

export async function listDiscountStudents(): Promise<DiscountStudent[]> {
  const rows = await call("admin_discount_students");
  return (rows ?? []).map((r) => ({
    user_id: r.user_id,
    full_name: r.full_name ?? null,
    class_id: r.class_id,
    class_name: r.class_name,
  }));
}

export async function setStudentDiscount(input: {
  userId: string;
  classId: string;
  mode: "percent" | "amount";
  value: bigint;
  endsOn: string | null;
}): Promise<void> {
  await call("admin_set_student_discount", {
    p_user_id: input.userId,
    p_class_id: input.classId,
    p_mode: input.mode,
    p_value: uzsParam(input.value),
    p_ends_on: input.endsOn,
  });
}

export async function clearStudentDiscount(userId: string, classId: string): Promise<void> {
  await call("admin_clear_student_discount", { p_user_id: userId, p_class_id: classId });
}

export async function studentBillingHome(): Promise<{
  balance: bigint;
  recent: { id: string; kind: string; amount_uzs: bigint; note: string | null; occurred_on: string }[];
}> {
  const data = await call<Raw>("student_billing_home");
  return {
    balance: toUzs(data?.balance),
    recent: ((data?.recent ?? []) as Raw[]).map((r) => ({
      id: r.id,
      kind: r.kind,
      amount_uzs: toUzs(r.amount_uzs),
      note: r.note ?? null,
      occurred_on: r.occurred_on,
    })),
  };
}

export async function voidEntry(id: string, reason: string): Promise<void> {
  await call("admin_void_entry", { p_id: id, p_reason: reason });
}

/** Every ledger row across students, newest first (admin RLS). */
export async function listAllLedger(limit = 2000): Promise<LedgerRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as unknown as any;
  const { data, error } = await db
    .from("ledger_entries")
    .select(
      "id,user_id,kind,amount_uzs,period,method,occurred_on,note,source,voided_at,void_reason,created_at,group_id,prorate_lessons,prorate_total,class_groups(name,subject)",
    )
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Raw[]).map((r) =>
    mapLedger({ ...r, group_name: r.class_groups?.name, subject: r.class_groups?.subject }),
  );
}
