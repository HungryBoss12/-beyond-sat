import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { LayoutGroup, motion } from "motion/react";
import { supabase } from "@/integrations/supabase/client";
import { canEditorAccess, getStaffRole, EDITOR_HOME, type StaffRole } from "@/lib/admin";
import { ArrowLeft, Menu, X, ChevronRight } from "lucide-react";
import { RevealLink } from "@/components/ui/reveal-card";
import { AdminNavIcon, type AdminAnim } from "@/components/admin/AdminNavIcon";

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
  anim: AdminAnim;
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
  {
    to: "/admin",
    label: "Overview",
    anim: "overview",
    exact: true,
    group: "General",
    adminOnly: true,
  },
  {
    to: "/admin/homepage",
    label: "Homepage",
    anim: "homepage",
    group: "General",
    adminOnly: true,
  },
  { to: "/admin/questions", label: "Questions", anim: "questions", group: "Content" },
  { to: "/admin/import", label: "Add tests", anim: "import", group: "Content" },
  { to: "/admin/tests", label: "Tests", anim: "tests", group: "Content" },
  { to: "/admin/daily", label: "Daily Tests", anim: "daily", group: "Content" },
  { to: "/admin/mocks", label: "Mock Exams", anim: "mocks", group: "Content" },
  {
    to: "/admin/examdates",
    label: "Exam Dates",
    anim: "examdates",
    group: "Content",
    adminOnly: true,
  },
  { to: "/admin/news", label: "News", anim: "news", group: "Content" },
  { to: "/admin/vocab", label: "Vocab", anim: "vocab", group: "Content" },
  { to: "/admin/classes", label: "Classes", anim: "classes", group: "Content" },
  { to: "/admin/users", label: "Users", anim: "users", group: "Manage", adminOnly: true },
  {
    to: "/admin/settings",
    label: "Settings",
    anim: "settings",
    group: "Manage",
    adminOnly: true,
  },
] as const satisfies readonly NavItem[];

function visibleNav(role: StaffRole) {
  /* `n` is annotated because `as const` gives each entry its own literal type,
     and the ones without `adminOnly` don't have the property at all — reading it
     off the union is an error. Widening to NavItem here doesn't widen the
     result: filter still returns the array's own element type, so `to` stays a
     literal and <Link> keeps accepting it. */
  return NAV.filter((n: NavItem) => role === "admin" || !n.adminOnly);
}

function isActive(n: NavItem, pathname: string) {
  return n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + "/");
}

function AdminLayout() {
  const { staffRole } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const current = visibleNav(staffRole).find((n) => isActive(n, pathname));

  return (
    <div className="min-h-screen bg-white text-brand-900 lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-brand-400/30 bg-brand-600 lg:flex">
        <SidebarBody pathname={pathname} role={staffRole} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-brand-900/50 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(100%,280px)] flex-col bg-brand-600 shadow-float">
            <SidebarBody
              pathname={pathname}
              role={staffRole}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-8">
          <button
            onClick={() => setOpen(true)}
            className="tap grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <span>Admin</span>
              {current && (
                <>
                  <ChevronRight className="h-3 w-3" />
                  <span className="truncate text-slate-600">{current.label}</span>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
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
  const [hoveredTo, setHoveredTo] = useState<string | null>(null);

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
        <LayoutGroup id="admin-nav">
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
                    const hovered = hoveredTo === n.to;
                    return (
                      <RevealLink
                        key={n.to}
                        to={n.to}
                        onClick={onNavigate}
                        onPointerEnter={() => setHoveredTo(n.to)}
                        onPointerLeave={() => setHoveredTo((cur) => (cur === n.to ? null : cur))}
                        className={
                          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold " +
                          (active
                            ? "bg-brand-400 text-white shadow-brand"
                            : "text-brand-100 nudge hover:text-white")
                        }
                      >
                        {!active && hovered && (
                          <motion.span
                            layoutId="admin-nav-hover"
                            className="pointer-events-none absolute inset-0 rounded-xl bg-white/10"
                            transition={{ type: "spring", stiffness: 420, damping: 32 }}
                          />
                        )}
                        {active && (
                          <span className="absolute -left-1.5 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-brand-200" />
                        )}
                        <span className="relative z-10">
                          <AdminNavIcon anim={n.anim} active={active} hovered={hovered} />
                        </span>
                        <span className="relative z-10">{n.label}</span>
                      </RevealLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </LayoutGroup>
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
