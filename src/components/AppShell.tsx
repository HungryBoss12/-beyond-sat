import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  BookOpen,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ScoreBadge } from "@/components/people/ScoreBadge";
import { getStaffRole, staffHome, type StaffRole } from "@/lib/admin";
import { displayAccountEmail } from "@/lib/auth/login-email";
import { pathAfterSignIn } from "@/lib/auth/after-sign-in";
import {
  listSavedAccounts,
  prepareAddAccount,
  signOutAll,
  signOutCurrent,
  switchToAccount,
  type SavedAccount,
} from "@/lib/auth/account-switcher";
import { liveStreak } from "@/lib/streak";
import { BrandMark } from "@/components/BrandMark";
import { loadNick } from "@/lib/profile-nick";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { NotificationAnchorProvider } from "@/components/notifications/NotificationAnchorContext";
import { AmbientGlow, RevealLink } from "@/components/ui/reveal-card";

/**
 * Desktop rail lists every destination. The mobile tab bar keeps five slots:
 * Dashboard, Practice, Lessons, Vocab, and More (Classes, Analysis, Beyond AI, Profile).
 */
const NAV = [
  { to: "/dashboard", label: "Dashboard", kind: "dashboard" },
  { to: "/practice", label: "Practice", kind: "practice", icon: BookOpen },
  { to: "/lessons", label: "Lessons", kind: "lessons" },
  { to: "/vocab", label: "Vocab", kind: "vocab" },
  { to: "/support-lessons", label: "Support", kind: "support" },
  { to: "/classes", label: "Classes", kind: "classes" },
  { to: "/analysis", label: "Analysis", kind: "analysis" },
  { to: "/beyond-ai", label: "Beyond AI", kind: "ai" },
  { to: "/profile", label: "Profile", kind: "profile" },
] as const;

const MOBILE_PRIMARY = NAV.filter((n) =>
  n.kind === "dashboard" || n.kind === "practice" || n.kind === "lessons" || n.kind === "vocab",
);
const MOBILE_MORE = NAV.filter((n) =>
  n.kind === "classes" || n.kind === "analysis" || n.kind === "ai" || n.kind === "profile" || n.kind === "support",
);

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

function StreakFlame({ lit, className }: { lit: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`streak-flame-mark shrink-0 ${lit ? "streak-flame-lit" : "streak-flame-cold"} ${className ?? ""}`}
    >
      <path
        className="streak-flame"
        d="M12 1.6c.2 3.2 2.2 5 3.4 6.6 1.5 2 2.8 3.6 2.8 6.3a6.2 6.2 0 0 1-12.4 0c0-2.4 1.1-4.2 2.4-6 .8-1.1 1.6-2.1 2-3.4.2 1.6.8 2.6 1.8 2.6 0-2.6-.4-4.6 0-6.1Z"
      />
      <path
        className="streak-flame-core"
        d="M12 11.2c.4 1.6 1.6 2.6 2.2 4 .7 1.5.6 3.2-.6 4.2-1 .8-2.4.6-3.2-.3-.9-1-.9-2.6-.2-3.8.5-.9 1.2-1.6 1.8-2.6Z"
      />
    </svg>
  );
}

