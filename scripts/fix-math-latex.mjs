/**
 * Persist latexifyAsciiMath fixes onto math questions in Supabase.
 * Usage: node scripts/fix-math-latex.mjs [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const MATH_SEG =
  /(\$\$[\s\S]+?\$\$)|(\\\[[\s\S]+?\\\])|(\$[^\n$]+?\$)|(\\\([\s\S]+?\\\))/g;

const SUPER = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
};
const UNICODE_FRAC = {
  "½": "\\frac{1}{2}", "⅓": "\\frac{1}{3}", "⅔": "\\frac{2}{3}",
  "¼": "\\frac{1}{4}", "¾": "\\frac{3}{4}", "⅕": "\\frac{1}{5}",
  "⅙": "\\frac{1}{6}", "⅛": "\\frac{1}{8}",
};

function wrapMath(tex) {
  const t = tex.trim();
  if (!t) return tex;
  if (t.startsWith("$")) return t;
  return `$${t}$`;
}

function latexifyProse(segment) {
  let s = segment;
  s = s.replace(/[½⅓⅔¼¾⅕⅙⅛]/g, (ch) => wrapMath(UNICODE_FRAC[ch] ?? ch));
  s = s.replace(/([a-zA-Z]{1,4})([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_m, unit, supers) => {
    const exp = [...supers].map((c) => SUPER[c] ?? c).join("");
    return wrapMath(`\\mathrm{${unit}}^{${exp}}`);
  });
  s = s.replace(/([0-9)])([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_m, base, supers) => {
    const exp = [...supers].map((c) => SUPER[c] ?? c).join("");
    return wrapMath(`${base}^{${exp}}`);
  });
  s = s.replace(/√\s*\(([^)]+)\)/g, (_m, inner) => wrapMath(`\\sqrt{${inner.trim()}}`));
  s = s.replace(/√\s*([A-Za-z0-9]+)/g, (_m, inner) => wrapMath(`\\sqrt{${inner}}`));
  s = s.replace(/\bsqrt\s*\(([^)]+)\)/gi, (_m, inner) => wrapMath(`\\sqrt{${inner.trim()}}`));
  s = s.replace(/\((\d+)\s*\/\s*(\d+)\)/g, (_m, a, b) => wrapMath(`\\frac{${a}}{${b}}`));
  s = s.replace(
    /(-?(?:\d+[a-zA-Z]+|\d+|[a-zA-Z]+))\s*\/\s*\(([^)]+)\)/g,
    (_m, num, den) => wrapMath(`\\frac{${num}}{${den}}`),
  );
  s = s.replace(
    /(-?(?:\d+[a-zA-Z]+|\d+|[a-zA-Z]))\s*\/\s*(-?(?:\d+[a-zA-Z]+|\d+|[a-zA-Z]+))(?![a-zA-Z0-9(])/g,
    (full, num, den) => {
      const n = num.replace(/^-/, "");
      const d = den.replace(/^-/, "");
      if (/^(and|or|his|her|he|she)$/i.test(n) || /^(or|her|she)$/i.test(d)) return full;
      if (/^[A-Za-z]{2,}$/.test(n) && /^[A-Za-z]{2,}$/.test(d)) return full;
      return wrapMath(`\\frac{${num}}{${den}}`);
    },
  );
  s = s.replace(
    /\b(sin|cos|tan|log|ln)\s*\(\s*([A-Za-z0-9]+)\s*\)/gi,
    (_m, fn, arg) => wrapMath(`\\${fn.toLowerCase()}(${arg})`),
  );
  s = s.replace(/\b([fgh])\s*\(\s*([A-Za-z0-9]+)\s*\)/g, (_m, fn, arg) =>
    wrapMath(`${fn}(${arg})`),
  );
  s = s.replace(/\$\s*\$/g, " ");
  s = s
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t || /\$/.test(t)) return line;
      const isEq =
        /^[0-9a-zA-Z(+\-][0-9a-zA-Z+\-*/^().\s]*=\s*[0-9a-zA-Z(+\-][0-9a-zA-Z+\-*/^().\s]*$/.test(t);
      if (!isEq) return line;
      if (!/[a-zA-Z]/.test(t) || !/\d/.test(t)) return line;
      if (/\b(the|and|for|with|from|that|which|could|would|when)\b/i.test(t)) return line;
      if (!/[+\-]/.test(t) && !/\d[a-zA-Z]/.test(t) && !/[a-zA-Z]\d/.test(t)) return line;
      return wrapMath(t);
    })
    .join("\n");
  s = s.replace(
    /(?<!\$)\b(\d+[a-zA-Z](?:\s*[+\-]\s*(?:\d+[a-zA-Z]|\d+))+\s*=\s*-?(?:\d+[a-zA-Z]|\d+)(?:\s*[+\-]\s*(?:\d+[a-zA-Z]|\d+))*)/g,
    (expr) => wrapMath(expr),
  );
  s = s.replace(
    /(?<!\$)(-?\d+\([^)]+\)(?:\s*[+\-]\s*\d+)*\s*=\s*-?\d+\([^)]+\)(?:\s*[+\-]\s*\d+)*)/g,
    (expr) => wrapMath(expr),
  );
  s = s.replace(
    /\$(\\frac\{[^$]+\}\{[^$]+\})\$\s*=\s*(-?\d+(?:\.\d+)?)/g,
    (_m, frac, n) => wrapMath(`${frac} = ${n}`),
  );
  s = s.replace(/\b([a-zA-Z])\s*=\s*\$([^$]+)\$/g, (_m, v, tex) =>
    wrapMath(`${v} = ${tex}`),
  );
  return s;
}

