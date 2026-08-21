import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * Renders text that may contain LaTeX segments and a small HTML allowlist.
 * - $$...$$ → block math (display mode)
 * - $...$   → inline math
 * - \(...\) → inline math
 * - \[...\] → block math
 * - <u>…</u> → source underlines (College Board–style vocab emphasis)
 * Non-math text is escaped; only balanced `<u>` tags are re-emitted as HTML.
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
  const html = useMemo(() => renderMath(children ?? ""), [children]);
  const Tag = block ? "div" : "span";
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

const PATTERN = /(\$\$[\s\S]+?\$\$)|(\\\[[\s\S]+?\\\])|(\$[^\n$]+?\$)|(\\\([\s\S]+?\\\))/g;

/** Only balanced open/close `<u>` — no attributes, no nesting of other tags. */
const U_TAG = /<u>([\s\S]*?)<\/u>/gi;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Escape prose but keep allowlisted `<u>…</u>` as real underlines. */
function escapeProse(s: string): string {
  let out = "";
  let last = 0;
  U_TAG.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = U_TAG.exec(s))) {
    out += escapeHtml(s.slice(last, m.index));
    out += `<u>${escapeHtml(m[1])}</u>`;
    last = m.index + m[0].length;
  }
  out += escapeHtml(s.slice(last));
  return out;
}

function renderMath(input: string): string {
  if (!input) return "";
  let out = "";
  let last = 0;
  input.replace(PATTERN, (match, ...args) => {
    const offset = args[args.length - 2] as number;
    if (offset > last) out += escapeProse(input.slice(last, offset));
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
    try {
      out += katex.renderToString(tex, {
        displayMode,
        throwOnError: false,
        strict: "ignore",
      });
    } catch {
      out += escapeProse(match);
    }
    last = offset + match.length;
    return match;
  });
  if (last < input.length) out += escapeProse(input.slice(last));
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
