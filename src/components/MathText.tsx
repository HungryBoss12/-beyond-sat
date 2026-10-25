import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
import { latexifyAsciiMath } from "@/lib/math/latexify-ascii";

/**
 * Renders text that may contain LaTeX segments and a small HTML allowlist.
 * - $$...$$ → block math (display mode)
 * - $...$   → inline math
 * - \(...\) → inline math
 * - \[...\] → block math
 * - <u>…</u> → source underlines (College Board–style vocab emphasis)
 * Non-math text is escaped; only balanced `<u>` tags are re-emitted as HTML.
 *
 * Currency `$` before a digit (e.g. `$3,270`) is not treated as math open.
 */

export function MathText({
  children,
  className = "",
  block = false,
  math = true,
}: {
  children: string | null | undefined;
  className?: string;
  block?: boolean;
  /** Reading & Writing is prose. Skip KaTeX and the ascii-math rewriter there. */
  math?: boolean;
}) {
  const html = useMemo(() => renderMathText(children ?? "", { math }), [children, math]);
  const Tag = block ? "div" : "span";
  return (
    <Tag
      className={cn("math-text", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

const PATTERN = /(\$\$[\s\S]+?\$\$)|(\\\[[\s\S]+?\\\])|(\$[^\n$]+?\$)|(\\\([\s\S]+?\\\))/g;

/** Balanced `<u>…</u>` — attributes on the open tag are stripped. */
const U_TAG = /<u\b[^>]*>([\s\S]*?)<\/u>/gi;

/** Placeholder so currency `$` never matches the inline-math `$…$` splitter. */
const CURRENCY_PH = "\uE000";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Decode entity-encoded underline tags saved from editors or imports. */
function normalizeUnderlineMarkup(input: string): string {
  return input
    .replace(/&lt;\s*\/\s*u\s*&gt;/gi, "</u>")
    .replace(/&lt;\s*u\s*&gt;/gi, "<u>")
    .replace(/<u\b[^>]*>/gi, "<u>");
}

/**
 * Soft-heal Word/import artifacts and protect currency dollars from math split.
 * `$3,270 from…` must not open `$…$` math; `$h$` / `$3x+1$` / `$6\sqrt{3}$` still do.
 * Exported for unit tests.
 */
export function normalizeMathInput(input: string): string {
  let s = latexifyAsciiMath(unescapeLiteralBreaks(input));
  // `\3{,}270` / `\3,270` — broken money tokens (not LaTeX)
  s = s.replace(/\\(\d)\{,\}(\d)/g, "$$$1{,}$2");
  s = s.replace(/\\(\d),(\d)/g, "$$$1,$2");
  // Escaped currency: `\$3,270` → protected dollar + digits
  s = s.replace(/\\\$(\d)/g, `${CURRENCY_PH}$1`);
  // Bare currency amounts: $ + number (optional thousands/decimals).
  // Do NOT put `.` alone in the lookahead — that split `$196.74$` into currency
  // `196` + dangling `.74$`. Closing `$` must leave real math intact.
  s = s.replace(
    /(^|[^\\$])\$(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\{,\}\d+(?:\.\d+)?|\d+\.\d+|\d+)(?=[\s,;:!?)\]}]|$|\.(?:[\s,;:!?)\]}]|$))/g,
    `$1${CURRENCY_PH}$2`,
  );
  return healSwallowedMath(s);
}

function restoreCurrencyPlaceholders(s: string): string {
  return s.split(CURRENCY_PH).join("$");
}

/**
 * Imports often store the two characters `\` + `n` instead of a line break.
 * Turn those into real newlines, but leave LaTeX commands that start with n
 * (`\neq`, `\nu`, `\nabla`, `\newline`) alone.
 */
function unescapeLiteralBreaks(input: string): string {
  return input.replace(/\\n/g, (match, offset: number, whole: string) => {
    const next = whole[offset + match.length];
    if (next && /[a-z]/.test(next)) return match;
    return "\n";
  });
}

/**
 * A missing closer makes `$RS=√105. What is the value of $sin R$` one math
 * span, so the sentence is letter-spaced and the later expression never renders.
 * If the text before ". Capital" looks like math, close the span there.
 */
