import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  BookOpen,
  User,
  Flame,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getStaffRole, EDITOR_HOME, type StaffRole } from "@/lib/admin";
import { scrollWindowToTop } from "@/lib/smooth-scroll";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { NotificationAnchorProvider } from "@/components/notifications/NotificationAnchorContext";
import { RevealLink } from "@/components/ui/reveal-card";

/**
 * Seven items fit the mobile tab bar at `grid-cols-7` with truncated labels.
 * Vocab sits between Practice and Classes as its own primary section.
 */
const NAV = [
  { to: "/dashboard", label: "Dashboard", kind: "dashboard" },
  { to: "/practice", label: "Practice", kind: "practice", icon: BookOpen },
  { to: "/vocab", label: "Vocab", kind: "vocab" },
  { to: "/classes", label: "Classes", kind: "classes" },
  { to: "/analysis", label: "Analysis", kind: "analysis" },
  { to: "/beyond-ai", label: "Beyond AI", kind: "ai" },
  { to: "/profile", label: "Profile", kind: "profile" },
] as const;

const NAV_OPEN_KEY = "beyond-sat-nav-open";
const DRAWER_MS = 450;

type NavKind = (typeof NAV)[number]["kind"] | "admin";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Fresh random bar heights each hover/tap so Analysis never repeats a script. */
function scrambleAnalysisBars(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>(".nav-bar").forEach((bar) => {
    bar.style.setProperty("--bar-a", String(0.35 + Math.random() * 1.35));
    bar.style.setProperty("--bar-b", String(0.3 + Math.random() * 1.25));
  });
}

function playNavMotion(target: HTMLElement) {
  if (prefersReducedMotion()) return;
  scrambleAnalysisBars(target);
  target.removeAttribute("data-nav-play");
  void target.offsetWidth;
  target.setAttribute("data-nav-play", "");
  window.setTimeout(() => target.removeAttribute("data-nav-play"), 900);
}

function navPlayHandlers() {
  return {
    onPointerEnter: (e: React.PointerEvent<HTMLElement>) => playNavMotion(e.currentTarget),
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => playNavMotion(e.currentTarget),
  };
}

