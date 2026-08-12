import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyBox({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="max-h-56 overflow-auto rounded-lg border border-brand-400/40 bg-brand-900 p-3 text-[11px] leading-relaxed text-brand-100">
        {text}
      </pre>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="tap absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-brand-400/50 bg-brand-800 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-brand-400"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
