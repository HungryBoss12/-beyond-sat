import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MarketingCta,
  MarketingHero,
  MarketingSection,
  MarketingShell,
} from "@/components/MarketingShell";
import { RevealCard } from "@/components/ui/reveal-card";
import { PanelGlow } from "@/components/ui/panel";
import { BookOpen, ClipboardList, Layout } from "lucide-react";

export const Route = createFileRoute("/programs")({
  component: ProgramsPage,
  head: () => ({
    meta: [
      { title: "Programs — BeyondSAT" },
      {
        name: "description",
        content:
          "Digital SAT prep with mock exams and a full question bank — free on BeyondSAT.",
      },
    ],
  }),
});

function ProgramsPage() {
  return (
    <MarketingShell wide>
      <MarketingHero
        eyebrow="Programs"
        title="Prep built around the Digital SAT"
        subtitle="Practice in a Bluebook-style flow, take full mocks, and drill the question bank — all free, no paywall."
      />

      <div className="mb-10 grid gap-4 md:grid-cols-3">
        {[
          {
            icon: Layout,
            title: "Digital SAT",
            body: "Section-adaptive practice that mirrors test day timing and tools.",
            href: "#digital",
          },
          {
            icon: ClipboardList,
            title: "Mock Exams",
            body: "Full-length mocks with scoring and analysis when you finish.",
            href: "#mocks",
          },
          {
            icon: BookOpen,
            title: "Question Bank",
            body: "Targeted Math and Reading & Writing drills by skill.",
            href: "#bank",
          },
        ].map((card) => (
          <a key={card.title} href={card.href} className="block">
            <RevealCard className="relative h-full overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 p-5 text-white lift">
              <PanelGlow />
              <div className="relative">
                <card.icon className="h-5 w-5 text-brand-100" />
                <h2 className="mt-3 text-lg font-black">{card.title}</h2>
                <p className="mt-2 text-sm text-brand-100">{card.body}</p>
              </div>
            </RevealCard>
          </a>
        ))}
      </div>

      <MarketingSection id="digital" title="Digital SAT">
        <p>
          BeyondSAT is built for the College Board Digital SAT: Reading &amp; Writing and Math
          modules, on-screen tools, and a layout meant to feel like test day — not a generic quiz
          site.
        </p>
        <p>
          Start with a free account, set your target score and exam date, then practice on your own
          schedule.
        </p>
      </MarketingSection>

      <MarketingSection id="mocks" title="Mock Exams">
        <p>
          Run full mock exams under timed conditions. When you submit, you get scoring and breakdowns
          so you can see where to focus next.
        </p>
        <p>
          Staff can publish official-style forms; you take them from your dashboard after signing in.
        </p>
      </MarketingSection>

      <MarketingSection id="bank" title="Question Bank">
        <p>
          Drill by section and skill with a growing bank of Digital SAT-style questions — including
          grid-ins for Math and multi-choice for both sections.
        </p>
        <p>
          Pair bank practice with Lessons and Vocab when you want guided review between full mocks.
        </p>
      </MarketingSection>

      <MarketingCta />
      <p className="mt-3 text-sm text-slate-500">
        Already have an account?{" "}
        <Link to="/signin" className="font-semibold text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </MarketingShell>
  );
}
