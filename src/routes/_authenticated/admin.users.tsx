import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Ban, CircleCheck, Search } from "lucide-react";
import { format } from "date-fns";
import { ListSkeleton } from "@/components/ui/skeletons";
import { getStaffRole } from "@/lib/admin";
import { isOnline, lastSeenLabel } from "@/lib/presence";
import { errorMessage } from "@/lib/utils";

type Role = "student" | "editor" | "admin";

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  last_seen_at: string | null;
  banned: boolean;
  role: Role;
};

type ProfileBase = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  last_seen_at?: string | null;
  banned?: boolean | null;
};

type Filter = "all" | "online" | "staff" | "banned";

/**
 * True when Postgres is complaining that something doesn't exist rather than
 * that the caller isn't allowed to touch it — 42883 undefined_function, 42703
 * undefined_column, 42P01 undefined_table, plus PostgREST's own PGRST202 for an
 * unresolvable RPC. Distinguishes "the migration hasn't run" from "you don't
 * have permission", which need very different messages.
 */
function missingObject(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code && ["42883", "42703", "42P01", "PGRST202"].includes(error.code)) return true;
  return /does not exist|could not find/i.test(error.message ?? "");
}

export const Route = createFileRoute("/_authenticated/admin/users")({
  /* Second line of defence. The parent /admin guard already bounces editors,
     but this route is the one that hands out roles and bans, so it states its
     own requirement rather than trusting the layout to keep enforcing it. */
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/signin" });
    if ((await getStaffRole(data.user.id)) !== "admin") throw redirect({ to: "/admin/questions" });
  },
  component: AdminUsers,
});

/* Columns added by the presence/bans migration, kept apart from the ones that
   have always existed so the query can degrade to the base set. */
const FULL_COLS = "id,email,full_name,created_at,last_seen_at,banned";
const BASE_COLS = "id,email,full_name,created_at";

