import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, Ban, CircleCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { UserActivityFeed } from "@/components/admin/UserActivityFeed";
import { UserStatTiles } from "@/components/admin/UserStatTiles";
import { UserTestsTable } from "@/components/admin/UserTestsTable";
import { ListSkeleton } from "@/components/ui/skeletons";
import { getStaffRole } from "@/lib/admin";
import {
  fetchAdminUserActivity,
  fetchAdminUinfo,
  fetchAdminUserDetail,
  fetchAdminUserSessions,
  flushAdminUinfo,
  type AdminActivityRow,
  type AdminUinfo,
  type AdminUserDetail,
  type AdminUserSessionRow,
} from "@/lib/admin/users";
import { isOnline, lastSeenLabel } from "@/lib/presence";
import { errorMessage, formatGrade } from "@/lib/utils";
import { AdminSelect } from "@/components/admin/AdminSelect";

type Role = "student" | "editor" | "admin";

const ROLE_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "editor", label: "Editor" },
  { value: "admin", label: "Admin" },
];
type Tab = "overview" | "tests" | "vocab" | "activity" | "uinfo";

export const Route = createFileRoute("/_authenticated/admin/users/$userId")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/signin" });
    if ((await getStaffRole(data.user.id)) !== "admin") throw redirect({ to: "/admin/questions" });
  },
  component: AdminUserDetailPage,
  head: ({ params }) => ({
    meta: [{ title: `Student ${params.userId.slice(0, 8)}… — Admin — BeyondSAT` }],
  }),
});

