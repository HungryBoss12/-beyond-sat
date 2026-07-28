import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * Renders text that may contain LaTeX segments.
 * - $$...$$ → block math (display mode)
 * - $...$   → inline math
 * - \(...\) → inline math
 * - \[...\] → block math
 * Non-math text is rendered as-is with whitespace preserved.
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
  return (
    <Tag
      className={className}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

const PATTERN =
  /(\$\$[\s\S]+?\$\$)|(\\\[[\s\S]+?\\\])|(\$[^\n$]+?\$)|(\\\([\s\S]+?\\\))/g;

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderMath(input: string): string {
  if (!input) return "";
  let out = "";
  let last = 0;
  input.replace(PATTERN, (match, ...args) => {
    const offset = args[args.length - 2] as number;
    if (offset > last) out += escapeHtml(input.slice(last, offset));
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
      out += escapeHtml(match);
    }
    last = offset + match.length;
    return match;
  });
  if (last < input.length) out += escapeHtml(input.slice(last));
  // preserve line breaks in plain text portions
  return out.replace(/\n/g, "<br/>");
}

/** Small helper for admin editors: shows a live rendered preview of LaTeX text. */
export function MathPreview({ value }: { value: string }) {
  if (!value?.trim()) {
    return (
      <div className="text-xs text-slate-400 italic">
        Live preview appears here. Wrap math in $…$ (inline) or $$…$$ (block).
      </div>
    );
  }
  return (
    <MathText
      block
      className="text-sm text-slate-800 leading-7 whitespace-pre-wrap"
    >
      {value}
    </MathText>
  );
}
