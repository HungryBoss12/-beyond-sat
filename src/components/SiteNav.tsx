import { Link } from "@tanstack/react-router";
import { Menu, X, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRegistrationEnabled } from "@/lib/registration";
import { BrandMark } from "@/components/BrandMark";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/programs", label: "Programs" },
  { to: "/results", label: "Results" },
  { to: "/about", label: "About" },
] as const;

/** Sits in the nav between "Results" and "About". */
const RESOURCES: { hash: string; label: string; description: string }[] = [
  { hash: "how", label: "How it works", description: "Three steps to your goal score" },
  { hash: "guides", label: "Study guides", description: "What we cover, section by section" },
  { hash: "scores", label: "Score results", description: "Outcomes from real students" },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const registrationOn = useRegistrationEnabled();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    /* A floating glass pill in the brand colour. It condenses once the page moves. */
    <header className="marketing sticky top-0 z-40 px-3 pt-3 sm:px-6">
      <div
        className={`mx-auto max-w-6xl rounded-2xl border border-white/10 bg-brand-600/90 backdrop-blur-xl transition-shadow duration-300 ${scrolled ? "shadow-brand" : "shadow-none"}`}
      >
        <div
          className={`flex items-center justify-between px-4 transition-all duration-300 sm:px-5 ${scrolled ? "h-14" : "h-16"}`}
        >
          <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
            <BrandMark className="h-8 w-8 rounded-lg" />
            <span className="text-xl font-black tracking-tight text-white">
              Beyond<span className="text-brand-100">SAT</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {LINKS.map((l) => (
              <div key={l.to} className="contents">
                <Link
                  to={l.to}
                  className="text-sm font-semibold text-brand-100 transition-colors hover:text-white"
                >
                  {l.label}
                </Link>

                {/* Resources sits between "Results" and "About" */}
                {l.to === "/results" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex items-center gap-1 text-sm font-semibold text-brand-100 outline-none transition-colors hover:text-white">
                      Resources
                      <ChevronDown className="h-3.5 w-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-64 border-brand-400/40 bg-brand-700 text-white"
                    >
                      {RESOURCES.map((r) => (
                        <DropdownMenuItem
                          key={r.label}
                          asChild
                          className="p-0 focus:bg-transparent"
                        >
                          <Link
                            to="/resources"
                            hash={r.hash}
                            className="flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-2 text-left outline-none focus:bg-brand-400 focus:text-white"
                          >
                            <span className="text-sm font-bold text-white">{r.label}</span>
                            <span className="text-xs text-brand-100">{r.description}</span>
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              to="/signin"
              className="tap rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Sign In
            </Link>
            {registrationOn && (
              <Link
                to="/signup"
                className="btn-brand rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50"
              >
                Sign Up Free
              </Link>
            )}
          </div>

          <button
            className="tap grid h-10 w-10 place-items-center rounded-lg border border-brand-400/50 text-white hover:bg-brand-800 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <div className="slide-in space-y-1 border-t border-white/10 px-4 py-4 md:hidden">
            {LINKS.map((l) => (
              <div key={l.to}>
                <Link
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className="block w-full rounded-md px-3 py-2 text-left text-sm font-bold text-white hover:bg-brand-400"
                >
                  {l.label}
                </Link>

                {l.to === "/results" && (
                  <div className="mt-1">
                    <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-100">
                      Resources
                    </div>
                    {RESOURCES.map((r) => (
                      <Link
                        key={r.label}
                        to="/resources"
                        hash={r.hash}
                        onClick={() => setOpen(false)}
                        className="block w-full rounded-md py-2 pl-6 pr-3 text-left text-sm font-semibold text-brand-100 hover:bg-brand-400 hover:text-white"
                      >
                        {r.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="flex gap-2 pt-3">
              <Link
                to="/signin"
                onClick={() => setOpen(false)}
                className="tap flex-1 rounded-lg border border-brand-200 px-4 py-2 text-center text-sm font-bold text-white hover:bg-brand-800"
              >
                Sign In
              </Link>
              {registrationOn && (
                <Link
                  to="/signup"
                  onClick={() => setOpen(false)}
                  className="btn-brand flex-1 rounded-lg bg-brand-400 px-4 py-2 text-center text-sm font-bold text-white"
                >
                  Sign Up
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