function AdminUserDetailPage() {
  const { userId } = Route.useParams();
  const [tab, setTab] = useState<Tab>("overview");
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [sessions, setSessions] = useState<AdminUserSessionRow[]>([]);
  const [activity, setActivity] = useState<AdminActivityRow[]>([]);
  const [uinfo, setUinfo] = useState<AdminUinfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tabErr, setTabErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const d = await fetchAdminUserDetail(userId);
      setDetail(d);
    } catch (e: unknown) {
      setErr(errorMessage(e, "Could not load user."));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    setSessions([]);
    setActivity([]);
    setUinfo(null);
    setTabErr(null);
  }, [userId]);

  useEffect(() => {
    if (!detail) return;
    let cancelled = false;
    if (tab === "tests") {
      setTabLoading(true);
      setTabErr(null);
      fetchAdminUserSessions(userId)
        .then((rows) => {
          if (!cancelled) setSessions(rows);
        })
        .catch((e) => {
          if (!cancelled) setTabErr(errorMessage(e, "Could not load sessions."));
        })
        .finally(() => {
          if (!cancelled) setTabLoading(false);
        });
    }
    if (tab === "activity") {
      setTabLoading(true);
      setTabErr(null);
      fetchAdminUserActivity(userId)
        .then((rows) => {
          if (!cancelled) setActivity(rows);
        })
        .catch((e) => {
          if (!cancelled) setTabErr(errorMessage(e, "Could not load activity."));
        })
        .finally(() => {
          if (!cancelled) setTabLoading(false);
        });
    }
    if (tab === "uinfo") {
      setTabLoading(true);
      setTabErr(null);
      void (async () => {
        try {
          const current = await fetchAdminUinfo(userId);
          if (cancelled) return;
          if (current.pending > 0) {
            await flushAdminUinfo(userId);
            if (cancelled) return;
            setUinfo(await fetchAdminUinfo(userId));
          } else {
            setUinfo(current);
          }
        } catch (e) {
          if (!cancelled) setTabErr(errorMessage(e, "Could not load AI summary."));
        } finally {
          if (!cancelled) setTabLoading(false);
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [tab, userId, detail]);

  async function setRole(role: Role) {
    if (!detail) return;
    const current = detail.role as Role;
    if (role === current) return;
    if (current === "admin" && !confirm(`Remove admin from ${profileEmail(detail)}?`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_role", {
      p_user_id: userId,
      p_role: role,
    });
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    loadDetail();
  }

  async function toggleBan() {
    if (!detail) return;
    const profile = detail.profile as { banned?: boolean; email?: string | null };
    const banned = !!profile.banned;
    let reason: string | null = null;
    if (!banned) {
      reason = prompt(`Ban ${profile.email}? Optional reason:`, "");
      if (reason === null) return;
    } else if (!confirm(`Unban ${profile.email}?`)) {
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_banned", {
      p_user_id: userId,
      p_banned: !banned,
      p_reason: reason || null,
    });
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    loadDetail();
  }

  const tabs: [Tab, string][] = [
    ["overview", "Overview"],
    ["tests", "Tests"],
    ["vocab", "Vocab"],
    ["activity", "Activity"],
    ["uinfo", "AI summary"],
  ];

  return (
    <div>
      <Link
        to="/admin/users"
        className="tap inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" />
        All users
      </Link>

      {loading ? (
        <div className="mt-4">
          <ListSkeleton rows={4} />
        </div>
      ) : err || !detail ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          <p>{err ?? "User not found."}</p>
          <button
            type="button"
            onClick={() => void loadDetail()}
            className="btn-brand mt-4 rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold text-white"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <Header detail={detail} busy={busy} onRole={setRole} onBan={toggleBan} />

          <div className="mt-4 flex flex-wrap gap-1 rounded-2xl border border-brand-400/40 bg-brand-600 p-1">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  setTab(key);
                  setTabErr(null);
                }}
                className={
                  "tap min-w-0 flex-1 rounded-xl px-3 py-2 text-xs font-semibold " +
                  (tab === key
                    ? "bg-brand-400 text-white shadow-brand"
                    : "text-brand-100 hover:bg-brand-800 hover:text-white")
                }
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {tabErr ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
                <p>{tabErr}</p>
              </div>
            ) : tab === "overview" ? (
              <OverviewTab detail={detail} />
            ) : tab === "tests" ? (
              tabLoading ? <ListSkeleton rows={5} /> : <UserTestsTable sessions={sessions} />
            ) : tab === "vocab" ? (
              <VocabTab detail={detail} />
            ) : tab === "activity" ? (
              tabLoading ? <ListSkeleton rows={6} /> : <UserActivityFeed events={activity} />
            ) : tabLoading ? (
              <ListSkeleton rows={4} />
            ) : (
              <UinfoPanel data={uinfo} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Header({
  detail,
  busy,
  onRole,
  onBan,
}: {
  detail: AdminUserDetail;
  busy: boolean;
  onRole: (r: Role) => void;
  onBan: () => void;
}) {
  const profile = detail.profile as {
    full_name?: string | null;
    email?: string | null;
    last_seen_at?: string | null;
    banned?: boolean;
    created_at?: string;
  };
  const online = isOnline(profile.last_seen_at ?? null);
  const role = detail.role as Role;

  return (
    <div className="mt-4 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-brand-400/40 bg-brand-600 p-4 shadow-panel">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-black text-white">{profile.full_name || profile.email || "User"}</h2>
          {role !== "student" && (
            <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100 ring-1 ring-brand-400/40">
              {role}
            </span>
          )}
          {profile.banned && (
            <span className="inline-flex items-center gap-1 rounded bg-brand-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white ring-1 ring-brand-300/60">
              <Ban className="h-3 w-3" />
              Banned
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-brand-100">
          {profile.email}
          {" · "}
          {online ? "Online now" : lastSeenLabel(profile.last_seen_at ?? null)}
          {profile.created_at &&
            ` · Joined ${format(new Date(profile.created_at), "MMM d, yyyy")}`}
          {detail.class_name && ` · ${detail.class_name}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <AdminSelect
          value={role}
          onValueChange={(v) => onRole(v as Role)}
          disabled={busy}
          size="sm"
          className="w-[110px]"
          options={ROLE_OPTIONS}
        />
        <button
          onClick={onBan}
          disabled={busy}
          className={
            "tap inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60 " +
            (profile.banned
              ? "btn-brand bg-brand-400 text-white"
              : "bg-brand-800 text-white ring-1 ring-brand-400/40 hover:bg-brand-900")
          }
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : profile.banned ? (
            <CircleCheck className="h-3.5 w-3.5" />
          ) : (
            <Ban className="h-3.5 w-3.5" />
          )}
          {profile.banned ? "Unban" : "Ban"}
        </button>
      </div>
    </div>
  );
}

function OverviewTab({ detail }: { detail: AdminUserDetail }) {
  const profile = detail.profile as Record<string, unknown>;
  const student = detail.student_profile as Record<string, unknown> | null;

  const identityRows = [
    ["City", profile.city],
    ["School", profile.school],
    ["Grade", formatGrade(profile.grade)],
    ["Username", profile.username],
    ["Telegram", profile.telegram_username],
    ["Banned reason", profile.banned_reason],
    ["Banned at", profile.banned_at ? format(new Date(String(profile.banned_at)), "PPp") : null],
  ].filter(([, v]) => v != null && v !== "");

  const goalRows = student
    ? [
        ["Target score", student.target_score],
        ["Target R&W", student.target_rw],
        ["Target Math", student.target_math],
        ["Exam date", student.exam_date],
        ["Current streak", student.current_streak],
        ["Longest streak", student.longest_streak],
        ["Level", student.level],
      ].filter(([, v]) => v != null && v !== "")
    : [];

  return (
    <div className="space-y-6">
      <UserStatTiles stats={detail.stats} />
      {identityRows.length > 0 && (
        <Section title="Identity">
          <dl className="grid gap-2 sm:grid-cols-2">
            {identityRows.map(([k, v]) => (
              <div
                key={String(k)}
                className="rounded-xl border border-brand-400/40 bg-brand-600 px-3 py-2 shadow-panel"
              >
                <dt className="text-[10px] font-bold uppercase tracking-wider text-brand-200">{k}</dt>
                <dd className="text-sm font-semibold text-white">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}
      {goalRows.length > 0 && (
        <Section title="Goals & streaks">
          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {goalRows.map(([k, v]) => (
              <div
                key={String(k)}
                className="rounded-xl border border-brand-400/40 bg-brand-600 px-3 py-2 shadow-panel"
              >
                <dt className="text-[10px] font-bold uppercase tracking-wider text-brand-200">{k}</dt>
                <dd className="text-sm font-semibold text-white">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}
    </div>
  );
}

function VocabTab({ detail }: { detail: AdminUserDetail }) {
  const s = detail.stats;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[
        ["SRS cards", s.vocab_cards],
        ["Due now", s.vocab_due],
        ["Quiz attempts", s.vocab_quiz_attempts],
        ["Reviews (7d)", s.vocab_reviews_7d],
      ].map(([label, value]) => (
        <div
          key={String(label)}
          className="rounded-2xl border border-brand-400/40 bg-brand-600 px-4 py-3 shadow-panel"
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-brand-200">{label}</div>
          <div className="mt-1 text-2xl font-black text-white">{value}</div>
        </div>
      ))}
    </div>
  );
}

function UinfoPanel({ data }: { data: AdminUinfo | null }) {
  return (
    <div className="rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-black uppercase tracking-wider text-brand-100">AI summary</h3>
        <p className="text-xs text-brand-100">
          {data?.updated_at
            ? `Updated ${format(new Date(data.updated_at), "MMM d, yyyy · h:mm a")}`
            : "No summary yet"}
          {data ? ` · ${data.pending} pending log${data.pending === 1 ? "" : "s"}` : ""}
        </p>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-white">
        {data?.summary?.trim() || "No observations yet. Logs collect as this student uses the site."}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-black uppercase tracking-wider text-slate-900">{title}</h3>
      {children}
    </div>
  );
}

function profileEmail(detail: AdminUserDetail): string {
  const email = detail.profile.email;
  return typeof email === "string" ? email : "this user";
}
