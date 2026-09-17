import { createFileRoute } from "@tanstack/react-router";
import {
  MarketingCta,
  MarketingHero,
  MarketingSection,
  MarketingShell,
} from "@/components/MarketingShell";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About — BeyondSAT" },
      {
        name: "description",
        content:
          "BeyondSAT is a free Digital SAT prep platform built to feel like test day.",
      },
    ],
  }),
});

function AboutPage() {
  return (
    <MarketingShell>
      <MarketingHero
        eyebrow="About"
        title="BeyondSAT"
        subtitle="The digital SAT prep platform built to feel exactly like test day. Practice, track, and reach your goal score — free to use."
      />

      <MarketingSection title="Why we built it">
        <p>
          Most prep tools either feel nothing like the Digital SAT or hide the good parts behind a
          paywall. BeyondSAT aims for the opposite: a Bluebook-adjacent experience students can open
          every day without a subscription.
        </p>
        <p>
          That means timed modules, serious question content, analysis after you finish, and a
          dashboard that keeps goals and exam dates in view.
        </p>
      </MarketingSection>

      <MarketingSection title="Who it is for">
        <p>
          Students preparing for the Digital SAT, and teachers or centers who need to provision
          accounts and assign classes without making students self-enroll into groups.
        </p>
      </MarketingSection>

      <MarketingSection title="Stay in touch">
        <p>
          Questions or feedback? Reach us on Telegram (
          <a
            href="https://t.me/Beyond_SAT"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-600 hover:underline"
          >
            @Beyond_SAT
          </a>
          ) or Instagram (
          <a
            href="https://www.instagram.com/beyond_sat_uz/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-600 hover:underline"
          >
            @beyond_sat_uz
          </a>
          ).
        </p>
      </MarketingSection>

      <MarketingCta />
    </MarketingShell>
  );
}