function healSwallowedMath(input: string): string {
  let out = "";
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    const prev = i > 0 ? input[i - 1] : "";
    const next = input[i + 1] ?? "";
    if (ch === "$" && prev !== "$" && prev !== "\\" && next !== "$") {
      const close = input.indexOf("$", i + 1);
      if (close > i) {
        const inner = input.slice(i + 1, close);
        const boundary = inner.search(/\.\s+[A-Z]/);
        const head = boundary > 0 ? inner.slice(0, boundary) : "";
        if (
          boundary > 0 &&
          boundary <= 80 &&
          /[=\d√\\^_+*/]/.test(head) &&
          !/\b(the|and|which|what|for|with)\b/i.test(head)
        ) {
          out += `$${head}$`;
          i = i + 1 + boundary;
          continue;
        }
      }
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** Unicode radicals that were already inside `$…$` still need a TeX command. */
function polishTex(tex: string): string {
  return tex
    .replace(/√\s*\(([^)]+)\)/g, (_m, inner: string) => `\\sqrt{${inner.trim()}}`)
    .replace(/√\s*([A-Za-z0-9]+)/g, (_m, inner: string) => `\\sqrt{${inner}}`);
}

/** Escape prose but keep allowlisted `<u>…</u>` as real underlines. */
function escapeProse(s: string): string {
  const tag = new RegExp(U_TAG.source, U_TAG.flags);
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(s))) {
    out += escapeHtml(s.slice(last, m.index));
    out += `<u>${escapeHtml(m[1])}</u>`;
    last = m.index + m[0].length;
  }
  out += escapeHtml(s.slice(last));
  return out;
}

/** Reading & Writing: underlines and line breaks only. No KaTeX, no fraction rewriter. */
function renderProseText(input: string): string {
  if (!input) return "";
  const text = unescapeLiteralBreaks(normalizeUnderlineMarkup(input));
  return escapeProse(text).replace(/\n/g, "<br/>");
}

/** Exported for unit tests. */
export function renderMathText(input: string, options?: { math?: boolean }): string {
  if (!input) return "";
  if (options?.math === false) return renderProseText(input);
  const normalized = normalizeMathInput(normalizeUnderlineMarkup(input));
  let out = "";
  let last = 0;
  normalized.replace(PATTERN, (match, ...args) => {
    const offset = args[args.length - 2] as number;
    if (offset > last) {
      out += escapeProse(restoreCurrencyPlaceholders(normalized.slice(last, offset)));
    }
    let tex = match;
    let displayMode = false;
    if (tex.startsWith("$$") && tex.endsWith("$$")) {
      tex = tex.slice(2, -2);
      displayMode = true;
    } else if (tex.startsWith("\\[") && tex.endsWith("\\]")) {
      tex = tex.slice(2, -2);
      displayMode = true;
    } else if (tex.startsWith("\\(") && tex.endsWith("\\)")) {
      tex = tex.slice(2, -2);
    } else if (tex.startsWith("$") && tex.endsWith("$")) {
      tex = tex.slice(1, -1);
    }
    tex = polishTex(restoreCurrencyPlaceholders(tex));
    try {
      out += katex.renderToString(tex, {
        displayMode,
        throwOnError: false,
        strict: "ignore",
      });
    } catch {
      out += escapeProse(restoreCurrencyPlaceholders(match));
    }
    last = offset + match.length;
    return match;
  });
  if (last < normalized.length) {
    out += escapeProse(restoreCurrencyPlaceholders(normalized.slice(last)));
  }
  // preserve line breaks in plain text portions
  return out.replace(/\n/g, "<br/>");
}

/** Small helper for admin editors: shows a live rendered preview of LaTeX text. */
export function MathPreview({ value, math = true }: { value: string; math?: boolean }) {
  /* Rendered inside brand-surfaced editors, so it inherits white/light-blue
     rather than the old slate greys. */
  if (!value?.trim()) {
    return (
      <div className="text-xs italic text-brand-100">
        {math
          ? "Live preview appears here. Wrap math in $…$ (inline) or $$…$$ (block)."
          : "Live preview appears here."}
      </div>
    );
  }
  return (
    <MathText block math={math}>
      {value}
    </MathText>
  );
}
