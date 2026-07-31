import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
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
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

/** Nav order defines section order; labels group the sidebar links. */
const NAV_GROUPS = ["General", "Content", "Manage"] as const;

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  group: (typeof NAV_GROUPS)[number];
  /** Match the path exactly. Needed for "/admin", which is a prefix of every
      other admin route and would otherwise always look active. */
  exact?: boolean;
};

/** `as const` keeps each `to` a string literal so TanStack's <Link> accepts it;
    `satisfies` still checks every entry against the NavItem shape. */
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
] as const satisfies readonly NavItem[];

function isActive(n: NavItem, pathname: string) {
  return n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + "/");
}

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const current = NAV.find((n) => isActive(n, pathname));

  return (
    <div className="flex min-h-screen bg-slate-50/70 text-slate-800">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white lg:flex">
        <SidebarBody pathname={pathname} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fade-in absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="slide-in absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-float">
            <SidebarBody pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setDrawerOpen(true)}
                className="tap grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden"
                aria-label="Open admin menu"
              >
                <Menu className="h-4.5 w-4.5" />
              </button>
              <div className="min-w-0">
                {/* Breadcrumb keeps the group visible now that the sidebar can
                    be collapsed off-screen on mobile. */}
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Admin
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-slate-500">{current?.group ?? "General"}</span>
                </div>
                <h1
                  key={pathname}
                  className="slide-in truncate text-lg font-black tracking-tight text-slate-900 md:text-xl"
                >
                  {current?.label ?? "Admin"}
                </h1>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700 ring-1 ring-blue-600/10">
              <span className="pulse-ring h-1.5 w-1.5 rounded-full bg-blue-600" />
              Admin
            </span>
          </div>
        </header>

        {/* Keyed on pathname so every navigation replays the entrance. */}
        <div key={pathname} className="route-enter max-w-6xl p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

/** Sidebar contents, shared by the desktop rail and the mobile drawer. */
function SidebarBody({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="flex h-16 items-center justify-between gap-2.5 border-b border-slate-200/80 px-5">
        <Link to="/admin" onClick={onNavigate} className="group flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-grad-brand shadow-brand transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
            <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" aria-hidden="true">
              <path d="M12 3 21 7.5 12 12 3 7.5 12 3Z" fill="#fff" />
              <path d="M3 12.5 12 17l9-4.5V16l-9 4.5L3 16v-3.5Z" fill="#fff" fillOpacity="0.55" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-base font-black leading-none tracking-tight text-slate-900">
              Beyond<span className="text-blue-600">SAT</span>
            </span>
            <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Admin Panel
            </span>
          </span>
        </Link>
        {onNavigate && (
          <button
            onClick={onNavigate}
            className="tap grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto p-3.5">
        {NAV_GROUPS.map((group) => {
          const items = NAV.filter((n) => n.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                {group}
              </div>
              <div className="space-y-0.5">
                {items.map((n) => {
                  const active = isActive(n, pathname);
                  const Icon = n.icon;
                  return (
                    <Link
                      key={n.to}
                      to={n.to}
                      onClick={onNavigate}
                      className={
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold " +
                        (active
                          ? "bg-grad-brand text-white shadow-brand"
                          : "text-slate-600 nudge hover:bg-blue-50 hover:text-blue-700")
                      }
                    >
                      {/* Active marker rides the left edge of the pill. */}
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
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-200/80 p-3.5">
        <Link
          to="/dashboard"
          onClick={onNavigate}
          className="group flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-500 nudge hover:bg-blue-50 hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
          Back to app
        </Link>
      </div>
    </>
  );
}
