import { createFileRoute } from "@tanstack/react-router";
import {
  MarketingHero,
  MarketingSection,
  MarketingShell,
} from "@/components/MarketingShell";
import { Send } from "lucide-react";

export const Route = createFileRoute("/support")({
  component: SupportPage,
  head: () => ({
    meta: [
      { title: "Support — BeyondSAT" },
      {
        name: "description",
        content: "Get help with BeyondSAT via Telegram.",
      },
    ],
  }),
});

function SupportPage() {
  return (
    <MarketingShell>
      <MarketingHero
        eyebrow="Contact"
        title="Support"
        subtitle="We are happiest to help on Telegram — message the BeyondSAT channel for account, class, or product questions."
      />

      <MarketingSection title="Reach us">
        <p>
          <a
            href="https://t.me/Beyond_SAT"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-brand inline-flex items-center gap-2 rounded-lg bg-brand-400 px-5 py-2.5 text-sm font-bold text-white"
          >
            <Send className="h-4 w-4" />
            Open Telegram — @Beyond_SAT
          </a>
        </p>
        <p className="pt-2">
          You can also follow updates on{" "}
          <a
            href="https://www.instagram.com/beyond_sat_uz/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-600 hover:underline"
          >
            Instagram
          </a>
          .
        </p>
      </MarketingSection>

      <MarketingSection title="Before you write">
        <ul className="list-disc space-y-2 pl-5">
          <li>Include the username you sign in with (if you have one).</li>
          <li>Describe what you tried and what you expected.</li>
          <li>For class access issues, ask your teacher first — they assign groups.</li>
        </ul>
      </MarketingSection>
    </MarketingShell>
  );
}
