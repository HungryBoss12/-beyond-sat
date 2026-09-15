/** SAT student-produced (grid-in) answer matching and input limits. */

const POSITIVE_MAX = 5;
const NEGATIVE_MAX = 6;

export function parseGridNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const t = raw.trim().replace(/,/g, "");
  if (!t) return null;
  const slash = t.indexOf("/");
  if (slash > 0) {
    const n = Number(t.slice(0, slash).trim());
    const d = Number(t.slice(slash + 1).trim());
    if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
    return n / d;
  }
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

function decimalPlacesEntered(raw: string): number {
  const t = raw.trim();
  const m = t.match(/\.(\d+)/);
  return m ? m[1].length : 0;
}

function truncToPlaces(n: number, places: number): number {
  const sign = n < 0 ? -1 : 1;
  const raw = Math.abs(n).toFixed(12);
  const [whole, frac = ""] = raw.split(".");
  return sign * Number(`${whole}.${frac.slice(0, places)}`);
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}

/**
 * College Board: if the value doesn't fit, round or truncate at the fourth
 * decimal. `.333` and `.3333` both match `1/3`; `.33` and `.3334` do not.
 */
export function gridValuesMatch(given: string, key: string): boolean {
  if (given.trim().toLowerCase() === key.trim().toLowerCase()) return true;
  const g = parseGridNumber(given);
  const k = parseGridNumber(key);
  if (g == null || k == null) return false;
  if (nearlyEqual(g, k)) return true;
  const places = decimalPlacesEntered(given);
  if (places < 3 || places > 4) return false;
  if (nearlyEqual(g, Number(k.toFixed(places)))) return true;
  if (nearlyEqual(g, truncToPlaces(k, places))) return true;
  return false;
}

export function gridAnswersMatch(given: string, keys: string[] | null | undefined): boolean {
  if (!keys?.length) return false;
  return keys.some((key) => gridValuesMatch(given, key));
}

/** Keep only SAT grid characters and the official 5/6 character cap. */
export function sanitizeGridInput(raw: string): string {
  let s = raw.replace(/[^0-9./-]/g, "");
  if (s.includes("-")) {
    const neg = s.startsWith("-");
    s = (neg ? "-" : "") + s.replace(/-/g, "");
  }
  const firstSlash = s.indexOf("/");
  if (firstSlash >= 0) {
    s = s.slice(0, firstSlash + 1) + s.slice(firstSlash + 1).replace(/\//g, "");
  }
  const firstDot = s.indexOf(".");
  if (firstDot >= 0) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }
  const max = s.startsWith("-") ? NEGATIVE_MAX : POSITIVE_MAX;
  return s.slice(0, max);
}
