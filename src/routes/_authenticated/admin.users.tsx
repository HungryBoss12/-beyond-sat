import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, ShieldOff } from "lucide-react";
import { format } from "date-fns";

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
        className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No users found.</div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {filtered.map((u) => (
              <li key={u.id} className="flex items-center gap-4 px-4 py-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-blue-600 text-xs font-bold">
                  {(u.full_name || u.email || "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">
                    {u.full_name || "—"}
                    {u.isAdmin && (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {u.email} · Joined {format(new Date(u.created_at), "MMM d, yyyy")}
                  </div>
                </div>
                <button
                  onClick={() => toggleAdmin(u)}
                  className={
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold " +
                    (u.isAdmin
                      ? "bg-white border border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600"
                      : "bg-primary text-white hover:opacity-90")
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
    </div>
  );
}