export function latexifyAsciiMath(input) {
  if (!input) return input;
  const parts = [];
  let last = 0;
  let m;
  const re = new RegExp(MATH_SEG.source, MATH_SEG.flags);
  while ((m = re.exec(input))) {
    if (m.index > last) parts.push(latexifyProse(input.slice(last, m.index)));
    parts.push(m[0]);
    last = m.index + m[0].length;
  }
  if (last < input.length) parts.push(latexifyProse(input.slice(last)));
  return parts.join("");
}

const dry = process.argv.includes("--dry-run");
const checkOnly = process.argv.includes("--check");

if (checkOnly) {
  const cases = [
    "If 2a/b = 5.8 and a/(bn) = 23.2, what is the value of 1/n?",
    "What is the value of 1/n?",
    "v = -w/(161x)",
    "What is the value of f(20)?",
    "20x + 24 = 28x",
    "QR = 16 and TU = 12",
    "1 mile = 1,609 meters",
    "yes and/or no",
    "area in cm²",
    "f(x) = 8 + √x",
    "2x - 8y = 5",
    "selling price of $15",
    "w = -161v/x",
  ];
  for (const c of cases) {
    console.log("IN ", c);
    console.log("OUT", latexifyAsciiMath(c));
    console.log("");
  }
  process.exit(0);
}

const env = Object.fromEntries(
  fs
    .readFileSync(".dev.vars", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

function fixText(t) {
  if (!t || typeof t !== "string") return t;
  const next = latexifyAsciiMath(t);
  return next === t ? null : next;
}

let from = 0;
let scanned = 0;
let updated = 0;
const examples = [];

while (true) {
  const { data, error } = await sb
    .from("questions")
    .select("id,prompt,question_text,explanation,choices,section")
    .eq("section", "math")
    .range(from, from + 199);
  if (error) throw error;
  if (!data?.length) break;

  for (const q of data) {
    scanned++;
    const patch = {};
    for (const field of ["prompt", "question_text", "explanation"]) {
      const next = fixText(q[field]);
      if (next != null) patch[field] = next;
    }
    if (Array.isArray(q.choices) && q.choices.length) {
      let changed = false;
      const choices = q.choices.map((c) => {
        const next = fixText(c?.text);
        if (next != null) {
          changed = true;
          return { ...c, text: next };
        }
        return c;
      });
      if (changed) patch.choices = choices;
    }
    if (Object.keys(patch).length === 0) continue;
    if (examples.length < 15) {
      examples.push({
        id: q.id,
        before: (q.prompt || q.question_text || "").slice(0, 110),
        after: (patch.prompt || patch.question_text || "").slice(0, 130),
      });
    }
    if (!dry) {
      const { error: upErr } = await sb.from("questions").update(patch).eq("id", q.id);
      if (upErr) {
        console.error("update failed", q.id, upErr.message);
        continue;
      }
    }
    updated++;
  }

  from += 200;
  if (data.length < 200) break;
}

console.log(JSON.stringify({ dry, scanned, updated, examples }, null, 2));
