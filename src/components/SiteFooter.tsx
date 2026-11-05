import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Home, Instagram, Send } from "lucide-react";
import { useRegistrationEnabled } from "@/lib/registration";

const PRACTICE = [
  { to: "/programs", hash: undefined, label: "Digital SAT" },
  { to: "/programs", hash: "mocks", label: "Mock exams" },
  { to: "/programs", hash: "bank", label: "Question bank" },
  { to: "/results", hash: undefined, label: "Score results" },
] as const;

const LEGAL = [
  { to: "/support", label: "Support" },
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
  { to: "/about", label: "About" },
] as const;

export function SiteFooter({ mobileOrb }: { mobileOrb?: ReactNode }) {
  const registrationOn = useRegistrationEnabled();
  const startHref = registrationOn ? "/signup" : "/signin";

  return (
    /* The closing panel is the last thing on every marketing page, so the
       free claim lives here even when a page has no landing band. */
    <footer className="marketing relative isolate overflow-hidden bg-brand-600 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="grid-fade-dark absolute inset-0" />
        <div className="absolute -bottom-24 right-0 h-80 w-[36rem] rounded-full bg-brand-400/35 blur-3xl" />
        <p
          aria-hidden="true"
          className="absolute bottom-16 right-[-4%] select-none text-[26vw] font-semibold leading-none tracking-[-0.07em] text-white/[0.08] md:bottom-8 md:text-[11rem]"
        >
          beyond
        </p>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="grid gap-12 px-6 pb-8 pt-14 sm:px-10 md:pt-16 lg:grid-cols-[1.3fr_0.9fr] lg:gap-8">
          <div>
            <h2 className="max-w-xl text-5xl font-semibold leading-[0.95] tracking-[-0.045em] text-white sm:text-6xl md:text-7xl">
              Walk in ready.
              <span className="block text-brand-200">It stays free.</span>
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-brand-100 sm:text-base">
              Practice that feels like test day. Track every point. No subscription and no paywall.
            </p>
            <Link
              to={startHref}
              className="btn-brand mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand-600 hover:bg-brand-50"
            >
              Start practicing <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-8 self-end pb-2">
            <div>
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-brand-200">
                Practice
              </div>
              <ul className="space-y-2.5 text-sm text-brand-100">
                {PRACTICE.map((item) => (
                  <li key={item.label}>
                    <Link to={item.to} hash={item.hash} className="transition hover:text-white">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-brand-200">
                Legal
              </div>
              <ul className="space-y-2.5 text-sm text-brand-100">
                {LEGAL.map((item) => (
                  <li key={item.label}>
                    <Link to={item.to} className="transition hover:text-white">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {mobileOrb ? (
          <div className="relative z-10 flex justify-center px-6 pb-8 sm:hidden">{mobileOrb}</div>
        ) : null}

        <div className="flex flex-col gap-4 border-t border-white/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <p className="text-xs text-brand-100">© 2026 BeyondSAT. All rights reserved.</p>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              aria-label="BeyondSAT home"
              className="tap grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white hover:text-brand-600"
            >
              <Home className="h-4 w-4" />
            </Link>
            <a
              href="https://www.instagram.com/beyond_sat_uz/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="tap grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white hover:text-brand-600"
            >
              <Instagram className="h-4 w-4" />
            </a>
            <a
              href="https://t.me/Beyond_SAT"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              className="tap grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white hover:text-brand-600"
            >
              <Send className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
