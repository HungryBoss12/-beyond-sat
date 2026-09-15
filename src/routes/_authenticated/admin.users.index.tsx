import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Ban,
  ChevronRight,
  CircleCheck,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { ListSkeleton } from "@/components/ui/skeletons";
import {
  fetchAdminUsersSummary,
  type AdminUserSummaryRow,
} from "@/lib/admin/users";
import { createClassStudent, type CreatedStudent } from "@/lib/auth/create-user";
import { listAllClasses } from "@/lib/classes/api";
import type { ClassRow } from "@/lib/classes/types";
import { isOnline, lastSeenLabel } from "@/lib/presence";
import { errorMessage } from "@/lib/utils";

type Role = "student" | "editor" | "admin";
type Filter = "students" | "all" | "online" | "staff" | "banned";
type ClassFilter = "all" | "unassigned" | string;
type SortKey = "created_at" | "tests_total" | "last_seen";

type UserRow = AdminUserSummaryRow & { role: Role; username: string | null };

const CONTROL =
  "w-full rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2 text-sm text-white outline-none transition duration-200 [color-scheme:dark] placeholder:text-brand-200 focus:border-brand-200 focus:ring-2 focus:ring-brand-300/40";

function missingObject(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code && ["42883", "42703", "42P01", "PGRST202"].includes(error.code)) return true;
  return /does not exist|could not find/i.test(error.message ?? "");
}

export const Route = createFileRoute("/_authenticated/admin/users/")({
  component: AdminStudents,
  head: () => ({ meta: [{ title: "Students — Admin — BeyondSAT" }] }),
});

