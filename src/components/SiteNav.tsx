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
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-600">
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
        <path d="M12 3 21 7.5 12 12 3 7.5 12 3Z" fill="#fff" />
        <path d="M3 12.5 12 17l9-4.5V16l-9 4.5L3 16v-3.5Z" fill="#fff" fillOpacity="0.55" />
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
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-xl font-bold tracking-tight text-slate-900">
            Beyond<span className="text-blue-600">SAT</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {LINKS.map((l) => (
            <div key={l.id} className="contents">
              <button
                onClick={() => goTo(l.id)}
                className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
              >
                {l.label}
              </button>

              {/* Resources sits between "Results" and "About" */}
              {l.id === "stats" && (
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors outline-none">
                    Resources
                    <ChevronDown className="h-3.5 w-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    {RESOURCES.map((r) => (
                      <DropdownMenuItem
                        key={r.label}
                        onSelect={() => goTo(r.id)}
                        className="flex-col items-start gap-0.5 py-2"
                      >
                        <span className="text-sm font-medium text-slate-900">{r.label}</span>
                        <span className="text-xs text-slate-500">{r.description}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/signin"
            className="rounded-lg border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/signup"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors soft-shadow"
          >
            Sign Up
          </Link>
        </div>

        <button
          className="md:hidden grid place-items-center h-10 w-10 rounded-lg border border-slate-200 text-blue-600"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-1">
          {LINKS.map((l) => (
            <div key={l.id}>
              <button
                onClick={() => goTo(l.id)}
                className="block w-full text-left rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50"
              >
                {l.label}
              </button>

              {l.id === "stats" && (
                <div className="mt-1">
                  <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Resources
                  </div>
                  {RESOURCES.map((r) => (
                    <button
                      key={r.label}
                      onClick={() => goTo(r.id)}
                      className="block w-full text-left rounded-md pl-6 pr-3 py-2 text-sm font-medium text-slate-600 hover:bg-blue-50"
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
              className="flex-1 rounded-lg border border-blue-600 px-4 py-2 text-center text-sm font-semibold text-blue-600"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white"
            >
              Sign Up
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
