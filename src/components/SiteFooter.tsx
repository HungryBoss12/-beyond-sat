import { Twitter, Instagram, Youtube, Sparkles } from "lucide-react";

export function SiteFooter() {
  return (
    /* Secondary copy is the light brand step at full opacity rather than
       white/70, so nothing in the footer reads as dimmed. */
    <footer className="bg-brand-600 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="text-2xl font-bold text-white">BeyondSAT</div>
          <p className="mt-3 max-w-sm text-sm text-brand-100">
            The digital SAT prep platform built to feel exactly like test day. Practice, track, and
            reach your goal score.
          </p>
          {/* Stated in the footer as well as the landing band: the footer is on
              every page, so this is the one place the claim is always visible. */}
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-800 px-3.5 py-1.5 text-xs font-bold text-white ring-1 ring-brand-400/50">
            <Sparkles className="h-3.5 w-3.5 text-brand-200" strokeWidth={2.5} />
            Free to use — no subscription, no paywall
          </p>
          <div className="mt-5 flex gap-3">
            <a
              href="#"
              aria-label="Twitter"
              className="tap grid h-9 w-9 place-items-center rounded-full bg-brand-800 text-white transition hover:bg-brand-400"
            >
              <Twitter className="h-4 w-4" />
            </a>
            <a
              href="#"
              aria-label="Instagram"
              className="tap grid h-9 w-9 place-items-center rounded-full bg-brand-800 text-white transition hover:bg-brand-400"
            >
              <Instagram className="h-4 w-4" />
            </a>
            <a
              href="#"
              aria-label="YouTube"
              className="tap grid h-9 w-9 place-items-center rounded-full bg-brand-800 text-white transition hover:bg-brand-400"
            >
              <Youtube className="h-4 w-4" />
            </a>
          </div>
        </div>
        <div>
          <div className="mb-3 text-sm font-semibold text-white">Programs</div>
          <ul className="space-y-2 text-sm text-brand-100">
            <li>
              <a href="#" className="hover:text-white">
                Digital SAT
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white">
                Mock Exams
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white">
                Question Bank
              </a>
            </li>
          </ul>
        </div>
        <div>
          <div className="mb-3 text-sm font-semibold text-white">Contact</div>
          <ul className="space-y-2 text-sm text-brand-100">
            <li>
              <a href="#" className="hover:text-white">
                Support
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white">
                Privacy
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white">
                Terms
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-brand-400/40">
        <div className="mx-auto max-w-7xl px-4 py-5 text-xs text-brand-100 sm:px-6">
          © 2026 BeyondSAT. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
