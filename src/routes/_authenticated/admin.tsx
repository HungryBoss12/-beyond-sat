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
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true, group: "General" },
  { to: "/admin/homepage", label: "Homepage", icon: Home, group: "General" },
  { to: "/admin/questions", label: "Questions", icon: HelpCircle, group: "Content" },
  { to: "/admin/tests", label: "Tests", icon: FileStack, group: "Content" },
  { to: "/admin/daily", label: "Daily Tests", icon: CalendarDays, group: "Content" },
  { to: "/admin/mocks", label: "Mock Exams", icon: ClipboardList, group: "Content" },
  { to: "/admin/examdates", label: "Exam Dates", icon: CalendarDays, group: "Content" },
  { to: "/admin/news", label: "News", icon: Newspaper, group: "Content" },
  { to: "/admin/users", label: "Users", icon: Users, group: "Manage" },
  { to: "/admin/settings", label: "Settings", icon: Settings, group: "Manage" },
];

/** Nav order defines section order; labels group the sidebar links. */
const NAV_GROUPS = ["General", "Content", "Manage"] as const;

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = NAV.find((n) => (n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + "/")));

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-800">
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col sticky top-0 h-screen">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-slate-200">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-600">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
              <path d="M12 3 21 7.5 12 12 3 7.5 12 3Z" fill="#fff" />
              <path d="M3 12.5 12 17l9-4.5V16l-9 4.5L3 16v-3.5Z" fill="#fff" fillOpacity="0.55" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="text-base font-black tracking-tight leading-none text-slate-900">
              Beyond<span className="text-blue-600">SAT</span>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
              Admin Panel
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto p-4">
          {NAV_GROUPS.map((group) => {
            const items = NAV.filter((n) => n.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {group}
                </div>
                <div className="space-y-0.5">
                  {items.map((n) => {
                    const active = n.exact
                      ? pathname === n.to
                      : pathname === n.to || pathname.startsWith(n.to + "/");
                    const Icon = n.icon;
                    return (
                      <Link
                        key={n.to}
                        to={n.to}
                        className={
                          "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-200 " +
                          (active
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-slate-600 hover:translate-x-0.5 hover:bg-blue-50 hover:text-blue-700")
                        }
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        {n.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
          >
            <ArrowLeft className="h-4 w-4" /> Back to app
          </Link>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex h-16 items-center justify-between px-6">
            <div className="min-w-0">
              <h1 className="truncate text-lg md:text-xl font-black tracking-tight text-slate-900">
                {current?.label ?? "Admin"}
              </h1>
              <p className="text-[11px] text-slate-400">{current?.group ?? "General"}</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-700">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 pulse-ring" />
              Admin
            </span>
          </div>
        </header>
        <div key={pathname} className="max-w-6xl p-6 md:p-8 rise-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
