import { useEffect, useRef, useState } from "react";
import "mathlive";
import "mathlive/static.css";
import { Sigma, X, Check } from "lucide-react";
import { MathPreview } from "./MathText";

/**
 * Prose + math editor.
 * - Backed by a plain string with $...$ / $$...$$ delimiters.
 * - Prose is edited in a normal <textarea> so typing letters/numbers/symbols
 *   works exactly like any input.
 * - Clicking "Insert math" opens a small MathLive popup where the admin types
 *   naturally (x^2 renders as x² live). "Insert" writes the LaTeX at the
 *   cursor position wrapped in $...$.
 * - A live rendered preview (KaTeX) sits under the field so what the admin
 *   sees matches what the student will see.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          "virtual-keyboard-mode"?: string;
        },
        HTMLElement
      >;
    }
  }
}

export function MixedMathEditor({
  value,
  onChange,
  rows = 3,
  placeholder,
  singleLine = false,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  singleLine?: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [picker, setPicker] = useState<null | { display: boolean }>(null);
  const [draft, setDraft] = useState("");
  const mathRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!picker) return;
    const el = mathRef.current as any;
    if (!el) return;
    el.value = draft;
    const h = () => setDraft(el.value ?? "");
    el.addEventListener("input", h);
    setTimeout(() => el.focus?.(), 0);
    return () => el.removeEventListener("input", h);
  }, [picker]);

  function insertAtCursor(text: string) {
    const ta = taRef.current;
    if (!ta) {
      onChange((value ?? "") + text);
      return;
    }
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    // restore caret after the inserted text
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  function confirmMath() {
    const tex = (draft ?? "").trim();
    if (tex) {
      const wrapped = picker?.display ? `$$${tex}$$` : `$${tex}$`;
      insertAtCursor(wrapped);
    }
    setDraft("");
    setPicker(null);
  }

  return (
    /* This editor always sits inside a brand card, so it takes the recessed
       input surface (brand-800) and its own strips go a step deeper. */
    <div className="overflow-hidden rounded-lg border border-brand-400/50 bg-brand-800 focus-within:border-brand-200">
      <textarea
        ref={taRef}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={singleLine ? 1 : rows}
        className="w-full resize-y bg-transparent px-3 py-2 text-[15px] leading-7 text-white outline-none [color-scheme:dark] placeholder:text-brand-200"
        style={singleLine ? { minHeight: "2.5rem" } : undefined}
      />

      {/* Live preview of the final rendered content */}
      {(value ?? "").trim() && (
        <div className="border-t border-brand-400/30 px-3 py-2 text-white">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-brand-100">
            Preview
          </div>
          <MathPreview value={value} />
        </div>
      )}

      <div className="flex items-center justify-between border-t border-brand-400/30 bg-brand-900 px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setDraft("");
              setPicker({ display: false });
            }}
            className="tap inline-flex items-center gap-1.5 rounded-md border border-brand-400/50 bg-brand-700 px-2 py-1 text-[11px] font-bold text-white hover:bg-brand-400"
            title="Insert inline math"
          >
            <Sigma className="h-3.5 w-3.5 text-brand-100" /> Insert math
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft("");
              setPicker({ display: true });
            }}
            className="tap inline-flex items-center gap-1.5 rounded-md border border-brand-400/50 bg-brand-700 px-2 py-1 text-[11px] font-bold text-white hover:bg-brand-400"
            title="Insert display (block) math"
          >
            <Sigma className="h-3.5 w-3.5 text-brand-100" /> Block math
          </button>
        </div>
        <span className="text-[10px] text-brand-100">
          Type text normally. Use Insert math for equations (x^2 → x²).
        </span>
      </div>

      {picker && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-brand-900/60 p-4 backdrop-blur-sm">
          <div className="pop-in w-full max-w-lg overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 shadow-float">
            <div className="flex items-center justify-between border-b border-brand-400/30 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Sigma className="h-4 w-4 text-brand-100" />
                {picker.display ? "Insert block math" : "Insert inline math"}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPicker(null);
                  setDraft("");
                }}
                className="tap grid h-8 w-8 place-items-center rounded-md text-brand-100 hover:bg-brand-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <div className="rounded-lg border-2 border-brand-300/60 bg-brand-800 px-3 py-3">
                {/* @ts-expect-error custom element */}
                <math-field
                  ref={mathRef as any}
                  virtual-keyboard-mode="manual"
                  style={{
                    display: "block",
                    width: "100%",
                    fontSize: picker.display ? "22px" : "20px",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    minHeight: "2.25rem",
                    // MathLive paints from currentColor, so the field has to be
                    // told it's on a dark surface or the formula renders black.
                    color: "#ffffff",
                    caretColor: "#ffffff",
                  }}
                />
              </div>
              <div className="rounded-lg border border-brand-400/40 bg-brand-800 px-3 py-2 text-white">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-brand-100">
                  Live preview
                </div>
                <MathPreview
                  value={
                    draft
                      ? picker.display
                        ? `$$${draft}$$`
                        : `$${draft}$`
                      : ""
                  }
                />
              </div>
              <div className="text-[11px] text-brand-100">
                Type math naturally — <code>x^2</code>, <code>sqrt(2)</code>,
                <code> a/b</code> — it renders as you type.
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-brand-400/30 bg-brand-700 px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  setPicker(null);
                  setDraft("");
                }}
                className="tap rounded-md px-3 py-1.5 text-xs font-bold text-brand-100 hover:bg-brand-800 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmMath}
                className="btn-brand inline-flex items-center gap-1.5 rounded-md bg-brand-400 px-3 py-1.5 text-xs font-bold text-white"
              >
                <Check className="h-3.5 w-3.5" /> Insert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
