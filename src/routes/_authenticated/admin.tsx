import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  HelpCircle,
  CalendarDays,
  ClipboardList,
  Newspaper,
  Users,
  ArrowLeft,
  FileStack,
  Home,
  Settings,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/signin" });
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw redirect({ to: "/dashboard" });
  },
  component: AdminLayout,
  head: () => ({ meta: [{ title: "Admin — BeyondSAT" }] }),
});

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/homepage", label: "Homepage", icon: Home },
  { to: "/admin/questions", label: "Questions", icon: HelpCircle },
  { to: "/admin/tests", label: "Tests", icon: FileStack },
  { to: "/admin/daily", label: "Daily Tests", icon: CalendarDays },
  { to: "/admin/mocks", label: "Mock Exams", icon: ClipboardList },
  { to: "/admin/examdates", label: "Exam Dates", icon: CalendarDays },
  { to: "/admin/news", label: "News", icon: Newspaper },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = NAV.find((n) => (n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + "/")));

  return (
    <div className="min-h-screen bg-background flex text-slate-800">
      <aside className="w-64 shrink-0 border-r border-border bg-white flex flex-col sticky top-0 h-screen">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div>
            <div className="text-xl font-black text-primary tracking-tight leading-none">BeyondSAT</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">Admin Panel</div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + "/");
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition " +
                  (active ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-50 hover:text-primary")
                }
              >
                <Icon className="h-[18px] w-[18px]" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Back to app
          </Link>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-border">
          <div className="flex items-center justify-between px-6 h-16">
            <div>
              <h1 className="text-lg md:text-xl font-black text-primary tracking-tight">
                {current?.label ?? "Admin"}
              </h1>
            </div>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary uppercase tracking-wider">
              Admin
            </span>
          </div>
        </header>
        <div className="p-6 md:p-8 max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
