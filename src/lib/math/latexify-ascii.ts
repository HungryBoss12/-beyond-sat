/**
 * Convert common plain-text / Unicode math into `$…$` LaTeX for KaTeX.
 * Leaves existing `$…$` / `$$…$$` / `\(...\)` / `\[…\]` segments untouched.
 *
 * Intentionally conservative: only clear fraction / radical / function /
 * Unicode / whole-line equation forms — not arbitrary "word = number" prose.
 */

const MATH_SEG =
  /(\$\$[\s\S]+?\$\$)|(\\\[[\s\S]+?\\\])|(\$[^\n$]+?\$)|(\\\([\s\S]+?\\\))/g;

const SUPER: Record<string, string> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
};

const UNICODE_FRAC: Record<string, string> = {
  "½": "\\frac{1}{2}",
  "⅓": "\\frac{1}{3}",
  "⅔": "\\frac{2}{3}",
  "¼": "\\frac{1}{4}",
  "¾": "\\frac{3}{4}",
  "⅕": "\\frac{1}{5}",
  "⅙": "\\frac{1}{6}",
  "⅛": "\\frac{1}{8}",
};

function wrapMath(tex: string): string {
  const t = tex.trim();
  if (!t) return tex;
  if (t.startsWith("$")) return t;
  return `$${t}$`;
}

