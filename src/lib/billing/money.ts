/** Integer UZS as bigint. Supabase may send int8 as a number or a string; never use floats. */

export type UzsLike = bigint | number | string;

export const UZS_MIN_PAYMENT = 1_000n;
export const UZS_DEFAULT_MAX_PAYMENT = 100_000_000n;
export const UZS_CONFIRM_OVER = 10_000_000n;

export function toUzs(value: UzsLike | null | undefined): bigint {
  if (value == null) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0n;
    return BigInt(Math.trunc(value));
  }
  const text = value.trim();
  return /^-?\d+$/.test(text) ? BigInt(text) : 0n;
}

export function absUzs(value: UzsLike | null | undefined): bigint {
  const n = toUzs(value);
  return n < 0n ? -n : n;
}

export function groupDigits(value: UzsLike): string {
  return absUzs(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** "1 200 000 UZS". The sign is dropped; show debt/credit with a word next to it. */
export function formatUzs(value: UzsLike | null | undefined): string {
  return `${groupDigits(value ?? 0n)} UZS`;
}

const COMPACT_UNITS: [bigint, string][] = [
  [1_000_000_000_000n, "trln"],
  [1_000_000_000n, "mlrd"],
  [1_000_000n, "mln"],
];

/** "1.2 mln UZS" for tight tiles; below a million it is the full amount. */
export function compactUzs(value: UzsLike | null | undefined): string {
  const n = absUzs(value);
  let i = COMPACT_UNITS.findIndex(([unit]) => n >= unit);
  if (i < 0) return formatUzs(n);
  let tenths = (n * 10n + COMPACT_UNITS[i][0] / 2n) / COMPACT_UNITS[i][0];
  if (tenths >= 10_000n && i > 0) {
    i -= 1;
    tenths = (n * 10n + COMPACT_UNITS[i][0] / 2n) / COMPACT_UNITS[i][0];
  }
  const whole = tenths / 10n;
  const frac = tenths % 10n;
  const shown = frac === 0n ? groupDigits(whole) : `${groupDigits(whole)}.${frac}`;
  return `${shown} ${COMPACT_UNITS[i][1]} UZS`;
}

/** Digits and spaces only, above zero and at most `max`. Rejects ",", ".", "e", "-". */
export function parseUzsInput(raw: string, max: bigint = UZS_DEFAULT_MAX_PAYMENT): bigint | null {
  const text = raw.trim();
  if (!/^\d[\d ]*$/.test(text)) return null;
  const digits = text.replace(/ /g, "").replace(/^0+(?=\d)/, "");
  if (digits.length > 13) return null;
  const n = BigInt(digits);
  if (n <= 0n || n > max) return null;
  return n;
}

export type UzsCheck = { amount: bigint | null; error: string | null };

/** Inline validation for a money field: empty is "no value", everything else must be in range. */
export function checkUzsInput(
  raw: string,
  min: bigint = UZS_MIN_PAYMENT,
  max: bigint = UZS_DEFAULT_MAX_PAYMENT,
): UzsCheck {
  const text = raw.trim();
  if (!text) return { amount: null, error: null };
  if (!/^\d[\d ]*$/.test(text)) return { amount: null, error: "Digits only" };
  const digits = text.replace(/ /g, "");
  if (digits.length > 13) return { amount: null, error: `At most ${groupDigits(max)} UZS` };
  const n = BigInt(digits);
  if (n < min) return { amount: null, error: `At least ${groupDigits(min)} UZS` };
  if (n > max) return { amount: null, error: `At most ${groupDigits(max)} UZS` };
  return { amount: n, error: null };
}

/** Keeps only digits and regroups them for display while typing. */
export function maskUzsInput(raw: string): string {
  const digits = raw
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "")
    .slice(0, 13);
  return digits ? groupDigits(BigInt(digits)) : "";
}

export type BalanceKind = "debt" | "credit" | "settled";

export function balanceKind(balance: UzsLike | null | undefined): BalanceKind {
  const n = toUzs(balance);
  if (n < 0n) return "debt";
  if (n > 0n) return "credit";
  return "settled";
}

/** Large payments, or more than three times the debt, need a second confirmation. */
export function needsPaymentConfirm(
  amount: bigint,
  balance: UzsLike | null | undefined,
  threshold: bigint = UZS_CONFIRM_OVER,
): boolean {
  if (amount >= threshold) return true;
  const bal = toUzs(balance);
  return bal < 0n && amount > -bal * 3n;
}

/** Postgres int8 over JSON: send as a decimal string so nothing rounds. */
export function uzsParam(value: bigint): string {
  return value.toString();
}
