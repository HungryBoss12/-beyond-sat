import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { canEditorAccess, getStaffRole, EDITOR_HOME, type StaffRole } from "@/lib/admin";
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
  /* Runs again on every navigation within /admin, so it doubles as the
     per-section guard: filtering the sidebar hides links, it doesn't stop an
     editor from typing /admin/users into the address bar. */
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/signin" });
    const role = await getStaffRole(data.user.id);
    if (!role) throw redirect({ to: "/dashboard" });
    if (role === "editor" && !canEditorAccess(location.pathname)) {
      throw redirect({ to: EDITOR_HOME });
    }
    return { staffRole: role };
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
  /** Editors don't see this. Mirrors the guard in `beforeLoad`. */
  adminOnly?: boolean;
};

/** `as const` keeps each `to` a string literal so TanStack's <Link> accepts it;
    `satisfies` still checks every entry against the NavItem shape. */
const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true, group: "General", adminOnly: true },
  { to: "/admin/homepage", label: "Homepage", icon: Home, group: "General", adminOnly: true },
  { to: "/admin/questions", label: "Questions", icon: HelpCircle, group: "Content" },
  { to: "/admin/tests", label: "Tests", icon: FileStack, group: "Content", adminOnly: true },
  { to: "/admin/daily", label: "Daily Tests", icon: CalendarDays, group: "Content" },
  { to: "/admin/mocks", label: "Mock Exams", icon: ClipboardList, group: "Content" },
  { to: "/admin/examdates", label: "Exam Dates", icon: CalendarDays, group: "Content", adminOnly: true },
  { to: "/admin/news", label: "News", icon: Newspaper, group: "Content" },
  { to: "/admin/users", label: "Users", icon: Users, group: "Manage", adminOnly: true },
  { to: "/admin/settings", label: "Settings", icon: Settings, group: "Manage", adminOnly: true },
] as const satisfies readonly NavItem[];

function visibleNav(role: StaffRole) {
  return NAV.filter((n) => role === "admin" || !n.adminOnly);
}

function isActive(n: NavItem, pathname: string) {
  return n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + "/");
}

function AdminLayout() {
  const { staffRole } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const nav = visibleNav(staffRole);
  const current = nav.find((n) => isActive(n, pathname));

  return (
    <div className="flex min-h-screen bg-white">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-brand-400/30 bg-brand-600 lg:flex">
        <SidebarBody pathname={pathname} role={staffRole} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fade-in absolute inset-0 bg-brand-900/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="slide-in absolute inset-y-0 left-0 flex w-72 flex-col bg-brand-600 shadow-float">
            <SidebarBody
              pathname={pathname}
              role={staffRole}
              onNavigate={() => setDrawerOpen(false)}
            />
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1">
        {/* Top bar is a brand surface like the sidebar, so its controls use the
            lighter and darker steps to stay separable from it. */}
        <header className="sticky top-0 z-20 border-b border-brand-400/30 bg-brand-600/95 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setDrawerOpen(true)}
                className="tap grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-brand-400/50 text-white hover:bg-brand-400 lg:hidden"
                aria-label="Open admin menu"
              >
                <Menu className="h-4.5 w-4.5" />
              </button>
              <div className="min-w-0">
                {/* Breadcrumb keeps the group visible now that the sidebar can
                    be collapsed off-screen on mobile. */}
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-200">
                  {staffRole === "admin" ? "Admin" : "Editor"}
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-brand-100">{current?.group ?? "Content"}</span>
                </div>
                <h1
                  key={pathname}
                  className="slide-in truncate text-lg font-black tracking-tight text-white md:text-xl"
                >
                  {current?.label ?? "Admin"}
                </h1>
              </div>
            </div>
            {/* The badge is the only place the signed-in role is stated, so it
                reflects the real role rather than a hardcoded "Admin". */}
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-800 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white ring-1 ring-brand-400/50">
              <span className="pulse-ring h-1.5 w-1.5 rounded-full bg-brand-200" />
              {staffRole === "admin" ? "Admin" : "Editor"}
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
  role,
  onNavigate,
}: {
  pathname: string;
  role: StaffRole;
  onNavigate?: () => void;
}) {
  const nav = visibleNav(role);
  return (
    <>
      <div className="flex h-16 items-center justify-between gap-2.5 border-b border-brand-400/30 px-5">
        <Link
          to={role === "admin" ? "/admin" : EDITOR_HOME}
          onClick={onNavigate}
          className="group flex min-w-0 items-center gap-2.5"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-400 shadow-brand transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
            <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" aria-hidden="true">
              <path d="M12 3 21 7.5 12 12 3 7.5 12 3Z" fill="#fff" />
              <path d="M3 12.5 12 17l9-4.5V16l-9 4.5L3 16v-3.5Z" fill="#fff" fillOpacity="0.55" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-base font-black leading-none tracking-tight text-white">
              Beyond<span className="text-brand-200">SAT</span>
            </span>
            <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-brand-100">
              {role === "admin" ? "Admin Panel" : "Editor Panel"}
            </span>
          </span>
        </Link>
        {onNavigate && (
          <button
            onClick={onNavigate}
            className="tap grid h-8 w-8 shrink-0 place-items-center rounded-lg text-brand-100 hover:bg-brand-800"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto p-3.5">
        {NAV_GROUPS.map((group) => {
          const items = nav.filter((n) => n.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-brand-200">
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
                          ? "bg-brand-400 text-white shadow-brand"
                          : "text-brand-100 nudge hover:bg-brand-800 hover:text-white")
                      }
                    >
                      {/* Active marker rides the left edge of the pill. */}
                      {active && (
                        <span className="absolute -left-1.5 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-brand-200" />
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

      <div className="border-t border-brand-400/30 p-3.5">
        <Link
          to="/dashboard"
          onClick={onNavigate}
          className="group flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-brand-100 nudge hover:bg-brand-800 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
          Back to app
        </Link>
      </div>
    </>
  );
}
