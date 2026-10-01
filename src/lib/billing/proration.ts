/**
 * Join-month charge. Mirrors SQL bs_join_month_charge:
 * fee x remaining / total lessons, rounded half-up to the nearest 1 000 UZS.
 * No lessons scheduled that month = full fee. Later months are always full price.
 */
export type JoinMonthCharge = {
  amount: bigint;
  /** Set only when the charge is a fraction of the fee. */
  lessons: { remaining: number; total: number } | null;
};

export function prorateJoinMonth(fee: bigint, remaining: number, total: number): JoinMonthCharge {
  if (fee <= 0n) return { amount: 0n, lessons: null };
  if (total <= 0) return { amount: fee, lessons: null };
  if (remaining <= 0) return { amount: 0n, lessons: null };
  if (remaining >= total) return { amount: fee, lessons: null };
  const numerator = fee * BigInt(remaining);
  const denominator = BigInt(total) * 1000n;
  const thousands = (numerator * 2n + denominator) / (denominator * 2n);
  return { amount: thousands * 1000n, lessons: { remaining, total } };
}
