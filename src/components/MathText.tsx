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
}: {
  children: string | null | undefined;
  className?: string;
  block?: boolean;
}) {
  const html = useMemo(() => renderMathText(children ?? ""), [children]);
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
  let s = latexifyAsciiMath(input);
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
  return s;
}

function restoreCurrencyPlaceholders(s: string): string {
  return s.split(CURRENCY_PH).join("$");
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

/** Exported for unit tests. */
export function renderMathText(input: string): string {
  if (!input) return "";
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
    tex = restoreCurrencyPlaceholders(tex);
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
export function MathPreview({ value }: { value: string }) {
  /* Rendered inside brand-surfaced editors, so it inherits white/light-blue
     rather than the old slate greys. */
  if (!value?.trim()) {
    return (
      <div className="text-xs italic text-brand-100">
        Live preview appears here. Wrap math in $…$ (inline) or $$…$$ (block).
      </div>
    );
  }
  return <MathText block>{value}</MathText>;
}
