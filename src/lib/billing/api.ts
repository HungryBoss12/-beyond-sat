import { supabase } from "@/integrations/supabase/client";
import type { BalanceRow, LedgerRow, PayMethod } from "./types";

// New billing RPCs ship ahead of regenerated Database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => any };

export async function listBalances(filters: {
  search?: string;
  classId?: string;
  status?: string;
  kind?: string;
  minBalance?: number | null;
  maxBalance?: number | null;
  month?: string;
  rank?: string;
  monthsInDebt?: number | null;
}): Promise<BalanceRow[]> {
  const { data, error } = await rpc.rpc("admin_student_balances", {
    p_search: filters.search || null,
    p_class_id: filters.classId || null,
    p_status: filters.status || null,
    p_kind: filters.kind || null,
    p_min_balance: filters.minBalance ?? null,
    p_max_balance: filters.maxBalance ?? null,
    p_month: filters.month ? `${filters.month}-01` : null,
    p_rank: filters.rank || null,
    p_months_in_debt: filters.monthsInDebt ?? null,
  });
  if (error) throw error;
  return (data ?? []) as BalanceRow[];
}

export async function studentLedger(userId: string): Promise<LedgerRow[]> {
  const { data, error } = await rpc.rpc("admin_student_ledger", { p_user_id: userId });
  if (error) throw error;
  return (data ?? []) as LedgerRow[];
}

export async function setMonthlyFee(
  userId: string,
  fee: number,
  effectiveFrom: string,
): Promise<void> {
  const { error } = await rpc.rpc("admin_set_monthly_fee", {
    p_user_id: userId,
    p_fee_uzs: fee,
    p_effective_from: effectiveFrom,
  });
  if (error) throw error;
}

export async function applyRecurringFees(): Promise<number> {
  const { data, error } = await rpc.rpc("admin_apply_recurring_fees");
  if (error) throw error;
  return Number(data ?? 0);
}

export async function chargeMonth(userId: string, period: string): Promise<void> {
  const { error } = await rpc.rpc("admin_charge_month", {
    p_user_id: userId,
    p_period: period,
  });
  if (error) throw error;
}

export async function recordPayment(input: {
  userId: string;
  amount: number;
  method: PayMethod;
  occurredOn: string;
  note: string;
  idempotencyKey: string;
}): Promise<void> {
  const { error } = await rpc.rpc("admin_record_payment", {
    p_user_id: input.userId,
    p_amount_uzs: input.amount,
    p_method: input.method,
    p_occurred_on: input.occurredOn,
    p_note: input.note,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw error;
}

export async function recordDiscount(input: {
  userId: string;
  amount: number;
  occurredOn: string;
  note: string;
  idempotencyKey: string;
}): Promise<void> {
  const { error } = await rpc.rpc("admin_record_discount", {
    p_user_id: input.userId,
    p_amount_uzs: input.amount,
    p_occurred_on: input.occurredOn,
    p_note: input.note,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw error;
}

export async function voidEntry(id: string, reason: string): Promise<void> {
  const { error } = await rpc.rpc("admin_void_entry", { p_id: id, p_reason: reason });
  if (error) throw error;
}