function NavGlyph({
  icon: Icon,
  kind,
  active = false,
  className,
}: {
  icon?: LucideIcon;
  kind: NavKind;
  active?: boolean;
  className?: string;
}) {
  const cls = `nav-ico nav-ico-${kind} shrink-0 ${active ? "nav-ico-on" : ""} ${className ?? ""}`;

  if (kind === "dashboard") {
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden="true" fill="none">
        <rect
          className="nav-tile nav-tile-tl"
          x="3"
          y="3"
          width="8"
          height="10"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.7"
          fill={active ? "currentColor" : "none"}
        />
        <rect
          className="nav-tile nav-tile-bl"
          x="3"
          y="15"
          width="8"
          height="6"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.7"
          fill={active ? "currentColor" : "none"}
        />
        <rect
          className="nav-tile nav-tile-tr"
          x="13"
          y="3"
          width="8"
          height="6"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.7"
          fill={active ? "currentColor" : "none"}
        />
        <rect
          className="nav-tile nav-tile-br"
          x="13"
          y="11"
          width="8"
          height="10"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.7"
          fill={active ? "currentColor" : "none"}
        />
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
          <circle cx="8.2" cy="8" r="2.7" fill={active ? "currentColor" : "none"} />
          <path d="M3.4 18.4c.7-3.1 2.5-4.8 4.8-4.8 2.3 0 4.1 1.7 4.8 4.8" />
        </g>
        <g className="nav-class-b" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <circle cx="16.2" cy="8.4" r="2.35" fill={active ? "currentColor" : "none"} />
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
          fill={active ? "currentColor" : "none"}
          opacity={active ? 0.35 : 0.28}
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
          fill={active ? "currentColor" : "none"}
          opacity={active ? 0.55 : 0.52}
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
            fill={active ? "currentColor" : "none"}
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
            opacity={active ? 0 : 0.42}
          />
          <rect
            className="nav-vocab-highlight"
            x="6.3"
            y="9.35"
            width="5.8"
            height="1.55"
            rx="0.4"
            fill={active ? "var(--color-brand-400)" : "currentColor"}
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
            opacity={active ? 0 : 0.42}
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

  if (kind === "support") {
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden="true" fill="none">
        <g className="nav-ring" stroke="currentColor" strokeLinecap="round">
          <path d="M19.2 14.1A7.5 7.5 0 0 1 14.1 19.2" strokeWidth="2.35" />
          <path d="M9.9 19.2A7.5 7.5 0 0 1 4.8 14.1" strokeWidth="2.35" />
          <path d="M4.8 9.9A7.5 7.5 0 0 1 9.9 4.8" strokeWidth="2.35" />
          <path d="M14.1 4.8A7.5 7.5 0 0 1 19.2 9.9" strokeWidth="2.35" />
          <circle cx="12" cy="12" r="3.05" strokeWidth="1.55" fill={active ? "currentColor" : "none"} />
        </g>
        <g className="nav-ring-straps" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <line x1="12" y1="1.35" x2="12" y2="2.85" />
          <line x1="22.65" y1="12" x2="21.15" y2="12" />
          <line x1="12" y1="22.65" x2="12" y2="21.15" />
          <line x1="1.35" y1="12" x2="2.85" y2="12" />
        </g>
      </svg>
    );
  }

  if (kind === "lessons") {
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden="true" fill="none">
        <circle
          cx="12"
          cy="12"
          r="8.2"
          stroke="currentColor"
          strokeWidth="1.7"
          fill={active ? "currentColor" : "none"}
        />
        <g className="nav-lesson-play">
          <path
            d="M10.2 8.6v6.8l5.8-3.4-5.8-3.4Z"
            fill={active ? "var(--color-brand-400)" : "currentColor"}
          />
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
          fill={active ? "currentColor" : "none"}
        />
        <circle
          className="nav-profile-head"
          cx="12"
          cy="8"
          r="3.15"
          stroke="currentColor"
          strokeWidth="2"
          fill={active ? "var(--color-brand-400)" : "none"}
        />
        <path
          className="nav-profile-body"
          d="M6.4 19.2c.9-3.3 3.1-5.1 5.6-5.1s4.7 1.8 5.6 5.1"
          stroke={active ? "var(--color-brand-400)" : "currentColor"}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (!Icon) return null;
  return (
    <Icon
      aria-hidden="true"
      className={cls}
      fill={active ? "currentColor" : "none"}
      strokeWidth={active ? 1.75 : 2}
    />
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [name, setName] = useState<string>("");
  const [nick, setNick] = useState<string>("");
  const [badgeScore, setBadgeScore] = useState<number | null>(null);
  const [badgeLabel, setBadgeLabel] = useState<string | null>(null);
  const [badgeColor, setBadgeColor] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [streak, setStreak] = useState<number>(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreMounted, setMoreMounted] = useState(false);
  const [moreShown, setMoreShown] = useState(false);
  const [navOpen, setNavOpen] = useState(true);
  const [staffRole, setStaffRole] = useState<StaffRole | null>(null);
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [uid, setUid] = useState<string>("");
  const [switching, setSwitching] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const drawerTimer = useRef<number | null>(null);
  const moreTimer = useRef<number | null>(null);

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
      setUid(u.id);
      setEmail(displayAccountEmail(u.email) ?? "");
      const [{ data: prof }, { data: sp }, role] = await Promise.all([
        supabase.from("profiles").select("full_name,first_name,username,badge_score,badge_label,badge_color").eq("id", u.id).maybeSingle(),
        supabase
          .from("student_profiles")
          .select("current_streak,last_active_at,last_daily_completed_date")
          .eq("user_id", u.id)
          .maybeSingle(),
        getStaffRole(u.id),
      ]);
      setName(
        prof?.full_name ||
          prof?.first_name ||
          prof?.username ||
          displayAccountEmail(u.email)?.split("@")[0] ||
          "Student",
      );
      setNick(await loadNick(u.id).catch(() => ""));
      setBadgeScore(prof?.badge_score ?? null);
      setBadgeLabel(prof?.badge_label ?? null);
      setBadgeColor(prof?.badge_color ?? null);
      setStreak(liveStreak(sp));
      setStaffRole(role);
      setAccounts(listSavedAccounts());
    })();
  }, []);

  useEffect(() => {
    function onBadge(event: Event) {
      const detail = (event as CustomEvent<{ label: string | null; color: string | null }>).detail;
      if (!detail) return;
      setBadgeLabel(detail.label);
      setBadgeColor(detail.color);
    }
    window.addEventListener("beyondsat-badge", onBadge);
    return () => window.removeEventListener("beyondsat-badge", onBadge);
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

  function openMore() {
    if (moreTimer.current) window.clearTimeout(moreTimer.current);
    setMoreMounted(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setMoreShown(true));
    });
  }

  function closeMore() {
    setMoreShown(false);
    if (moreTimer.current) window.clearTimeout(moreTimer.current);
    moreTimer.current = window.setTimeout(() => {
      setMoreMounted(false);
      moreTimer.current = null;
    }, DRAWER_MS);
  }

  const skipDrawerClose = useRef(true);
  useEffect(() => {
    if (skipDrawerClose.current) {
      skipDrawerClose.current = false;
      return;
    }
    closeDrawer();
    closeMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (drawerTimer.current) window.clearTimeout(drawerTimer.current);
      if (moreTimer.current) window.clearTimeout(moreTimer.current);
    };
  }, []);

  async function signOut() {
    const next = await signOutCurrent();
    if (next) {
      window.location.assign(await pathAfterSignIn());
      return;
    }
    navigate({ to: "/signin", replace: true });
  }

  async function handleSwitch(userId: string) {
    if (userId === uid || switching) return;
    setSwitching(true);
    try {
      await switchToAccount(userId);
      window.location.assign(await pathAfterSignIn());
    } catch (err) {
      setSwitching(false);
      setAccounts(listSavedAccounts());
      alert((err as Error).message);
    }
  }

  async function handleAddAccount() {
    await prepareAddAccount();
    window.location.assign("/signin?add=1");
  }

  async function handleSignOutAll() {
    await signOutAll();
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
  const moreActive =
    moreShown ||
    currentNav === "admin" ||
    MOBILE_MORE.some((n) => n.to === currentNav);

  /* Phones never hover, so the glyph motions would stay frozen. Play each
     visible icon once on arrival, and again when More opens. */
  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (!window.matchMedia("(hover: none), (pointer: coarse)").matches) return;
    const timers: number[] = [];
    document.querySelectorAll<HTMLElement>("a.group, button.group").forEach((node, i) => {
      if (!node.querySelector(".nav-ico")) return;
      if (node.getClientRects().length === 0) return;
      timers.push(window.setTimeout(() => playNavMotion(node), 160 + i * 80));
    });
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [pathname, moreShown]);

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
            <NavGlyph
              icon={"icon" in n ? n.icon : undefined}
              kind={n.kind}
              active={active}
              className={opts.iconSize}
            />
            {n.label}
          </RevealLink>
        );
      })}
      {staffRole && (
        <RevealLink
          to={staffHome(staffRole)}
          data-nav-key="admin"
          onClick={opts.onNavigate}
          {...navPlayHandlers()}
          className={
            "group relative z-10 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 " +
            (currentNav === "admin" ? "text-white" : "text-brand-100 nudge hover:text-white")
          }
        >
          <NavGlyph
            icon={Shield}
            kind="admin"
            active={currentNav === "admin"}
            className={opts.iconSize}
          />
          {staffRole === "admin" ? "Admin" : staffRole === "teacher" ? "Teaching" : "Editor"}
        </RevealLink>
      )}
    </>
  );

  return (
    <NotificationAnchorProvider>
    <div className="relative isolate min-h-screen bg-white text-brand-900">
      <AmbientGlow />
      <aside
        className={
          "fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-brand-400/30 bg-brand-600 lg:flex " +
          "transition-transform duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] " +
          (navOpen ? "translate-x-0" : "pointer-events-none -translate-x-full")
        }
      >
        <div className="flex h-16 items-center border-b border-brand-400/30 px-6">
          <Link to="/dashboard" className="group flex min-w-0 items-center gap-2.5">
            <BrandMark className="h-8 w-8 shadow-brand transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3" />
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
          <div
            className={
              "flex items-center gap-2.5 rounded-xl px-3 py-2.5 ring-1 " +
              (streak > 0 ? "streak-pill-lit bg-brand-800" : "bg-brand-800 ring-1 ring-brand-400/40")
            }
          >
            <StreakFlame lit={streak > 0} className="h-5 w-5" />
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
            <div
              className={
                "inline-flex items-center gap-1.5 rounded-full border bg-brand-800 px-3 py-1.5 transition-transform duration-200 hover:scale-105 " +
                (streak > 0 ? "streak-pill-lit border-transparent" : "border-brand-400/50")
              }
            >
              <StreakFlame lit={streak > 0} className="h-4 w-4" />
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
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-400 text-xs font-bold text-white shadow-brand">
                  {initials}
                </span>
                <span className="hidden max-w-[220px] items-center gap-1.5 truncate text-sm font-semibold text-white sm:inline-flex">
                  <span className="truncate">{name}</span>
                  {nick ? <span className="truncate text-xs font-semibold text-brand-100">{nick}</span> : null}
                  <ScoreBadge score={badgeScore} label={badgeLabel} color={badgeColor} />
                </span>
                <ChevronDown
                  className={
                    "h-4 w-4 text-brand-100 transition-transform duration-300 " +
                    (menuOpen ? "rotate-180" : "")
                  }
                />
              </button>
              {menuOpen && (
                <div className="pop-in absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-brand-400/40 bg-brand-600 py-1 shadow-float">
                  <div className="border-b border-brand-400/30 px-4 py-2.5">
                    <div className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
                      <span className="truncate">{name}</span>
                      {nick ? <span className="truncate text-xs font-semibold text-brand-100">{nick}</span> : null}
                      <ScoreBadge score={badgeScore} label={badgeLabel} color={badgeColor} />
                    </div>
                    <div className="truncate text-xs text-brand-100">{email}</div>
                  </div>
                  {accounts.filter((a) => a.userId !== uid).length > 0 && (
                    <div className="stagger-fast border-b border-brand-400/30 py-1">
                      <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                        Switch account
                      </div>
                      {accounts
                        .filter((a) => a.userId !== uid)
                        .map((account) => (
                          <button
                            key={account.userId}
                            type="button"
                            disabled={switching}
                            onClick={() => void handleSwitch(account.userId)}
                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-white transition-all duration-200 hover:bg-brand-400 hover:pl-5 disabled:opacity-50"
                          >
                            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-400 text-[10px] font-bold">
                              {account.displayName.slice(0, 1).toUpperCase()}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate">{account.displayName}</span>
                              <span className="block truncate text-[11px] text-brand-100">
                                {account.username ? `@${account.username}` : account.email}
                              </span>
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-white transition-colors hover:bg-brand-400"
                  >
                    <User className="h-4 w-4" /> Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleAddAccount()}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-white transition-colors hover:bg-brand-400"
                  >
                    <Plus className="h-4 w-4" /> Add account
                  </button>
                  <button
                    onClick={() => void signOut()}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-brand-100 transition-colors hover:bg-brand-800 hover:text-white"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                  {accounts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => void handleSignOutAll()}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-brand-100 transition-colors hover:bg-brand-800 hover:text-white"
                    >
                      <LogOut className="h-4 w-4" /> Sign out all
                    </button>
                  )}
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
                <BrandMark className="h-8 w-8 shadow-brand" />
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

      {moreMounted && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button
            type="button"
            className={
              "absolute inset-0 bg-brand-900/50 backdrop-blur-sm transition-opacity duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] " +
              (moreShown ? "opacity-100" : "opacity-0")
            }
            aria-label="Close more destinations"
            onClick={closeMore}
          />
          <div
            role="dialog"
            aria-label="More"
            className={
              "absolute inset-x-0 bottom-[3.75rem] rounded-t-2xl border-t border-brand-400/30 bg-brand-600 px-3 pb-3 pt-2 shadow-float transition-transform duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] " +
              (moreShown ? "translate-y-0" : "translate-y-full")
            }
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/25" aria-hidden />
            <div className="grid grid-cols-4 gap-1">
              {MOBILE_MORE.map((n) => {
                const active = n.to === currentNav;
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    onClick={closeMore}
                    {...navPlayHandlers()}
                    className={
                      "group flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[11px] font-semibold " +
                      (active ? "bg-brand-400 text-white" : "text-brand-100 hover:bg-brand-800 hover:text-white")
                    }
                  >
                    <NavGlyph
                      icon={"icon" in n ? (n.icon as LucideIcon) : undefined}
                      kind={n.kind}
                      active={active}
                      className="h-5 w-5"
                    />
                    {n.label}
                  </Link>
                );
              })}
              {staffRole && (
                <RevealLink
                  to={staffHome(staffRole)}
                  onClick={closeMore}
                  {...navPlayHandlers()}
                  className={
                    "group flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[11px] font-semibold " +
                    (currentNav === "admin" ? "bg-brand-400 text-white" : "text-brand-100 hover:bg-brand-800 hover:text-white")
                  }
                >
                  <NavGlyph
                    icon={Shield}
                    kind="admin"
                    active={currentNav === "admin"}
                    className="h-5 w-5"
                  />
                  {staffRole === "admin" ? "Admin" : staffRole === "teacher" ? "Teaching" : "Editor"}
                </RevealLink>
              )}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 overflow-visible border-t border-brand-400/30 bg-brand-600/95 backdrop-blur-md lg:hidden">
        <div className="relative grid grid-cols-5 overflow-visible">
          {MOBILE_PRIMARY.map((n) => {
            const active = n.to === currentNav;
            return (
              <Link
                key={n.to}
                to={n.to}
                aria-label={n.label}
                onClick={closeMore}
                {...navPlayHandlers()}
                className={
                  "group relative z-10 flex min-w-0 items-center justify-center px-0.5 py-3 transition-colors duration-200 " +
                  (active ? "text-white" : "text-brand-100 hover:text-white")
                }
              >
                <NavGlyph
                  icon={"icon" in n ? n.icon : undefined}
                  kind={n.kind}
                  active={active}
                  className={
                    "relative h-6 w-6 transition-transform duration-300 " +
                    (active ? "scale-110" : "")
                  }
                />
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => (moreShown ? closeMore() : openMore())}
            className={
              "group relative z-10 flex min-w-0 items-center justify-center px-0.5 py-3 transition-colors duration-200 " +
              (moreActive ? "text-white" : "text-brand-100 hover:text-white")
            }
            aria-label="More"
            aria-expanded={moreShown}
            aria-haspopup="dialog"
          >
            <MoreHorizontal
              aria-hidden
              fill={moreActive ? "currentColor" : "none"}
              strokeWidth={moreActive ? 1.75 : 2}
              className={
                "relative h-6 w-6 transition-transform duration-300 " +
                (moreActive ? "scale-110" : "")
              }
            />
          </button>
        </div>
      </nav>
    </div>
    </NotificationAnchorProvider>
  );
}
