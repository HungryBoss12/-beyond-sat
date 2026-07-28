import { Twitter, Instagram, Youtube } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="bg-primary text-white/90">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="text-2xl font-bold text-white">BeyondSAT</div>
          <p className="mt-3 text-sm text-white/70 max-w-sm">
            The digital SAT prep platform built to feel exactly like test day. Practice, track, and reach your goal score.
          </p>
          <div className="mt-5 flex gap-3">
            <a href="#" aria-label="Twitter" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20 transition"><Twitter className="h-4 w-4" /></a>
            <a href="#" aria-label="Instagram" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20 transition"><Instagram className="h-4 w-4" /></a>
            <a href="#" aria-label="YouTube" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20 transition"><Youtube className="h-4 w-4" /></a>
          </div>
        </div>
        <div>
          <div className="text-sm font-semibold text-white mb-3">Programs</div>
          <ul className="space-y-2 text-sm text-white/70">
            <li><a href="#" className="hover:text-white">Digital SAT</a></li>
            <li><a href="#" className="hover:text-white">Mock Exams</a></li>
            <li><a href="#" className="hover:text-white">Question Bank</a></li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold text-white mb-3">Contact</div>
          <ul className="space-y-2 text-sm text-white/70">
            <li><a href="#" className="hover:text-white">Support</a></li>
            <li><a href="#" className="hover:text-white">Privacy</a></li>
            <li><a href="#" className="hover:text-white">Terms</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5 text-xs text-white/60">
          © 2026 BeyondSAT. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
