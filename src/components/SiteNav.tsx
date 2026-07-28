import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const LINKS: { id: string; label: string }[] = [
  { id: "top", label: "Home" },
  { id: "features", label: "Programs" },
  { id: "stats", label: "Results" },
  { id: "how", label: "About" },
];

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
    <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="text-xl font-bold text-primary tracking-tight">
          BeyondSAT
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {LINKS.map((l) => (
            <button
              key={l.id}
              onClick={() => goTo(l.id)}
              className="text-sm font-medium text-slate-600 hover:text-primary transition-colors"
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/signin"
            className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-accent transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/signup"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#002a56] transition-colors soft-shadow"
          >
            Sign Up
          </Link>
        </div>

        <button
          className="md:hidden grid place-items-center h-10 w-10 rounded-lg border border-border text-primary"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-white px-4 py-4 space-y-1">
          {LINKS.map((l) => (
            <button
              key={l.id}
              onClick={() => goTo(l.id)}
              className="block w-full text-left rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-secondary"
            >
              {l.label}
            </button>
          ))}
          <div className="flex gap-2 pt-3">
            <Link
              to="/signin"
              className="flex-1 rounded-lg border border-primary px-4 py-2 text-center text-sm font-semibold text-primary"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-center text-sm font-semibold text-white"
            >
              Sign Up
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
