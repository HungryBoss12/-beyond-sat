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
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-slate-200 bg-white z-30">
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <span className="text-xl font-black text-blue-600 tracking-tight">BeyondSAT</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {NAV.map((n) => {
            const active = pathname === n.to || pathname.startsWith(n.to + "/");
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition " +
                  (active
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-600 hover:bg-slate-50 hover:text-blue-600")
                }
              >
                <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                {n.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              to="/admin"
              className={
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition " +
                (pathname.startsWith("/admin")
                  ? "bg-blue-50 text-blue-600"
                  : "text-slate-600 hover:bg-slate-50 hover:text-blue-600")
              }
            >
              <Shield className="h-[18px] w-[18px]" />
              Admin
            </Link>
          )}
        </nav>
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2.5">
            <Flame className="h-5 w-5 text-orange-500 fill-orange-500" />
            <div>
              <div className="text-lg font-black text-orange-600 leading-none">{streak}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-orange-500/80">
                day streak
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-primary/95 text-white backdrop-blur lg:pl-64">
        <div className="mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden inline-flex items-center justify-center rounded-lg border border-slate-200 h-9 w-9 text-slate-600"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="lg:hidden text-lg font-black text-white">BeyondSAT</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-100 px-3 py-1.5">
              <Flame className="h-4 w-4 text-orange-500 fill-orange-500" />
              <span className="text-sm font-bold text-orange-600 tabular-nums">{streak}</span>
              <span className="hidden sm:inline text-xs font-semibold text-orange-500/80">
                day{streak === 1 ? "" : "s"}
              </span>
            </div>
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2 hover:border-blue-600/40 transition"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-white text-xs font-bold">
                  {initials}
                </span>
                <span className="hidden sm:inline text-sm font-semibold text-slate-700 max-w-[120px] truncate">
                  {name}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-lg py-1">
                  <div className="px-4 py-2 border-b border-slate-200">
                    <div className="text-sm font-semibold text-slate-800 truncate">{name}</div>
                    <div className="text-xs text-slate-500 truncate">{email}</div>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <User className="h-4 w-4" /> Profile
                  </Link>
                  <button
                    onClick={signOut}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
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
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-primary flex flex-col">
            <div className="h-16 flex items-center justify-between px-4 border-b border-white/20">
              <span className="text-lg font-black text-white">BeyondSAT</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg h-9 w-9 grid place-items-center text-white hover:bg-white/10"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {NAV.map((n) => {
                const active = pathname === n.to || pathname.startsWith(n.to + "/");
                const Icon = n.icon;
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition " +
                      (active ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10 hover:text-white")
                    }
                  >
                    <Icon className="h-5 w-5" />
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="lg:pl-64 pb-20 lg:pb-0">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 md:py-10">{children}</div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-primary border-t border-slate-200">
        <div className="grid grid-cols-4">
          {NAV.map((n) => {
            const active = pathname === n.to || pathname.startsWith(n.to + "/");
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={
                  "flex flex-col items-center justify-center py-2.5 text-[11px] font-semibold " +
                  (active ? "text-white" : "text-white/60")
                }
              >
                <Icon className="h-5 w-5 mb-0.5" />
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
