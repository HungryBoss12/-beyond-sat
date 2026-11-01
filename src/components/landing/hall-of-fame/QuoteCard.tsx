import { Quote } from "lucide-react";
import { RevealCard } from "@/components/ui/reveal-card";
import type { HallQuote } from "./schema";

export function QuoteCard({ quote }: { quote: HallQuote }) {
  return (
    <RevealCard className="lift flex h-full flex-col rounded-2xl border border-brand-400/40 bg-white p-6 shadow-panel md:p-8">
      <Quote className="h-7 w-7 text-brand-400" strokeWidth={2} aria-hidden="true" />
      <blockquote className="mt-4 flex-1 text-base leading-relaxed text-slate-700">
        {quote.text}
      </blockquote>
      {(quote.name || quote.detail) && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="text-sm font-bold text-slate-900">{quote.name}</div>
          {quote.detail && <div className="text-xs text-slate-500">{quote.detail}</div>}
        </div>
      )}
    </RevealCard>
  );
}
