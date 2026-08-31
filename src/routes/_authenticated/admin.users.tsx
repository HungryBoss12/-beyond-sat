import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Ban, ChevronRight, CircleCheck, Search } from "lucide-react";
import { format } from "date-fns";
import { ListSkeleton } from "@/components/ui/skeletons";
import { getStaffRole } from "@/lib/admin";
import { fetchAdminUsersSummary, type AdminUserSummaryRow } from "@/lib/admin/users";
import { isOnline, lastSeenLabel } from "@/lib/presence";
import { errorMessage } from "@/lib/utils";

type Role = "student" | "editor" | "admin";
type Filter = "all" | "online" | "staff" | "banned";
type SortKey = "created_at" | "tests_total" | "last_seen";

type UserRow = AdminUserSummaryRow & { role: Role };

function missingObject(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code && ["42883", "42703", "42P01", "PGRST202"].includes(error.code)) return true;
  return /does not exist|could not find/i.test(error.message ?? "");
}

export const Route = createFileRoute("/_authenticated/admin/users")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/signin" });
    if ((await getStaffRole(data.user.id)) !== "admin") throw redirect({ to: "/admin/questions" });
  },
  component: AdminUsers,
});

function AdminUsers() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [insightsReady, setInsightsReady] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const summary = await fetchAdminUsersSummary();
      if (!summary.migrationReady) {
        setInsightsReady(false);
        await loadLegacyUsers();
        return;
      }
      setInsightsReady(true);
      if (summary.error) throw new Error(summary.error);
      setRows(
        summary.rows.map((r) => ({
          ...r,
          role: (r.role as Role) || "student",
        })),
      );
    } catch (e: unknown) {
      setErr(errorMessage(e, "Could not load users."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  async function loadLegacyUsers() {
    const FULL_COLS = "id,email,full_name,created_at,last_seen_at,banned";
    const full = await supabase
      .from("profiles")
      .select(FULL_COLS)
      .order("created_at", { ascending: false })
      .limit(500);
    if (full.error) throw full.error;
    const { data: roles } = await supabase.from("user_roles").select("user_id,role");
    const roleOf = new Map<string, Role>();
    for (const r of (roles ?? []) as { user_id: string; role: string }[]) {
      if (r.role === "admin") roleOf.set(r.user_id, "admin");
      else if (r.role === "editor" && roleOf.get(r.user_id) !== "admin")
        roleOf.set(r.user_id, "editor");
    }
    setRows(
      (full.data ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        created_at: p.created_at,
        last_seen_at: p.last_seen_at ?? null,
        banned: !!p.banned,
        role: roleOf.get(p.id) ?? "student",
        tests_total: 0,
        tests_mock: 0,
        tests_daily: 0,
        tests_practice: 0,
        current_streak: 0,
        last_active_at: null,
        class_name: null,
        accuracy_pct: null,
      })),
    );
  }

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  async function setRole(u: UserRow, role: Role) {
    if (role === u.role) return;
    if (u.role === "admin" && !confirm(`Remove admin from ${u.email}?`)) return;
    setBusy(u.id);
    const { error } = await supabase.rpc("admin_set_role", { p_user_id: u.id, p_role: role });
    setBusy(null);
    if (error) {
      alert(error.message);
      return;
    }
    load();
  }

  async function toggleBan(u: UserRow) {
    let reason: string | null = null;
    if (!u.banned) {
      reason = prompt(`Ban ${u.email}? Optional reason:`, "");
      if (reason === null) return;
    } else if (!confirm(`Unban ${u.email}?`)) {
      return;
    }
    setBusy(u.id);
    const { error } = await supabase.rpc("admin_set_banned", {
      p_user_id: u.id,
      p_banned: !u.banned,
      p_reason: reason || null,
    });
    setBusy(null);
    if (error) {
      alert(missingObject(error) ? "Banning needs the editor-role migration." : error.message);
      return;
    }
    load();
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const needle = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    let list = rows.filter((r) => {
      if (
        needle &&
        !(r.email ?? "").toLowerCase().includes(needle) &&
        !(r.full_name ?? "").toLowerCase().includes(needle)
      )
        return false;
      if (filter === "online") return isOnline(r.last_seen_at);
      if (filter === "staff") return r.role !== "student";
      if (filter === "banned") return r.banned;
      return true;
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "created_at") {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortKey === "tests_total") {
        cmp = a.tests_total - b.tests_total;
      } else {
        const aT = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
        const bT = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
        cmp = aT - bT;
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [rows, needle, filter, sortKey, sortAsc]);

  const onlineCount = rows.filter((r) => isOnline(r.last_seen_at)).length;
  const tabs: [Filter, string][] = [
    ["all", `All ${rows.length}`],
    ["online", `Online ${onlineCount}`],
    ["staff", "Staff"],
    ["banned", "Banned"],
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 md:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-200" />
          <input
            placeholder="Search by name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-lg border border-brand-400/50 bg-brand-600 py-2 pl-9 pr-3 text-sm text-white placeholder:text-brand-200 focus:border-brand-200 focus:outline-none"
          />
        </div>
        <div className="flex shrink-0 gap-1 rounded-lg border border-brand-400/40 bg-brand-600 p-1">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={
                "tap rounded-md px-3 py-1.5 text-xs font-semibold " +
                (filter === key
                  ? "bg-brand-400 text-white shadow-brand"
                  : "text-brand-100 hover:bg-brand-800 hover:text-white")
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!loading && !err && !insightsReady && (
        <div className="mt-4 rounded-xl border border-dashed border-brand-300/50 bg-brand-800/50 p-4 text-sm text-brand-100">
          <span className="font-bold text-white">User insights migration not applied yet.</span> Run{" "}
          <code className="rounded bg-brand-900 px-1.5 py-0.5 text-xs">
            20260830000001_admin_user_insights.sql
          </code>{" "}
          in Supabase. Basic list and role controls still work.
        </div>
      )}

      {err ? (
        <div className="mt-4 rounded-xl border border-dashed border-brand-300/50 bg-brand-800/50 p-6 text-center">
          <p className="text-sm font-semibold text-white">{err}</p>
          <button
            onClick={load}
            className="btn-brand mt-4 rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold text-white"
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="mt-4">
          <ListSkeleton rows={6} />
        </div>
      ) : (
        <div className="rise-in mt-4 overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 shadow-panel">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-brand-100">No users found.</div>
          ) : (
            <>
              {insightsReady && (
                <div className="hidden border-b border-brand-400/30 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-brand-200 md:grid md:grid-cols-[1fr_100px_80px_100px_120px] md:gap-3">
                  <span>User</span>
                  <SortHeader
                    label="Tests"
                    active={sortKey === "tests_total"}
                    asc={sortAsc}
                    onClick={() => toggleSort("tests_total")}
                  />
                  <span>Streak</span>
                  <span>Class</span>
                  <SortHeader
                    label="Last active"
                    active={sortKey === "last_seen"}
                    asc={sortAsc}
                    onClick={() => toggleSort("last_seen")}
                  />
                </div>
              )}
              <ul className="divide-y divide-brand-400/30">
                {filtered.map((u) => (
                  <UserListRow
                    key={u.id}
                    u={u}
                    busy={busy === u.id}
                    insightsReady={insightsReady}
                    onRole={(role) => setRole(u, role)}
                    onBan={() => toggleBan(u)}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SortHeader({
  label,
  active,
  asc,
  onClick,
}: {
  label: string;
  active: boolean;
  asc: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="tap text-left hover:text-white">
      {label}
      {active ? (asc ? " ↑" : " ↓") : ""}
    </button>
  );
}

function UserListRow({
  u,
  busy,
  insightsReady,
  onRole,
  onBan,
}: {
  u: UserRow;
  busy: boolean;
  insightsReady: boolean;
  onRole: (role: Role) => void;
  onBan: () => void;
}) {
  const online = isOnline(u.last_seen_at);
  const lastLabel = u.last_active_at
    ? lastSeenLabel(u.last_active_at)
    : lastSeenLabel(u.last_seen_at);

  return (
    <li className="group">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 md:gap-4">
        <Link
          to="/admin/users/$userId"
          params={{ userId: u.id }}
          className="flex min-w-0 flex-1 items-center gap-3 tap rounded-lg hover:bg-brand-800/40 md:grid md:grid-cols-[1fr_100px_80px_100px_120px] md:items-center md:gap-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative shrink-0">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-400 text-xs font-bold text-white">
                {(u.full_name || u.email || "?").slice(0, 2).toUpperCase()}
              </div>
              <span
                title={online ? "Online now" : lastSeenLabel(u.last_seen_at)}
                className={
                  "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-brand-600 " +
                  (online ? "pulse-ring bg-brand-100" : "bg-brand-800")
                }
              />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-white group-hover:underline">
                  {u.full_name || "—"}
                </span>
                {u.role !== "student" && (
                  <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100 ring-1 ring-brand-400/40">
                    {u.role}
                  </span>
                )}
                {u.banned && (
                  <span className="inline-flex items-center gap-1 rounded bg-brand-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white ring-1 ring-brand-300/60">
                    <Ban className="h-3 w-3" />
                    Banned
                  </span>
                )}
              </div>
              <div className="truncate text-xs text-brand-100">
                {u.email}
                {" · Joined "}
                {format(new Date(u.created_at), "MMM d, yyyy")}
              </div>
            </div>
          </div>
          {insightsReady && (
            <>
              <div className="hidden text-sm tabular-nums text-white md:block">
                {u.tests_total}
                <span className="block text-[10px] text-brand-200">
                  {u.tests_mock}m · {u.tests_daily}d · {u.tests_practice}p
                </span>
              </div>
              <div className="hidden text-sm font-semibold text-white md:block">
                {u.current_streak}
              </div>
              <div className="hidden truncate text-xs text-brand-100 md:block">
                {u.class_name || "—"}
              </div>
              <div className="hidden text-xs text-brand-100 md:block">
                {online ? "Online now" : lastLabel}
              </div>
            </>
          )}
          <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-brand-200 md:hidden" />
        </Link>

        <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <select
            value={u.role}
            disabled={busy}
            onChange={(e) => onRole(e.target.value as Role)}
            className="rounded-lg border border-brand-400/50 bg-brand-800 px-2 py-1.5 text-xs font-semibold text-white [color-scheme:dark] focus:border-brand-200 focus:outline-none disabled:opacity-60"
          >
            <option value="student">Student</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={onBan}
            disabled={busy}
            className={
              "tap inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60 " +
              (u.banned
                ? "btn-brand bg-brand-400 text-white"
                : "bg-brand-800 text-white ring-1 ring-brand-400/40 hover:bg-brand-900")
            }
          >
            {u.banned ? <CircleCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
            {u.banned ? "Unban" : "Ban"}
          </button>
        </div>
      </div>
    </li>
  );
}
