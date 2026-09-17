import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MarketingHero,
  MarketingSection,
  MarketingShell,
} from "@/components/MarketingShell";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy — BeyondSAT" },
      {
        name: "description",
        content: "How BeyondSAT handles account and usage information.",
      },
    ],
  }),
});

function PrivacyPage() {
  return (
    <MarketingShell>
      <MarketingHero
        eyebrow="Legal"
        title="Privacy"
        subtitle="A plain-language summary of how BeyondSAT handles your information. Last updated September 2026."
      />

      <MarketingSection title="What we collect">
        <p>
          When you create an account we store identifiers needed to sign you in (such as email or
          generated login username), profile fields you provide (name, goals, exam date), and
          practice activity (sessions, answers, scores) so the product can work.
        </p>
        <p>
          If a teacher provisions your account, they may also associate you with a class group.
        </p>
      </MarketingSection>

      <MarketingSection title="How we use it">
        <p>
          We use this data to run BeyondSAT: authentication, practice, scoring, analysis, class
          features, and product improvement. We do not sell your personal information.
        </p>
      </MarketingSection>

      <MarketingSection title="Sharing">
        <p>
          Service providers that host our app and database process data on our behalf. Staff and
          assigned teachers may see student activity needed to teach and support you. We may disclose
          information if required by law.
        </p>
      </MarketingSection>

      <MarketingSection title="Your choices">
        <p>
          You can update profile details in the app. For account deletion or other privacy requests,
          contact us via{" "}
          <Link to="/support" className="font-semibold text-brand-600 hover:underline">
            Support
          </Link>
          .
        </p>
      </MarketingSection>
    </MarketingShell>
  );
}
