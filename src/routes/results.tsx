import { createFileRoute } from "@tanstack/react-router";
import {
  MarketingCta,
  MarketingHero,
  MarketingSection,
  MarketingShell,
} from "@/components/MarketingShell";

export const Route = createFileRoute("/results")({
  component: ResultsPage,
  head: () => ({
    meta: [
      { title: "Results — BeyondSAT" },
      {
        name: "description",
        content: "Track progress and see outcomes from real Digital SAT prep on BeyondSAT.",
      },
    ],
  }),
});

function ResultsPage() {
  return (
    <MarketingShell>
      <MarketingHero
        eyebrow="Results"
        title="Progress you can see"
        subtitle="BeyondSAT is free to use. Students practice like test day, track streaks and scores, and aim for a clear goal."
      />

      <MarketingSection title="What you get after you practice">
        <p>
          Session history and analysis help you spot weak areas in Math and Reading &amp; Writing —
          so the next mock is more focused than the last.
        </p>
        <p>
          Dashboard tiles surface recent activity, targets, and exam countdown so prep stays
          intentional instead of random.
        </p>
      </MarketingSection>

      <MarketingSection title="Built for real score goals">
        <p>
          Set separate Reading &amp; Writing and Math targets during onboarding. Your plan stays
          visible as you grind mocks, daily practice, and the question bank.
        </p>
        <p>
          Outcomes vary by student — BeyondSAT gives you the same tools high-effort prep needs:
          timing, feedback, and a place to keep showing up.
        </p>
      </MarketingSection>

      <MarketingCta label="Start free — see your progress" />
    </MarketingShell>
  );
}
