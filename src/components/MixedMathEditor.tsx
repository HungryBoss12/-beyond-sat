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
    <div className="rounded-lg border border-border bg-white focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
      <textarea
        ref={taRef}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={singleLine ? 1 : rows}
        className="w-full resize-y bg-transparent px-3 py-2 text-[15px] leading-7 outline-none placeholder:text-slate-400"
        style={singleLine ? { minHeight: "2.5rem" } : undefined}
      />

      {/* Live preview of the final rendered content */}
      {(value ?? "").trim() && (
        <div className="border-t border-border/70 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
            Preview
          </div>
          <MathPreview value={value} />
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border/70 bg-slate-50 px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setDraft("");
              setPicker({ display: false });
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-white border border-border px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-primary/50 hover:text-primary"
            title="Insert inline math"
          >
            <Sigma className="h-3.5 w-3.5" /> Insert math
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft("");
              setPicker({ display: true });
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-white border border-border px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-primary/50 hover:text-primary"
            title="Insert display (block) math"
          >
            <Sigma className="h-3.5 w-3.5" /> Block math
          </button>
        </div>
        <span className="text-[10px] text-slate-400">
          Type text normally. Use Insert math for equations (x^2 → x²).
        </span>
      </div>

      {picker && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="text-sm font-bold text-primary flex items-center gap-2">
                <Sigma className="h-4 w-4" />
                {picker.display ? "Insert block math" : "Insert inline math"}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPicker(null);
                  setDraft("");
                }}
                className="h-8 w-8 grid place-items-center rounded-md text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="rounded-lg border-2 border-primary/30 bg-primary/5 px-3 py-3">
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
                  }}
                />
              </div>
              <div className="rounded-lg bg-slate-50 border border-border px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
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
              <div className="text-[11px] text-slate-500">
                Type math naturally — <code>x^2</code>, <code>sqrt(2)</code>,
                <code> a/b</code> — it renders as you type.
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-slate-50 px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  setPicker(null);
                  setDraft("");
                }}
                className="rounded-md border border-border bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmMath}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-[#002a56]"
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
