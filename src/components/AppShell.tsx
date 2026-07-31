import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  Newspaper,
  User,
  Flame,
  LogOut,
  Menu,
  X,
  ChevronDown,
  BarChart3,
} from "lucide-react";
import { Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/practice", label: "Practice", icon: BookOpen },
  { to: "/analysis", label: "Analysis", icon: BarChart3 },
  { to: "/news", label: "News", icon: Newspaper },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [streak, setStreak] = useState<number>(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) return;
      setEmail(u.email ?? "");
      const [{ data: prof }, { data: sp }, { data: role }] = await Promise.all([
        supabase.from("profiles").select("full_name,first_name").eq("id", u.id).maybeSingle(),
        supabase.from("student_profiles").select("current_streak").eq("user_id", u.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.id).eq("role", "admin").maybeSingle(),
      ]);
      setName(prof?.full_name || prof?.first_name || u.email?.split("@")[0] || "Student");
      setStreak(sp?.current_streak ?? 0);
      setIsAdmin(!!role);
    })();
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => setDrawerOpen(false), [pathname]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/signin", replace: true });
  }

  const initials = name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "S";

  return (
    <div className="min-h-screen bg-background text-slate-800">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200/80 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-slate-200/80 px-6">
          <Link to="/dashboard" className="group flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-grad-brand shadow-brand transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
              <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" aria-hidden="true">
                <path d="M12 3 21 7.5 12 12 3 7.5 12 3Z" fill="#fff" />
                <path d="M3 12.5 12 17l9-4.5V16l-9 4.5L3 16v-3.5Z" fill="#fff" fillOpacity="0.55" />
              </svg>
            </span>
            <span className="text-lg font-black tracking-tight text-slate-900">
              Beyond<span className="text-blue-600">SAT</span>
            </span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {NAV.map((n) => {
            const active = pathname === n.to || pathname.startsWith(n.to + "/");
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold " +
                  (active
                    ? "bg-grad-brand text-white shadow-brand"
                    : "text-slate-600 nudge hover:bg-blue-50 hover:text-blue-700")
                }
              >
                {active && (
                  <span className="absolute -left-1.5 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-blue-600" />
                )}
                <Icon
                  className={
                    "h-[18px] w-[18px] shrink-0 transition-transform duration-300 " +
                    (active ? "" : "group-hover:scale-110")
                  }
                />
                {n.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              to="/admin"
              className={
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold " +
                (pathname.startsWith("/admin")
                  ? "bg-grad-brand text-white shadow-brand"
                  : "text-slate-600 nudge hover:bg-blue-50 hover:text-blue-700")
              }
            >
              <Shield className="h-[18px] w-[18px] shrink-0 transition-transform duration-300 group-hover:scale-110" />
              Admin
            </Link>
          )}
        </nav>
        <div className="border-t border-slate-200/80 p-4">
          <div className="flex items-center gap-2.5 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 px-3 py-2.5 ring-1 ring-orange-100">
            <Flame className="h-5 w-5 fill-orange-500 text-orange-500" />
            <div>
              <div className="text-lg font-black leading-none text-orange-600 tabular-nums">
                {streak}
              </div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-500/80">
                day streak
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Header. White rather than solid blue: the sidebar already carries the
          brand, and a light bar lets the page content below it lead. */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-md lg:pl-64">
        <div className="mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="tap grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-lg font-black tracking-tight text-slate-900 lg:hidden">
              Beyond<span className="text-blue-600">SAT</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 transition-transform duration-200 hover:scale-105">
              <Flame className="h-4 w-4 fill-orange-500 text-orange-500" />
              <span className="text-sm font-bold tabular-nums text-orange-600">{streak}</span>
              <span className="hidden text-xs font-semibold text-orange-500/80 sm:inline">
                day{streak === 1 ? "" : "s"}
              </span>
            </div>
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="btn-ghost inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-grad-brand text-xs font-bold text-white">
                  {initials}
                </span>
                <span className="hidden max-w-[120px] truncate text-sm font-semibold text-slate-700 sm:inline">
                  {name}
                </span>
                <ChevronDown
                  className={
                    "h-4 w-4 text-slate-500 transition-transform duration-300 " +
                    (menuOpen ? "rotate-180" : "")
                  }
                />
              </button>
              {menuOpen && (
                <div className="rise-in absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200/80 bg-white py-1 shadow-float">
                  <div className="border-b border-slate-100 px-4 py-2.5">
                    <div className="truncate text-sm font-semibold text-slate-800">{name}</div>
                    <div className="truncate text-xs text-slate-500">{email}</div>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700"
                  >
                    <User className="h-4 w-4" /> Profile
                  </Link>
                  <button
                    onClick={signOut}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fade-in absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="slide-in absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-float">
            <div className="flex h-16 items-center justify-between border-b border-slate-200/80 px-4">
              <span className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-grad-brand shadow-brand">
                  <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" aria-hidden="true">
                    <path d="M12 3 21 7.5 12 12 3 7.5 12 3Z" fill="#fff" />
                    <path
                      d="M3 12.5 12 17l9-4.5V16l-9 4.5L3 16v-3.5Z"
                      fill="#fff"
                      fillOpacity="0.55"
                    />
                  </svg>
                </span>
                <span className="text-lg font-black tracking-tight text-slate-900">
                  Beyond<span className="text-blue-600">SAT</span>
                </span>
              </span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="tap grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {NAV.map((n) => {
                const active = pathname === n.to || pathname.startsWith(n.to + "/");
                const Icon = n.icon;
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={
                      "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold " +
                      (active
                        ? "bg-grad-brand text-white shadow-brand"
                        : "text-slate-600 nudge hover:bg-blue-50 hover:text-blue-700")
                    }
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {n.label}
                  </Link>
                );
              })}
              {isAdmin && (
                <Link
                  to="/admin"
                  className={
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold " +
                    (pathname.startsWith("/admin")
                      ? "bg-grad-brand text-white shadow-brand"
                      : "text-slate-600 nudge hover:bg-blue-50 hover:text-blue-700")
                  }
                >
                  <Shield className="h-5 w-5 shrink-0" />
                  Admin
                </Link>
              )}
            </nav>
          </aside>
        </div>
      )}

      {/* Main. Keyed on pathname so each navigation replays the entrance
          animation, which gives switching sections a sense of direction. */}
      <main className="pb-20 lg:pb-0 lg:pl-64">
        <div key={pathname} className="route-enter mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-10">
          {children}
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/90 backdrop-blur-md lg:hidden">
        <div className="grid grid-cols-5">
          {NAV.map((n) => {
            const active = pathname === n.to || pathname.startsWith(n.to + "/");
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={
                  "relative flex flex-col items-center justify-center py-2.5 text-[10px] font-semibold transition-colors duration-200 " +
                  (active ? "text-blue-600" : "text-slate-400 hover:text-slate-600")
                }
              >
                {/* Active pill sits behind the icon rather than tinting the
                    whole tab, so the bar stays light. */}
                {active && (
                  <span className="pop-in absolute top-1.5 h-7 w-12 rounded-full bg-blue-50" />
                )}
                <Icon
                  className={
                    "relative mb-0.5 h-5 w-5 transition-transform duration-300 " +
                    (active ? "scale-110" : "")
                  }
                />
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
