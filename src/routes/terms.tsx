import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MarketingHero,
  MarketingSection,
  MarketingShell,
} from "@/components/MarketingShell";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms — BeyondSAT" },
      {
        name: "description",
        content: "Terms of use for the BeyondSAT Digital SAT prep platform.",
      },
    ],
  }),
});

function TermsPage() {
  return (
    <MarketingShell>
      <MarketingHero
        eyebrow="Legal"
        title="Terms of use"
        subtitle="By using BeyondSAT you agree to these terms. Last updated September 2026."
      />

      <MarketingSection title="The service">
        <p>
          BeyondSAT provides Digital SAT practice tools free of charge. Features may change as we
          improve the product. We do not guarantee any particular score outcome.
        </p>
      </MarketingSection>

      <MarketingSection title="Accounts">
        <p>
          You are responsible for keeping login credentials secure. Do not share accounts or attempt
          to access other users&apos; data. Teachers who create student accounts must only enroll
          students they are authorized to teach.
        </p>
      </MarketingSection>

      <MarketingSection title="Acceptable use">
        <p>
          Do not abuse, disrupt, or reverse-engineer the service; do not upload unlawful content; do
          not use BeyondSAT to cheat on official College Board exams. We may suspend accounts that
          violate these rules.
        </p>
      </MarketingSection>

      <MarketingSection title="Content and trademarks">
        <p>
          BeyondSAT branding and original materials on the site belong to us or our licensors.
          College Board and SAT are trademarks of their respective owners; BeyondSAT is not
          affiliated with or endorsed by the College Board.
        </p>
      </MarketingSection>

      <MarketingSection title="Contact">
        <p>
          Questions about these terms:{" "}
          <Link to="/support" className="font-semibold text-brand-600 hover:underline">
            Support
          </Link>
          .
        </p>
      </MarketingSection>
    </MarketingShell>
  );
}
