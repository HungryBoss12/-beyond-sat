import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MarketingCta,
  MarketingHero,
  MarketingSection,
  MarketingShell,
} from "@/components/MarketingShell";

export const Route = createFileRoute("/resources")({
  component: ResourcesPage,
  head: () => ({
    meta: [
      { title: "Resources — BeyondSAT" },
      {
        name: "description",
        content: "How BeyondSAT works, what we cover, and how score results fit into your prep.",
      },
    ],
  }),
});

function ResourcesPage() {
  return (
    <MarketingShell>
      <MarketingHero
        eyebrow="Resources"
        title="Guides for getting started"
        subtitle="Three short primers: how the product works, what we cover, and how results fit your plan."
      />

      <MarketingSection id="how" title="How it works">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <span className="font-semibold text-slate-900">Create a free account</span> — no
            subscription, no paywall.
          </li>
          <li>
            <span className="font-semibold text-slate-900">Set goals</span> — exam date plus Reading
            &amp; Writing and Math targets.
          </li>
          <li>
            <span className="font-semibold text-slate-900">Practice</span> — mocks, question bank,
            lessons, and vocab on a schedule that fits you.
          </li>
        </ol>
        <p>
          Teachers can also provision student logins and assign class groups — students do not pick
          their own class.
        </p>
      </MarketingSection>

      <MarketingSection id="guides" title="Study guides">
        <p>
          Prep is organized around the Digital SAT sections: Reading &amp; Writing and Math, with
          lessons and skills that map to what you actually see on test day.
        </p>
        <p>
          Prefer a product overview first? See{" "}
          <Link to="/programs" className="font-semibold text-brand-600 hover:underline">
            Programs
          </Link>{" "}
          for Digital SAT, mocks, and the question bank.
        </p>
      </MarketingSection>

      <MarketingSection id="scores" title="Score results">
        <p>
          After timed work, review analysis and history so you know which skills moved and which
          still need reps.
        </p>
        <p>
          More on tracking outcomes:{" "}
          <Link to="/results" className="font-semibold text-brand-600 hover:underline">
            Results
          </Link>
          .
        </p>
      </MarketingSection>

      <MarketingCta />
    </MarketingShell>
  );
}
