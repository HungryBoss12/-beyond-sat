import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { Menu, X, ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LINKS: { id: string; label: string }[] = [
  { id: "top", label: "Home" },
  { id: "features", label: "Programs" },
  { id: "stats", label: "Results" },
  { id: "how", label: "About" },
];

/** Sits in the nav between "Results" and "About". */
const RESOURCES: { id: string; label: string; description: string }[] = [
  { id: "how", label: "How it works", description: "Three steps to your goal score" },
  { id: "features", label: "Study guides", description: "What we cover, section by section" },
  { id: "stats", label: "Score results", description: "Outcomes from real students" },
];

/** Geometric mark shown to the left of the wordmark. */
function LogoMark() {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white">
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
        <path d="M12 3 21 7.5 12 12 3 7.5 12 3Z" fill="#11269d" />
        <path d="M3 12.5 12 17l9-4.5V16l-9 4.5L3 16v-3.5Z" fill="#2e43c4" />
      </svg>
    </span>
  );
}

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  function goTo(id: string) {
    setOpen(false);
    const scroll = () => {
      if (id === "top") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    if (pathname !== "/") {
      router.navigate({ to: "/" });
      setTimeout(scroll, 60);
    } else {
      scroll();
    }
  }

  return (
    /* The marketing top bar matches the app shell's: brand surface, white page
       behind it, and every label at full opacity rather than a muted grey. */
    <header className="sticky top-0 z-40 border-b border-brand-400/40 bg-brand-600 shadow-brand">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-xl font-black tracking-tight text-white">
            Beyond<span className="text-brand-100">SAT</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <div key={l.id} className="contents">
              <button
                onClick={() => goTo(l.id)}
                className="text-sm font-semibold text-brand-100 transition-colors hover:text-white"
              >
                {l.label}
              </button>

              {/* Resources sits between "Results" and "About" */}
              {l.id === "stats" && (
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
                        onSelect={() => goTo(r.id)}
                        className="flex-col items-start gap-0.5 py-2 focus:bg-brand-400 focus:text-white"
                      >
                        <span className="text-sm font-bold text-white">{r.label}</span>
                        <span className="text-xs text-brand-100">{r.description}</span>
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
            className="tap rounded-lg border border-brand-200 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-800"
          >
            Sign In
          </Link>
          <Link
            to="/signup"
            className="btn-brand rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold text-white"
          >
            Sign Up
          </Link>
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
        <div className="slide-in space-y-1 border-t border-brand-400/40 bg-brand-700 px-4 py-4 md:hidden">
          {LINKS.map((l) => (
            <div key={l.id}>
              <button
                onClick={() => goTo(l.id)}
                className="block w-full rounded-md px-3 py-2 text-left text-sm font-bold text-white hover:bg-brand-400"
              >
                {l.label}
              </button>

              {l.id === "stats" && (
                <div className="mt-1">
                  <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-100">
                    Resources
                  </div>
                  {RESOURCES.map((r) => (
                    <button
                      key={r.label}
                      onClick={() => goTo(r.id)}
                      className="block w-full rounded-md py-2 pl-6 pr-3 text-left text-sm font-semibold text-brand-100 hover:bg-brand-400 hover:text-white"
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="flex gap-2 pt-3">
            <Link
              to="/signin"
              className="tap flex-1 rounded-lg border border-brand-200 px-4 py-2 text-center text-sm font-bold text-white hover:bg-brand-800"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="btn-brand flex-1 rounded-lg bg-brand-400 px-4 py-2 text-center text-sm font-bold text-white"
            >
              Sign Up
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
