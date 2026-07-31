import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, ShieldOff } from "lucide-react";
import { format } from "date-fns";
import { ListSkeleton } from "@/components/ui/skeletons";

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  isAdmin: boolean;
};

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    const [{ data: profs }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id,email,full_name,created_at").order("created_at", { ascending: false }).limit(500),
      supabase.from("user_roles").select("user_id,role").eq("role", "admin"),
    ]);
    const adminSet = new Set((roles ?? []).map((r: any) => r.user_id));
    setRows(
      (profs ?? []).map((p: any) => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        created_at: p.created_at,
        isAdmin: adminSet.has(p.id),
      })),
    );
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function toggleAdmin(u: UserRow) {
    if (u.isAdmin) {
      if (!confirm(`Remove admin from ${u.email}?`)) return;
      await supabase.from("user_roles").delete().eq("user_id", u.id).eq("role", "admin");
    } else {
      await supabase.from("user_roles").insert({ user_id: u.id, role: "admin" });
    }
    load();
  }

  const filtered = rows.filter(
    (r) =>
      !q ||
      (r.email ?? "").toLowerCase().includes(q.toLowerCase()) ||
      (r.full_name ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <input
        placeholder="Search by name or email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full max-w-md rounded-lg border border-brand-400/50 bg-brand-600 px-3 py-2 text-sm text-white placeholder:text-brand-200 focus:border-brand-200 focus:outline-none"
      />

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
              {filtered.map((u) => (
                <li key={u.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-400 text-xs font-bold text-white">
                    {(u.full_name || u.email || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">
                      {u.full_name || "—"}
                      {u.isAdmin && (
                        <span className="ml-2 rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100 ring-1 ring-brand-400/40">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-brand-100">
                      {u.email} · Joined {format(new Date(u.created_at), "MMM d, yyyy")}
                    </div>
                  </div>
                  {/* Revoke is the destructive side, so it's the recessed dark step
                      with a light ring rather than red; granting is the lit button. */}
                  <button
                    onClick={() => toggleAdmin(u)}
                    className={
                      "tap inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold " +
                      (u.isAdmin
                        ? "bg-brand-800 text-white ring-1 ring-brand-400/40 hover:bg-brand-900 hover:ring-brand-300/60"
                        : "btn-brand bg-brand-400 text-white")
                    }
                  >
                    {u.isAdmin ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                    {u.isAdmin ? "Revoke admin" : "Make admin"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
