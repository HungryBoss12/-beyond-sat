import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Ban, CircleCheck, Search } from "lucide-react";
import { format } from "date-fns";
import { ListSkeleton } from "@/components/ui/skeletons";
import { getStaffRole } from "@/lib/admin";
import { isOnline, lastSeenLabel } from "@/lib/presence";

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

type Filter = "all" | "online" | "staff" | "banned";

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

function AdminUsers() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  /* Presence is time-relative, so the list has to re-render on a timer or a
     user who closed their tab would stay green until the next reload. */
  const [, setTick] = useState(0);

  async function load() {
    setLoading(true);
    const [{ data: profs }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,email,full_name,created_at,last_seen_at,banned")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    const roleOf = new Map<string, Role>();
    for (const r of (roles ?? []) as { user_id: string; role: string }[]) {
      // admin outranks editor when a user somehow holds both.
      if (r.role === "admin") roleOf.set(r.user_id, "admin");
      else if (r.role === "editor" && roleOf.get(r.user_id) !== "admin")
        roleOf.set(r.user_id, "editor");
    }
    setRows(
      (profs ?? []).map((p: any) => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        created_at: p.created_at,
        last_seen_at: p.last_seen_at ?? null,
        banned: !!p.banned,
        role: roleOf.get(p.id) ?? "student",
      })),
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

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
    setBusy(null);
    if (error) return alert(error.message);
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
    if (error) return alert(error.message);
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
        {/* Segmented filter. Active is the lit step, the rest recede. */}
        <div className="flex shrink-0 gap-1 rounded-lg border border-brand-400/40 bg-brand-600 p-1">
          {(
            [
              ["all", `All ${rows.length}`],
              ["online", `Online ${onlineCount}`],
              ["staff", "Staff"],
              ["banned", "Banned"],
            ] as const
          ).map(([key, label]) => (
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

      {loading ? (
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
                          offline is a hollow ring, so it reads without colour. */}
                      <span
                        title={online ? "Online now" : lastSeenLabel(u.last_seen_at)}
                        className={
                          "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-brand-600 " +
                          (online ? "pulse-ring bg-brand-100" : "bg-brand-800")
                        }
                      />
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
                        {u.email} · {online ? "Online now" : lastSeenLabel(u.last_seen_at)} · Joined{" "}
                        {format(new Date(u.created_at), "MMM d, yyyy")}
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
                          a light ring rather than red; unban is the lit button. */}
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