function latexifyProse(segment: string): string {
  let s = segment;

  // Unicode vulgar fractions
  s = s.replace(/[½⅓⅔¼¾⅕⅙⅛]/g, (ch) => wrapMath(UNICODE_FRAC[ch] ?? ch));

  // Units with Unicode superscripts: cm², m³
  s = s.replace(
    /([a-zA-Z]{1,4})([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g,
    (_m, unit: string, supers: string) => {
      const exp = [...supers].map((c) => SUPER[c] ?? c).join("");
      return wrapMath(`\\mathrm{${unit}}^{${exp}}`);
    },
  );

  // Trailing Unicode superscripts after digit or ): )², 9²
  s = s.replace(
    /([0-9)])([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g,
    (_m, base: string, supers: string) => {
      const exp = [...supers].map((c) => SUPER[c] ?? c).join("");
      return wrapMath(`${base}^{${exp}}`);
    },
  );

  // √(expr) and √x / sqrt(...)
  s = s.replace(/√\s*\(([^)]+)\)/g, (_m, inner: string) =>
    wrapMath(`\\sqrt{${inner.trim()}}`),
  );
  s = s.replace(/√\s*([A-Za-z0-9]+)/g, (_m, inner: string) =>
    wrapMath(`\\sqrt{${inner}}`),
  );
  s = s.replace(/\bsqrt\s*\(([^)]+)\)/gi, (_m, inner: string) =>
    wrapMath(`\\sqrt{${inner.trim()}}`),
  );

  // (4/7) numeric
  s = s.replace(/\((\d+)\s*\/\s*(\d+)\)/g, (_m, a: string, b: string) =>
    wrapMath(`\\frac{${a}}{${b}}`),
  );

  // num/(den): a/(bn), -w/(161x)
  s = s.replace(
    /(-?(?:\d+[a-zA-Z]+|\d+|[a-zA-Z]+))\s*\/\s*\(([^)]+)\)/g,
    (_m, num: string, den: string) => wrapMath(`\\frac{${num}}{${den}}`),
  );

  // 2a/b, 1/n — require a digit somewhere OR single-letter vars (avoid Title/Title)
  s = s.replace(
    /(-?(?:\d+[a-zA-Z]+|\d+|[a-zA-Z]))\s*\/\s*(-?(?:\d+[a-zA-Z]+|\d+|[a-zA-Z]+))(?![a-zA-Z0-9(])/g,
    (full, num: string, den: string) => {
      const n = num.replace(/^-/, "");
      const d = den.replace(/^-/, "");
      if (/^(and|or|his|her|he|she)$/i.test(n) || /^(or|her|she)$/i.test(d)) {
        return full;
      }
      // Skip multi-letter all-alpha / all-alpha (Aubrey/Maturin, north/south)
      if (/^[A-Za-z]{2,}$/.test(n) && /^[A-Za-z]{2,}$/.test(d)) return full;
      return wrapMath(`\\frac{${num}}{${den}}`);
    },
  );

  // sin/cos/tan/log/ln
  s = s.replace(
    /\b(sin|cos|tan|log|ln)\s*\(\s*([A-Za-z0-9]+)\s*\)/gi,
    (_m, fn: string, arg: string) => wrapMath(`\\${fn.toLowerCase()}(${arg})`),
  );
  // f(20), g(x), h(0) — single letter function
  s = s.replace(
    /\b([fgh])\s*\(\s*([A-Za-z0-9]+)\s*\)/g,
    (_m, fn: string, arg: string) => wrapMath(`${fn}(${arg})`),
  );

  s = s.replace(/\$\s*\$/g, " ");

  // Whole-line equations / systems only (choices like "2x - 8y = 5")
  s = s
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t || /\$/.test(t)) return line;
      const isEq =
        /^[0-9a-zA-Z(+\-][0-9a-zA-Z+\-*/^().\s]*=\s*[0-9a-zA-Z(+\-][0-9a-zA-Z+\-*/^().\s]*$/.test(
          t,
        );
      if (!isEq) return line;
      if (!/[a-zA-Z]/.test(t) || !/\d/.test(t)) return line;
      // Must look like algebra, not a sentence
      if (/\b(the|and|for|with|from|that|which|could|would|when)\b/i.test(t)) {
        return line;
      }
      // Require an operator or coeff·var pattern (2x, -8y)
      if (!/[+\-]/.test(t) && !/\d[a-zA-Z]/.test(t) && !/[a-zA-Z]\d/.test(t)) {
        return line;
      }
      return wrapMath(t);
    })
    .join("\n");

  // Inline algebra with at least one +/− on the left: 20x + 24 = 28x, 2x + 3 = 9
  s = s.replace(
    /(?<!\$)\b(\d+[a-zA-Z](?:\s*[+\-]\s*(?:\d+[a-zA-Z]|\d+))+\s*=\s*-?(?:\d+[a-zA-Z]|\d+)(?:\s*[+\-]\s*(?:\d+[a-zA-Z]|\d+))*)/g,
    (expr) => wrapMath(expr),
  );

  // Simple: -9(15 - 3x) + 5 = -10(15 - 3x) + 21
  s = s.replace(
    /(?<!\$)(-?\d+\([^)]+\)(?:\s*[+\-]\s*\d+)*\s*=\s*-?\d+\([^)]+\)(?:\s*[+\-]\s*\d+)*)/g,
    (expr) => wrapMath(expr),
  );

  // Pull trailing `= number` into a frac we just wrapped: $\frac{2a}{b}$ = 5.8
  s = s.replace(
    /\$(\\frac\{[^$]+\}\{[^$]+\})\$\s*=\s*(-?\d+(?:\.\d+)?)/g,
    (_m, frac: string, n: string) => wrapMath(`${frac} = ${n}`),
  );

  // v = $\frac{...}$  →  $v = \frac{...}$
  s = s.replace(
    /\b([a-zA-Z])\s*=\s*\$([^$]+)\$/g,
    (_m, v: string, tex: string) => wrapMath(`${v} = ${tex}`),
  );

  return s;
}

/** Latexify plain / Unicode math in prose; preserve existing TeX delimiters. */
export function latexifyAsciiMath(input: string): string {
  if (!input) return input;

  const parts: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(MATH_SEG.source, MATH_SEG.flags);
  while ((m = re.exec(input))) {
    if (m.index > last) parts.push(latexifyProse(input.slice(last, m.index)));
    parts.push(m[0]);
    last = m.index + m[0].length;
  }
  if (last < input.length) parts.push(latexifyProse(input.slice(last)));
  return parts.join("");
}