function AdminUsers() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  /* False until the presence/bans migration has been applied. Drives whether
     the online dot, the Online/Banned filters and the Ban button are offered
     at all — showing controls backed by columns and RPCs that don't exist yet
     just produces errors on click. */
  const [presenceReady, setPresenceReady] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  /* Presence is time-relative, so the list has to re-render on a timer or a
     user who closed their tab would stay green until the next reload. */
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      /* `last_seen_at` and `banned` only exist once the presence/bans migration
         has run. PostgREST rejects the *entire* request with a 400 when any
         selected column is missing, so asking for them unconditionally returned
         no rows at all and the page rendered "No users found" — the users were
         there the whole time, the select was just invalid. The old error was
         discarded rather than surfaced, which is what made it look like an
         empty table instead of a failed query.

         So: try the full select, and fall back to the columns that predate the
         migration if the server rejects it. */
      let profs: ProfileBase[] = [];
      let hasPresence = true;
      const full = await supabase
        .from("profiles")
        .select(FULL_COLS)
        .order("created_at", { ascending: false })
        .limit(500);
      if (full.error && !missingObject(full.error)) throw full.error;
      if (full.error) {
        hasPresence = false;
        const base = await supabase
          .from("profiles")
          .select(BASE_COLS)
          .order("created_at", { ascending: false })
          .limit(500);
        if (base.error) throw base.error;
        profs = base.data ?? [];
      } else {
        profs = full.data ?? [];
      }
      setPresenceReady(hasPresence);
      if (!hasPresence && filter !== "all" && filter !== "staff") setFilter("all");

      /* Unfiltered on purpose — see getStaffRole in lib/admin.ts. Sending
         `.eq("role", "editor")` would be rejected until the enum migration runs. */
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id,role");
      if (rolesErr) throw rolesErr;

      const roleOf = new Map<string, Role>();
      for (const r of (roles ?? []) as { user_id: string; role: string }[]) {
        // admin outranks editor when a user somehow holds both.
        if (r.role === "admin") roleOf.set(r.user_id, "admin");
        else if (r.role === "editor" && roleOf.get(r.user_id) !== "admin")
          roleOf.set(r.user_id, "editor");
      }
      setRows(
        profs.map((p) => ({
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          created_at: p.created_at,
          last_seen_at: p.last_seen_at ?? null,
          banned: !!p.banned,
          role: roleOf.get(p.id) ?? "student",
        })),
      );
    } catch (e: unknown) {
      setErr(errorMessage(e, "Could not load users."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  /* Both mutations go through security-definer RPCs. The client can't be the
     thing that enforces "admins only" — an editor could call PostgREST
     directly — so these just surface whatever the database decides. */
  async function setRole(u: UserRow, role: Role) {
    if (role === u.role) return;
    if (u.role === "admin" && !confirm(`Remove admin from ${u.email}?`)) return;
    setBusy(u.id);
    const { error } = await supabase.rpc("admin_set_role", {
      p_user_id: u.id,
      p_role: role,
    });

    /* `admin_set_role` ships with the same migration as the columns above, so
       until that's applied the call fails as a missing function rather than a
       permission problem. Granting admin used to be a plain table write and has
       to keep working in that window, so fall back to it — RLS ("Admins can
       manage user_roles") is what authorises it either way, the RPC just states
       the rule in one place. Editor can't be granted this way at all: the enum
       value doesn't exist yet and Postgres rejects the cast. */
    if (error && missingObject(error)) {
      if (role === "editor") {
        setBusy(null);
        alert(
          "The editor role needs its migration first. Run 20260801000001_add_editor_role_step1.sql, then 20260801000002_editor_role_presence_bans_step2.sql in the Supabase SQL editor.",
        );
        return;
      }
      await supabase.from("user_roles").delete().eq("user_id", u.id).eq("role", "admin");
      if (role === "admin") {
        const { error: insErr } = await supabase
          .from("user_roles")
          .insert({ user_id: u.id, role: "admin" });
        setBusy(null);
        if (insErr) {
          alert(insErr.message);
          return;
        }
      } else {
        setBusy(null);
      }
      load();
      return;
    }

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
      alert(
        missingObject(error)
          ? "Banning needs the editor-role migration. Run the two SQL files in supabase/migrations (step1, then step2) in the Supabase SQL editor."
          : error.message,
      );
      return;
    }
    load();
  }

  const needle = q.trim().toLowerCase();
  const filtered = rows.filter((r) => {
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

  const onlineCount = rows.filter((r) => isOnline(r.last_seen_at)).length;

  /* Online and Banned both read columns that only exist post-migration, so they
     drop out until it's applied rather than sitting there filtering to nothing. */
  const allTabs: [Filter, string][] = [
    ["all", `All ${rows.length}`],
    ["online", `Online ${onlineCount}`],
    ["staff", "Staff"],
    ["banned", "Banned"],
  ];
  const tabs = presenceReady ? allTabs : allTabs.filter(([k]) => k === "all" || k === "staff");

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
        {/* Segmented filter. Active is the lit step, the rest recede. The
            presence-backed tabs are only offered once the migration has run. */}
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

      {/* The migration gate. Without this the page silently behaves as if every
          user were offline and unbannable, with no hint as to why. */}
      {!loading && !err && !presenceReady && (
        <div className="mt-4 rounded-xl border border-dashed border-brand-300/50 bg-brand-800/50 p-4 text-sm text-brand-100">
          <span className="font-bold text-white">Presence and bans aren't active yet.</span> Run{" "}
          <code className="rounded bg-brand-900 px-1.5 py-0.5 text-xs">
            20260801000001_add_editor_role_step1.sql
          </code>{" "}
          then{" "}
          <code className="rounded bg-brand-900 px-1.5 py-0.5 text-xs">
            20260801000002_editor_role_presence_bans_step2.sql
          </code>{" "}
          in the Supabase SQL editor. Roles and the user list work regardless.
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
            <ul className="divide-y divide-brand-400/30">
              {filtered.map((u) => {
                const online = isOnline(u.last_seen_at);
                return (
                  <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3 md:gap-4">
                    <div className="relative shrink-0">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-400 text-xs font-bold text-white">
                        {(u.full_name || u.email || "?").slice(0, 2).toUpperCase()}
                      </div>
                      {/* Presence dot. Online is the light step and pulses;
                          offline is a hollow ring, so it reads without colour.
                          Omitted entirely pre-migration — a permanently grey dot
                          would claim everyone is offline. */}
                      {presenceReady && (
                        <span
                          title={online ? "Online now" : lastSeenLabel(u.last_seen_at)}
                          className={
                            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-brand-600 " +
                            (online ? "pulse-ring bg-brand-100" : "bg-brand-800")
                          }
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-white">
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
                        {presenceReady
                          ? ` · ${online ? "Online now" : lastSeenLabel(u.last_seen_at)}`
                          : ""}{" "}
                        · Joined {format(new Date(u.created_at), "MMM d, yyyy")}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {/* Three-way role picker replaces the old admin toggle now
                          that editor exists. */}
                      <select
                        value={u.role}
                        disabled={busy === u.id}
                        onChange={(e) => setRole(u, e.target.value as Role)}
                        className="rounded-lg border border-brand-400/50 bg-brand-800 px-2 py-1.5 text-xs font-semibold text-white [color-scheme:dark] focus:border-brand-200 focus:outline-none disabled:opacity-60"
                        aria-label={`Role for ${u.email}`}
                      >
                        <option value="student">Student</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>

                      {/* Ban is destructive, so it's the recessed dark step with
                          a light ring rather than red; unban is the lit button.
                          Hidden pre-migration since the RPC behind it doesn't
                          exist yet. */}
                      {presenceReady && (
                        <button
                          onClick={() => toggleBan(u)}
                          disabled={busy === u.id}
                          className={
                            "tap inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:pointer-events-none disabled:opacity-60 " +
                            (u.banned
                              ? "btn-brand bg-brand-400 text-white"
                              : "bg-brand-800 text-white ring-1 ring-brand-400/40 hover:bg-brand-900 hover:ring-brand-300/60")
                          }
                        >
                          {u.banned ? (
                            <CircleCheck className="h-3.5 w-3.5" />
                          ) : (
                            <Ban className="h-3.5 w-3.5" />
                          )}
                          {u.banned ? "Unban" : "Ban"}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-slate-500">
        Online means active in the last 3 minutes. Editors can only reach Questions, Daily Tests,
        Mock Exams and News — they can't change roles or ban anyone.
      </p>
    </div>
  );
}
