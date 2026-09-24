import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookText, Calculator } from "lucide-react";
import { PageHead } from "@/components/ui/panel";
import { RevealLink } from "@/components/ui/reveal-card";

export const Route = createFileRoute("/_authenticated/practice/sqb/")({
  component: PracticeSqbLanding,
  head: () => ({ meta: [{ title: "SQB Tests — BeyondSAT" }] }),
});

function PracticeSqbLanding() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Link
          to="/practice"
          className="tap inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white shadow-panel hover:bg-brand-400"
          aria-label="Back to Practice"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHead
          title="SQB Tests"
          subtitle="Question Bank–format practice packs. Same player as ordinary tests — separate bank."
        />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <RevealLink
          to="/practice/sqb/$section"
          params={{ section: "reading_writing" }}
          className="group lift relative overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 p-6 text-white shadow-panel"
        >
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand-400/40 blur-2xl" />
          <div className="relative">
            <div className="tile-invert grid h-12 w-12 place-items-center rounded-xl bg-brand-800 text-white">
              <BookText className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-2xl font-black text-white">Reading & Writing</h2>
            <p className="mt-1 text-sm text-brand-100">SQB packs for this section</p>
            <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-white">
              Browse <ArrowRight className="arrow-slide h-4 w-4" />
            </div>
          </div>
        </RevealLink>

        <RevealLink
          to="/practice/sqb/$section"
          params={{ section: "math" }}
          className="group lift relative overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 p-6 text-white shadow-panel"
        >
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand-400/40 blur-2xl" />
          <div className="relative">
            <div className="tile-invert grid h-12 w-12 place-items-center rounded-xl bg-brand-800 text-white">
              <Calculator className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-2xl font-black text-white">Math</h2>
            <p className="mt-1 text-sm text-brand-100">SQB packs for this section</p>
            <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-white">
              Browse <ArrowRight className="arrow-slide h-4 w-4" />
            </div>
          </div>
        </RevealLink>
      </div>
    </div>
  );
}