function useSlidingHighlight(activeKey: string) {
  const parentRef = useRef<HTMLElement | null>(null);
  const [box, setBox] = useState({ top: 0, left: 0, width: 0, height: 0, ready: false });

  useLayoutEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    function measure() {
      if (!parent) return;
      const el = parent.querySelector<HTMLElement>(`[data-nav-key="${activeKey}"]`);
      if (!el) return;
      setBox({
        top: el.offsetTop,
        left: el.offsetLeft,
        width: el.offsetWidth,
        height: el.offsetHeight,
        ready: true,
      });
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    const mo = new MutationObserver(measure);
    mo.observe(parent, { childList: true, subtree: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [activeKey]);

  return { parentRef, box };
}

function activeNavKey(pathname: string, staff: StaffRole | null): string {
  const hit = NAV.find((n) => pathname === n.to || pathname.startsWith(n.to + "/"));
  if (hit) return hit.to;
  if (staff && pathname.startsWith("/admin")) return "admin";
  return NAV[0].to;
}

function NavGlyph({
  icon: Icon,
  kind,
  className,
}: {
  icon?: LucideIcon;
  kind: NavKind;
  className?: string;
}) {
  const cls = `nav-ico nav-ico-${kind} shrink-0 ${className ?? ""}`;

  if (kind === "dashboard") {
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden="true" fill="currentColor">
        <rect className="nav-tile nav-tile-tl" x="3" y="3" width="8" height="10" rx="1.5" />
        <rect className="nav-tile nav-tile-bl" x="3" y="15" width="8" height="6" rx="1.5" />
        <rect className="nav-tile nav-tile-tr" x="13" y="3" width="8" height="6" rx="1.5" />
        <rect className="nav-tile nav-tile-br" x="13" y="11" width="8" height="10" rx="1.5" />
      </svg>
    );
  }

  if (kind === "analysis") {
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden="true">
        <path
          d="M4 5v14h16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect className="nav-bar" x="7" y="13" width="2.4" height="6" rx="0.5" fill="currentColor" />
        <rect className="nav-bar" x="11.3" y="9" width="2.4" height="10" rx="0.5" fill="currentColor" />
        <rect className="nav-bar" x="15.6" y="6.5" width="2.4" height="12.5" rx="0.5" fill="currentColor" />
      </svg>
    );
  }

  if (kind === "classes") {
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden="true" fill="none">
        <g className="nav-class-a" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <circle cx="8.2" cy="8" r="2.7" />
          <path d="M3.4 18.4c.7-3.1 2.5-4.8 4.8-4.8 2.3 0 4.1 1.7 4.8 4.8" />
        </g>
        <g className="nav-class-b" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <circle cx="16.2" cy="8.4" r="2.35" />
          <path d="M12.4 18.4c.6-2.6 2.1-4.1 3.8-4.1 1.7 0 3.2 1.5 3.8 4.1" />
        </g>
      </svg>
    );
  }

  if (kind === "ai") {
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden="true" fill="currentColor">
        <path
          className="nav-star-sm nav-star-a"
          d="M6 4.2 6.7 6.2 8.7 7 6.7 7.8 6 9.8 5.3 7.8 3.3 7 5.3 6.2Z"
        />
        <path
          className="nav-star-sm nav-star-b"
          d="M18.6 13.2 19.5 15.6 22 16.5 19.5 17.4 18.6 19.8 17.7 17.4 15.2 16.5 17.7 15.6Z"
        />
        <path
          className="nav-star-lg"
          d="M12 3.2 13.85 8.15 19 10 13.85 11.85 12 16.8 10.15 11.85 5 10 10.15 8.15Z"
        />
      </svg>
    );
  }

  if (kind === "vocab") {
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden="true" fill="none">
        <rect
          className="nav-vocab-deck nav-vocab-deck-2"
          x="6.2"
          y="5.4"
          width="11.5"
          height="13.5"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.35"
          opacity="0.28"
        />
        <rect
          className="nav-vocab-deck nav-vocab-deck-1"
          x="5.1"
          y="4.3"
          width="11.5"
          height="13.5"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.35"
          opacity="0.52"
        />
        <g className="nav-vocab-front">
          <rect
            x="4"
            y="3.2"
            width="11.5"
            height="13.5"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <line
            className="nav-vocab-line nav-vocab-line-a"
            x1="6.3"
            y1="7.2"
            x2="13.2"
            y2="7.2"
            stroke="currentColor"
            strokeWidth="1.15"
            strokeLinecap="round"
            opacity="0.42"
          />
          <rect
            className="nav-vocab-highlight"
            x="6.3"
            y="9.35"
            width="5.8"
            height="1.55"
            rx="0.4"
            fill="currentColor"
          />
          <line
            className="nav-vocab-line nav-vocab-line-b"
            x1="6.3"
            y1="12.4"
            x2="10.8"
            y2="12.4"
            stroke="currentColor"
            strokeWidth="1.15"
            strokeLinecap="round"
            opacity="0.42"
          />
        </g>
        <g className="nav-vocab-srs" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path
            className="nav-vocab-srs-arc"
            d="M16.8 16.1a3.15 3.15 0 1 0-2.45-3.05"
            strokeWidth="1.35"
            fill="none"
          />
          <path className="nav-vocab-srs-tip" d="M14.1 12.4l-.15 1.85 1.65-.55" strokeWidth="1.2" fill="none" />
        </g>
      </svg>
    );
  }

  if (kind === "profile") {
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden="true" fill="none">
        <circle
          className="nav-profile-ring"
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <circle
          className="nav-profile-head"
          cx="12"
          cy="8"
          r="3.15"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          className="nav-profile-body"
          d="M6.4 19.2c.9-3.3 3.1-5.1 5.6-5.1s4.7 1.8 5.6 5.1"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (!Icon) return null;
  return <Icon aria-hidden="true" className={cls} />;
}

