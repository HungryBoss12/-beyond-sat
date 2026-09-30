/** Integer UZS. Never use floats. */

export function formatUzs(value: number | bigint): string {
  const n = typeof value === "bigint" ? value : BigInt(Math.trunc(value));
  const abs = n < 0n ? -n : n;
  const digits = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${digits} UZS`;
}

/** Digits and spaces only. Rejects commas, decimals, and scientific notation. */
export function parseUzsInput(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  if (!/^\d[\d ]*$/.test(text)) return null;
  const digits = text.replace(/ /g, "");
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length > 12) return null;
  const n = Number(digits);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return n;
}