function AdminStudents() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [insightsReady, setInsightsReady] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("students");
  const [classFilter, setClassFilter] = useState<ClassFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createClassId, setCreateClassId] = useState("");
  const [showCreatePw, setShowCreatePw] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<(CreatedStudent & { password: string }) | null>(null);
  const [copied, setCopied] = useState<"username" | "password" | "both" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [summary, classRows] = await Promise.all([
        fetchAdminUsersSummary(),
        listAllClasses().catch(() => [] as ClassRow[]),
      ]);
      setClasses(classRows);
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
          username: r.username ?? null,
          role: (r.role as Role) || "student",
        })),
      );
    } catch (e: unknown) {
      setErr(errorMessage(e, "Could not load students."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (createClassId || classes.length === 0) return;
    const active = classes.find((c) => c.active) ?? classes[0];
    if (active) setCreateClassId(active.id);
  }, [classes, createClassId]);

  async function loadLegacyUsers() {
    const FULL_COLS = "id,email,full_name,username,created_at,last_seen_at,banned";
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
      else if (r.role === "editor" && roleOf.get(r.user_id) !== "admin") roleOf.set(r.user_id, "editor");
    }
    setRows(
      (full.data ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        username: (p as { username?: string | null }).username ?? null,
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
    void load();
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
    void load();
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
    void load();
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreated(null);
    if (createName.trim().length < 2) {
      setCreateError("Enter the student's name.");
      return;
    }
    if (createPassword.length < 8) {
      setCreateError("Password must be at least 8 characters.");
      return;
    }
    if (!createClassId) {
      setCreateError("Pick a class group first.");
      return;
    }
    setCreating(true);
    try {
      const row = await createClassStudent({
        name: createName,
        password: createPassword,
        classId: createClassId,
      });
      setCreated({ ...row, password: createPassword });
      setCreateName("");
      setCreatePassword("");
      await load();
    } catch (err) {
      setCreateError((err as Error).message ?? "Could not create account.");
    } finally {
      setCreating(false);
    }
  }

  async function copyText(kind: "username" | "password" | "both", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard blocked */
    }
  }

  const needle = q.trim().toLowerCase().replace(/^@/, "");
  const filtered = useMemo(() => {
    let list = rows.filter((r) => {
      if (
        needle &&
        !(r.email ?? "").toLowerCase().includes(needle) &&
        !(r.full_name ?? "").toLowerCase().includes(needle) &&
        !(r.username ?? "").toLowerCase().includes(needle)
      ) {
        return false;
      }
      if (filter === "students" && r.role !== "student") return false;
      if (filter === "online" && !isOnline(r.last_seen_at)) return false;
      if (filter === "staff" && r.role === "student") return false;
      if (filter === "banned" && !r.banned) return false;

      if (classFilter === "unassigned") return !r.class_name;
      if (classFilter !== "all") return (r.class_name ?? "") === classFilter;
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
  }, [rows, needle, filter, classFilter, sortKey, sortAsc]);

  const studentCount = rows.filter((r) => r.role === "student").length;
  const onlineCount = rows.filter((r) => isOnline(r.last_seen_at)).length;
  const tabs: [Filter, string][] = [
    ["students", `Students ${studentCount}`],
    ["all", `All ${rows.length}`],
    ["online", `Online ${onlineCount}`],
    ["staff", "Staff"],
    ["banned", "Banned"],
  ];

  const classOptions = useMemo(() => {
    const names = [...new Set(rows.map((r) => r.class_name).filter(Boolean) as string[])].sort();
    return names;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-brand-400/40 bg-brand-600 p-4 text-white shadow-panel">
        <div className="flex flex-wrap items-center gap-2">
          <Plus className="h-4 w-4 text-brand-100" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-brand-100">Create student</h2>
        </div>
        <p className="mt-1 text-xs text-brand-100">
          Name, password, and class. The student signs in with the generated username, then changes
          credentials and sets SAT goals.
        </p>
        <form onSubmit={(e) => void handleCreate(e)} className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_minmax(140px,200px)_auto]">
          <input
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Student name"
            className={CONTROL}
            autoComplete="off"
          />
          <div className="relative">
            <input
              type={showCreatePw ? "text" : "password"}
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              placeholder="Password (8+ characters)"
              className={CONTROL + " pr-10"}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowCreatePw((v) => !v)}
              className="tap absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-brand-100 hover:text-white"
              aria-label={showCreatePw ? "Hide password" : "Show password"}
            >
              {showCreatePw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <select
            value={createClassId}
            onChange={(e) => setCreateClassId(e.target.value)}
            className={CONTROL}
          >
            <option value="">Select class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {!c.active ? " (inactive)" : ""}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={creating}
            className="btn-brand inline-flex items-center justify-center gap-2 rounded-lg bg-brand-400 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Create and add
          </button>
        </form>
        {createError && (
          <p className="mt-2 rounded-lg bg-brand-900 px-3 py-2 text-xs font-semibold text-white ring-1 ring-brand-300/60">
            {createError}
          </p>
        )}
        {created && (
          <div className="mt-3 rounded-lg border border-brand-200/50 bg-brand-900/50 p-3">
            <p className="text-xs font-bold text-white">Account ready — give these to the student</p>
            <div className="mt-2 space-y-1.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="truncate text-brand-100">
                  Username <span className="font-bold text-white">{created.username}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void copyText("username", created.username)}
                  className="tap inline-flex items-center gap-1 text-[11px] font-bold text-white"
                >
                  <Copy className="h-3 w-3" /> {copied === "username" ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="truncate text-brand-100">
                  Password <span className="font-bold text-white">{created.password}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void copyText("password", created.password)}
                  className="tap inline-flex items-center gap-1 text-[11px] font-bold text-white"
                >
                  <Copy className="h-3 w-3" /> {copied === "password" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  void copyText("both", `Username: ${created.username}\nPassword: ${created.password}`)
                }
                className="text-[11px] font-bold text-brand-100 underline-offset-2 hover:text-white hover:underline"
              >
                {copied === "both" ? "Copied both" : "Copy username and password"}
              </button>
              <Link
                to="/admin/users/$userId"
                params={{ userId: created.userId }}
                className="text-[11px] font-bold text-white underline-offset-2 hover:underline"
              >
                Open profile
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 md:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-200" />
          <input
            placeholder="Search by name, username, or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-lg border border-brand-400/50 bg-brand-600 py-2 pl-9 pr-3 text-sm text-white placeholder:text-brand-200 focus:border-brand-200 focus:outline-none"
          />
        </div>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value as ClassFilter)}
          className="rounded-lg border border-brand-400/50 bg-brand-600 px-3 py-2 text-xs font-semibold text-white [color-scheme:dark] focus:border-brand-200 focus:outline-none"
        >
          <option value="all">All classes</option>
          <option value="unassigned">Unassigned</option>
          {classOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <div className="flex shrink-0 flex-wrap gap-1 rounded-lg border border-brand-400/40 bg-brand-600 p-1">
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
        <div className="rounded-xl border border-dashed border-brand-300/50 bg-brand-800/50 p-4 text-sm text-brand-100">
          <span className="font-bold text-white">User insights migration not applied yet.</span> Run{" "}
          <code className="rounded bg-brand-900 px-1.5 py-0.5 text-xs">
            20260830000001_admin_user_insights.sql
          </code>{" "}
          in Supabase. Basic list and role controls still work.
        </div>
      )}

      {err ? (
        <div className="rounded-xl border border-dashed border-brand-300/50 bg-brand-800/50 p-6 text-center">
          <p className="text-sm font-semibold text-white">{err}</p>
          <button
            onClick={() => void load()}
            className="btn-brand mt-4 rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold text-white"
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <ListSkeleton rows={6} />
      ) : (
        <div className="rise-in overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 shadow-panel">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-brand-100">No students found.</div>
          ) : (
            <>
              {insightsReady && (
                <div className="hidden border-b border-brand-400/30 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-brand-200 md:grid md:grid-cols-[1fr_100px_80px_100px_120px] md:gap-3">
                  <span>Student</span>
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
                    onRole={(role) => void setRole(u, role)}
                    onBan={() => void toggleBan(u)}
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
                {u.username && (
                  <span className="truncate text-[11px] text-brand-200">@{u.username}</span>
                )}
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
              <div className="hidden text-sm font-semibold text-white md:block">{u.current_streak}</div>
              <div className="hidden truncate text-xs text-brand-100 md:block">{u.class_name || "—"}</div>
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