function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "h-[17px] w-[17px]"} aria-hidden="true">
      <path d="M12 3 21 7.5 12 12 3 7.5 12 3Z" fill="#fff" />
      <path d="M3 12.5 12 17l9-4.5V16l-9 4.5L3 16v-3.5Z" fill="#fff" fillOpacity="0.55" />
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const historyAction = useRouterState({ select: (s) => s.historyAction });
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [streak, setStreak] = useState<number>(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(true);
  const [staffRole, setStaffRole] = useState<StaffRole | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const drawerTimer = useRef<number | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(NAV_OPEN_KEY);
      if (stored === "0") setNavOpen(false);
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) return;
      setEmail(u.email ?? "");
      const [{ data: prof }, { data: sp }, role] = await Promise.all([
        supabase.from("profiles").select("full_name,first_name").eq("id", u.id).maybeSingle(),
        supabase
          .from("student_profiles")
          .select("current_streak")
          .eq("user_id", u.id)
          .maybeSingle(),
        getStaffRole(u.id),
      ]);
      setName(prof?.full_name || prof?.first_name || u.email?.split("@")[0] || "Student");
      setStreak(sp?.current_streak ?? 0);
      setStaffRole(role);
    })();
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function persistNavOpen(next: boolean) {
    setNavOpen(next);
    try {
      localStorage.setItem(NAV_OPEN_KEY, next ? "1" : "0");
    } catch {
      /* private mode */
    }
  }

  function openDrawer() {
    if (drawerTimer.current) window.clearTimeout(drawerTimer.current);
    setDrawerMounted(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setDrawerOpen(true));
    });
  }

  function closeDrawer() {
    setDrawerOpen(false);
    if (drawerTimer.current) window.clearTimeout(drawerTimer.current);
    drawerTimer.current = window.setTimeout(() => {
      setDrawerMounted(false);
      drawerTimer.current = null;
    }, DRAWER_MS);
  }

  const skipDrawerClose = useRef(true);
  useEffect(() => {
    if (skipDrawerClose.current) {
      skipDrawerClose.current = false;
      return;
    }
    closeDrawer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (historyAction === "POP") return;
    scrollWindowToTop();
  }, [pathname, historyAction]);

  useEffect(() => {
    return () => {
      if (drawerTimer.current) window.clearTimeout(drawerTimer.current);
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/signin", replace: true });
  }

  const initials =
    name
      .split(" ")
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "S";

  const padClass = navOpen ? "lg:pl-64" : "lg:pl-0";
  const shellShift =
    "transition-[padding] duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] " + padClass;
  const currentNav = activeNavKey(pathname, staffRole);
  const rail = useSlidingHighlight(currentNav);
  const mobileIdx = NAV.findIndex((n) => n.to === currentNav);

  const navLinks = (opts: { onNavigate?: () => void; iconSize: string }) => (
    <>
      {NAV.map((n) => {
        const active = n.to === currentNav;
        return (
          <RevealLink
            key={n.to}
            to={n.to}
            data-nav-key={n.to}
            onClick={opts.onNavigate}
            {...navPlayHandlers()}
            className={
              "group relative z-10 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 " +
              (active ? "text-white" : "text-brand-100 nudge hover:text-white")
            }
          >
            <NavGlyph icon={"icon" in n ? n.icon : undefined} kind={n.kind} className={opts.iconSize} />
            {n.label}
          </RevealLink>
        );
      })}
      {staffRole && (
        <RevealLink
          to={staffRole === "admin" ? "/admin" : EDITOR_HOME}
          data-nav-key="admin"
          onClick={opts.onNavigate}
          {...navPlayHandlers()}
          className={
            "group relative z-10 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 " +
            (currentNav === "admin" ? "text-white" : "text-brand-100 nudge hover:text-white")
          }
        >
          <NavGlyph icon={Shield} kind="admin" className={opts.iconSize} />
          {staffRole === "admin" ? "Admin" : "Editor"}
        </RevealLink>
      )}
    </>
  );

  return (
    <NotificationAnchorProvider>
    <div className="min-h-screen bg-white text-brand-900">
      <aside
        className={
          "fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-brand-400/30 bg-brand-600 lg:flex " +
          "transition-transform duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] " +
          (navOpen ? "translate-x-0" : "pointer-events-none -translate-x-full")
        }
      >
        <div className="flex h-16 items-center border-b border-brand-400/30 px-6">
          <Link to="/dashboard" className="group flex min-w-0 items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-400 shadow-brand transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
              <BrandMark />
            </span>
            <span className="truncate text-lg font-black tracking-tight text-white">
              Beyond<span className="text-brand-200">SAT</span>
            </span>
          </Link>
        </div>
        <nav ref={rail.parentRef} className="relative flex-1 space-y-1 p-4">
          {rail.box.ready && (
            <span
              aria-hidden
              className="nav-rail-pill pointer-events-none absolute rounded-xl bg-brand-400 shadow-brand"
              style={{
                top: rail.box.top,
                left: rail.box.left,
                width: rail.box.width,
                height: rail.box.height,
              }}
            />
          )}
          {navLinks({ iconSize: "h-[18px] w-[18px]" })}
        </nav>
        <div className="border-t border-brand-400/30 p-4">
          <div className="flex items-center gap-2.5 rounded-xl bg-brand-800 px-3 py-2.5 ring-1 ring-brand-400/40">
            <Flame className="h-5 w-5 fill-brand-200 text-brand-200" />
            <div>
              <div className="text-lg font-black leading-none text-white tabular-nums">{streak}</div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-100">
                day streak
              </div>
            </div>
          </div>
        </div>
      </aside>

      <header
        className={
          "sticky top-0 z-20 border-b border-brand-400/30 bg-brand-600/95 backdrop-blur-md " + shellShift
        }
      >
        <div className="mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openDrawer}
              className="tap grid h-9 w-9 place-items-center rounded-lg border border-brand-400/50 text-white transition-colors duration-200 hover:bg-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => persistNavOpen(!navOpen)}
              className="tap hidden h-9 w-9 place-items-center rounded-lg border border-brand-400/50 text-white transition-colors duration-200 hover:bg-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 lg:grid"
              aria-label={navOpen ? "Close menu" : "Open menu"}
              aria-expanded={navOpen}
            >
              {navOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
            </button>
            <span className="text-lg font-black tracking-tight text-white lg:hidden">
              Beyond<span className="text-brand-200">SAT</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {pathname === "/dashboard" ? <NotificationBell /> : null}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-brand-400/50 bg-brand-800 px-3 py-1.5 transition-transform duration-200 hover:scale-105">
              <Flame className="h-4 w-4 fill-brand-200 text-brand-200" />
              <span className="text-sm font-bold tabular-nums text-white">{streak}</span>
              <span className="hidden text-xs font-semibold text-brand-100 sm:inline">
                day{streak === 1 ? "" : "s"}
              </span>
            </div>
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="btn-ghost inline-flex items-center gap-2 rounded-full border border-brand-400/50 bg-brand-800 py-1 pl-1 pr-2"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-400 text-xs font-bold text-white">
                  {initials}
                </span>
                <span className="hidden max-w-[120px] truncate text-sm font-semibold text-white sm:inline">
                  {name}
                </span>
                <ChevronDown
                  className={
                    "h-4 w-4 text-brand-100 transition-transform duration-300 " +
                    (menuOpen ? "rotate-180" : "")
                  }
                />
              </button>
              {menuOpen && (
                <div className="rise-in absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-brand-400/40 bg-brand-600 py-1 shadow-float">
                  <div className="border-b border-brand-400/30 px-4 py-2.5">
                    <div className="truncate text-sm font-semibold text-white">{name}</div>
                    <div className="truncate text-xs text-brand-100">{email}</div>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-white transition-colors hover:bg-brand-400"
                  >
                    <User className="h-4 w-4" /> Profile
                  </Link>
                  <button
                    onClick={signOut}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-brand-100 transition-colors hover:bg-brand-800 hover:text-white"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {drawerMounted && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className={
              "absolute inset-0 bg-brand-900/60 backdrop-blur-sm transition-opacity duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] " +
              (drawerOpen ? "opacity-100" : "opacity-0")
            }
            onClick={closeDrawer}
          />
          <aside
            className={
              "absolute inset-y-0 left-0 flex w-72 flex-col bg-brand-600 shadow-float transition-transform duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] " +
              (drawerOpen ? "translate-x-0" : "-translate-x-full")
            }
          >
            <div className="flex h-16 items-center justify-between border-b border-brand-400/30 px-4">
              <span className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-400 shadow-brand">
                  <BrandMark />
                </span>
                <span className="text-lg font-black tracking-tight text-white">
                  Beyond<span className="text-brand-200">SAT</span>
                </span>
              </span>
              <button
                type="button"
                onClick={closeDrawer}
                className="tap grid h-9 w-9 place-items-center rounded-lg text-brand-100 hover:bg-brand-800"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {navLinks({ onNavigate: closeDrawer, iconSize: "h-5 w-5" })}
            </nav>
          </aside>
        </div>
      )}

      <main className={"pb-20 lg:pb-0 " + shellShift}>
        <div key={pathname} className="route-enter mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-10">
          {children}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-400/30 bg-brand-600/95 backdrop-blur-md lg:hidden">
        <div className="relative grid grid-cols-7">
          <span
            aria-hidden
            className="nav-tab-pill pointer-events-none absolute top-1.5 left-0 flex w-[calc(100%/7)] justify-center"
            style={{
              transform: `translateX(${Math.max(0, mobileIdx) * 100}%)`,
              opacity: mobileIdx < 0 ? 0 : 1,
            }}
          >
            <span className="h-7 w-12 rounded-full bg-brand-400" />
          </span>
          {NAV.map((n) => {
            const active = n.to === currentNav;
            return (
              <Link
                key={n.to}
                to={n.to}
                {...navPlayHandlers()}
                className={
                  "group relative z-10 flex min-w-0 flex-col items-center justify-center px-0.5 py-2.5 text-[10px] font-semibold transition-colors duration-200 " +
                  (active ? "text-white" : "text-brand-100 hover:text-white")
                }
              >
                <NavGlyph
                  icon={"icon" in n ? n.icon : undefined}
                  kind={n.kind}
                  className={
                    "relative mb-0.5 h-5 w-5 transition-transform duration-300 " +
                    (active ? "scale-110" : "")
                  }
                />
                <span className="w-full truncate text-center leading-tight">{n.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
    </NotificationAnchorProvider>
  );
}
