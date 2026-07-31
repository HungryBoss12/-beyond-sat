import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  LogOut,
  Target,
  Flame,
  Trophy,
  ClipboardList,
  Pencil,
  Save,
  X,
  Loader2,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { HighlightShortcutsCard } from "@/components/HighlightShortcutsCard";
import { PageHead, Panel as Surface, PanelGlow, Skeleton } from "@/components/ui/panel";
import { HeadSkeleton, PanelGridSkeleton, ListSkeleton } from "@/components/ui/skeletons";

export const Route = createFileRoute("/_authenticated/profile")({
  component: Profile,
  head: () => ({
    meta: [
      { title: "Profile — BeyondSAT" },
      { name: "description", content: "Your BeyondSAT profile, stats, and history." },
    ],
  }),
});

type ProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  city: string | null;
  school: string | null;
  grade: number | null;
  birth_date: string | null;
};

type StudentRow = {
  target_score: number | null;
  target_rw: number | null;
  target_math: number | null;
  exam_date: string | null;
  time_bucket: string | null;
  fears: string[];
  level: string | null;
  current_streak: number;
  longest_streak: number;
};

type ExamDateOpt = { id: string; exam_date: string; label: string | null };

type Session = {
  id: string;
  type: "practice" | "daily" | "mock";
  score: number | null;
  rw_score: number | null;
  math_score: number | null;
  correct_count: number | null;
  total_questions: number | null;
  completed_at: string;
};

function Profile() {
  const navigate = useNavigate();
  const [uid, setUid] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attemptsTotal, setAttemptsTotal] = useState(0);
  const [correctTotal, setCorrectTotal] = useState(0);
  const [dateOptions, setDateOptions] = useState<ExamDateOpt[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingInfo, setEditingInfo] = useState(false);
  const [editingGoals, setEditingGoals] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const u = userData.user;
      if (!u) return;
      setUid(u.id);
      setEmail(u.email ?? "");
      const [{ data: p }, { data: sp }, { data: sess }, { data: att }, { data: dates }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u.id).maybeSingle(),
        supabase.from("student_profiles").select("*").eq("user_id", u.id).maybeSingle(),
        supabase
          .from("test_sessions")
          .select("id,type,score,rw_score,math_score,correct_count,total_questions,completed_at")
          .eq("user_id", u.id)
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false })
          .limit(50),
        supabase.from("attempts").select("is_correct").eq("user_id", u.id),
        supabase
          .from("exam_dates")
          .select("id,exam_date,label")
          .eq("active", true)
          .gte("exam_date", new Date().toISOString().slice(0, 10))
          .order("exam_date", { ascending: true }),
      ]);
      setProfile(p as ProfileRow | null);
      setStudent(sp as StudentRow | null);
      setSessions((sess ?? []) as Session[]);
      setDateOptions((dates ?? []) as ExamDateOpt[]);
      const rows = (att ?? []) as { is_correct: boolean | null }[];
      setAttemptsTotal(rows.length);
      setCorrectTotal(rows.filter((r) => r.is_correct).length);
      setLoading(false);
    })();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/signin", replace: true });
  }

  const accuracy = attemptsTotal === 0 ? null : Math.round((correctTotal / attemptsTotal) * 100);
  const mocks = useMemo(() => sessions.filter((s) => s.type === "mock"), [sessions]);
  const bestMock = useMemo(() => {
    const scored = mocks.filter((m) => m.score != null) as (Session & { score: number })[];
    return scored.length ? Math.max(...scored.map((m) => m.score)) : null;
  }, [mocks]);
  const daysToExam = student?.exam_date
    ? Math.max(0, Math.ceil((new Date(student.exam_date).getTime() - Date.now()) / 86400000))
    : null;

  const displayName =
    profile?.full_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    email.split("@")[0] ||
    "Student";
  const initials =
    displayName
      .split(" ")
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "S";

  async function saveInfo(form: Partial<ProfileRow>) {
    if (!uid) return;
    setSaving(true);
    const full_name = [form.first_name, form.last_name].filter(Boolean).join(" ").trim() || null;
    const { data, error } = await supabase
      .from("profiles")
      .update({ ...form, full_name })
      .eq("id", uid)
      .select("*")
      .maybeSingle();
    setSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    setProfile(data as ProfileRow);
    setEditingInfo(false);
  }

  async function saveGoals(form: Partial<StudentRow>) {
    if (!uid) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("student_profiles")
      .update(form)
      .eq("user_id", uid)
      .select("*")
      .maybeSingle();
    setSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    setStudent(data as StudentRow);
    setEditingGoals(false);
  }

  /* Profile-shaped placeholder rather than a spinner: identity card, the two
     editable panels, then history. The layout is already correct when the real
     data lands, so nothing reflows. */
  if (loading) {
    return (
      <div className="space-y-6">
        <HeadSkeleton />
        <Skeleton className="h-56 rounded-2xl md:h-52" />
        <PanelGridSkeleton height={280} />
        <ListSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHead title="Profile" subtitle="Your account, goals and test history." />

      {/* Identity card — the one focal brand surface on this screen. */}
      <Surface tone="brand" className="overflow-hidden p-6 md:p-8">
        <PanelGlow />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand-400 text-2xl font-black text-white shadow-brand md:h-20 md:w-20">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-2xl font-black md:text-3xl">{displayName}</div>
            <div className="truncate text-sm text-brand-100">{email}</div>
            {student?.level && (
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-400 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                <Sparkles className="h-3 w-3" /> {student.level}
              </span>
            )}
          </div>
          <button
            onClick={signOut}
            className="btn-ghost inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-brand-300/60 bg-brand-800 px-3 py-2 text-sm font-bold text-white sm:self-auto"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
        <div className="stagger mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            icon={<Flame className="h-4 w-4 fill-brand-100 text-brand-100" />}
            label="Current streak"
            value={`${student?.current_streak ?? 0}d`}
          />
          <Stat
            icon={<Trophy className="h-4 w-4 text-brand-100" />}
            label="Longest"
            value={`${student?.longest_streak ?? 0}d`}
          />
          <Stat
            icon={<Target className="h-4 w-4 text-brand-100" />}
            label="Best mock"
            value={bestMock != null ? String(bestMock) : "—"}
          />
          <Stat
            icon={<ClipboardList className="h-4 w-4 text-brand-100" />}
            label="Accuracy"
            value={accuracy != null ? `${accuracy}%` : "—"}
          />
        </div>
      </Surface>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Personal info */}
        <Panel
          title="Personal info"
          editing={editingInfo}
          onEdit={() => setEditingInfo(true)}
          onCancel={() => setEditingInfo(false)}
        >
          {editingInfo ? (
            <InfoForm profile={profile} onSave={saveInfo} saving={saving} />
          ) : (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Field label="First name" value={profile?.first_name} />
              <Field label="Last name" value={profile?.last_name} />
              <Field label="City" value={profile?.city} />
              <Field label="School" value={profile?.school} />
              <Field label="Grade" value={profile?.grade != null ? String(profile.grade) : null} />
              <Field
                label="Birth date"
                value={profile?.birth_date ? format(new Date(profile.birth_date), "MMM d, yyyy") : null}
              />
            </dl>
          )}
        </Panel>

        {/* Goals */}
        <Panel
          title="Goals"
          editing={editingGoals}
          onEdit={() => setEditingGoals(true)}
          onCancel={() => setEditingGoals(false)}
        >
          {editingGoals ? (
            <GoalsForm
              student={student}
              onSave={saveGoals}
              saving={saving}
              dateOptions={dateOptions}
            />
          ) : (
            <dl className="space-y-3 text-sm">
              <Field
                label="English (R&W) target"
                value={student?.target_rw ? `${student.target_rw} / 800` : null}
              />
              <Field
                label="Math target"
                value={student?.target_math ? `${student.target_math} / 800` : null}
              />
              <Field
                label="Total target"
                value={student?.target_score ? `${student.target_score} / 1600` : null}
              />
              <Field
                label="Exam date"
                value={
                  student?.exam_date
                    ? `${format(new Date(student.exam_date), "MMM d, yyyy")}${
                        daysToExam != null ? ` (${daysToExam} day${daysToExam === 1 ? "" : "s"} left)` : ""
                      }`
                    : null
                }
              />
            </dl>
          )}
        </Panel>
      </div>

      <HighlightShortcutsCard />

      {/* History */}
      <Surface>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-white">Test history</h2>
          <span className="text-xs text-brand-100">{sessions.length} completed</span>
        </div>
        {sessions.length === 0 ? (
          <p className="mt-4 text-sm text-brand-100">
            You haven't finished any tests yet.{" "}
            <Link to="/practice" className="font-bold text-white underline-offset-2 hover:underline">
              Start practicing
            </Link>
            .
          </p>
        ) : (
          <ul className="stagger-fast mt-3 divide-y divide-brand-400/40">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold capitalize text-white">{s.type}</div>
                  <div className="text-xs text-brand-100">
                    {format(new Date(s.completed_at), "MMM d, yyyy · h:mm a")}
                  </div>
                </div>
                <div className="text-right">
                  {s.type === "mock" && s.score != null ? (
                    <div>
                      <div className="text-lg font-black tabular-nums text-white">{s.score}</div>
                      <div className="text-[11px] text-brand-100">
                        R&W {s.rw_score ?? "—"} · Math {s.math_score ?? "—"}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-lg font-black tabular-nums text-white">
                        {s.correct_count ?? 0}/{s.total_questions ?? 0}
                      </div>
                      <div className="text-[11px] text-brand-100">
                        {s.total_questions
                          ? Math.round(((s.correct_count ?? 0) / s.total_questions) * 100)
                          : 0}
                        %
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-brand-800 px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-100">
        {icon} {label}
      </div>
      <div className="pop-in mt-1 text-2xl font-black tabular-nums text-white">{value}</div>
    </div>
  );
}

function Panel({
  title,
  editing,
  onEdit,
  onCancel,
  children,
}: {
  title: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <Surface>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-white">{title}</h2>
        {editing ? (
          <button
            onClick={onCancel}
            className="tap inline-flex items-center gap-1.5 text-xs font-bold text-brand-100 hover:text-white"
          >
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        ) : (
          <button
            onClick={onEdit}
            className="tap inline-flex items-center gap-1.5 text-xs font-bold text-white underline-offset-2 hover:underline"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </Surface>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-brand-100">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-white">
        {value || <span className="text-brand-200">—</span>}
      </dd>
    </div>
  );
}

function InfoForm({
  profile,
  onSave,
  saving,
}: {
  profile: ProfileRow | null;
  onSave: (v: Partial<ProfileRow>) => void;
  saving: boolean;
}) {
  const [first, setFirst] = useState(profile?.first_name ?? "");
  const [last, setLast] = useState(profile?.last_name ?? "");
  const [city, setCity] = useState(profile?.city ?? "");
  const [school, setSchool] = useState(profile?.school ?? "");
  const [grade, setGrade] = useState(profile?.grade != null ? String(profile.grade) : "");
  const [birth, setBirth] = useState(profile?.birth_date ?? "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          first_name: first || null,
          last_name: last || null,
          city: city || null,
          school: school || null,
          grade: grade ? Number(grade) : null,
          birth_date: birth || null,
        });
      }}
      className="grid grid-cols-2 gap-3"
    >
      <Input label="First name" value={first} onChange={setFirst} />
      <Input label="Last name" value={last} onChange={setLast} />
      <Input label="City" value={city} onChange={setCity} />
      <Input label="School" value={school} onChange={setSchool} />
      <Input label="Grade" value={grade} onChange={setGrade} type="number" />
      <Input label="Birth date" value={birth} onChange={setBirth} type="date" />
      <div className="col-span-2 flex justify-end">
        <SaveButton saving={saving} />
      </div>
    </form>
  );
}

function GoalsForm({
  student,
  onSave,
  saving,
  dateOptions,
}: {
  student: StudentRow | null;
  onSave: (v: Partial<StudentRow>) => void;
  saving: boolean;
  dateOptions: ExamDateOpt[];
}) {
  const initialDate = student?.exam_date ?? "";
  const dateInList = dateOptions.some((d) => d.exam_date === initialDate);
  const [examDate, setExamDate] = useState(dateInList ? initialDate : "");
  const [targetRw, setTargetRw] = useState(
    student?.target_rw != null ? String(student.target_rw) : "",
  );
  const [targetMath, setTargetMath] = useState(
    student?.target_math != null ? String(student.target_math) : "",
  );
  const rw = Number(targetRw);
  const math = Number(targetMath);
  const validRw = rw >= 200 && rw <= 800;
  const validMath = math >= 200 && math <= 800;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          exam_date: examDate || null,
          target_rw: validRw ? rw : null,
          target_math: validMath ? math : null,
          target_score: validRw && validMath ? rw + math : null,
        });
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <Input label="English (R&W) 200–800" value={targetRw} onChange={setTargetRw} type="number" />
        <Input label="Math 200–800" value={targetMath} onChange={setTargetMath} type="number" />
      </div>
      <div className="flex justify-between rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2 text-sm">
        <span className="text-[11px] font-bold uppercase tracking-wider text-brand-100">Total</span>
        <span className="font-black tabular-nums text-white">
          {validRw && validMath ? `${rw + math} / 1600` : "—"}
        </span>
      </div>
      <label className="block">
        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-brand-100">
          Exam date
        </span>
        {dateOptions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-brand-300/60 px-3 py-2 text-sm text-brand-100">
            No exam dates published yet.
          </div>
        ) : (
          <select
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            className="block w-full rounded-lg border border-brand-400/60 bg-brand-800 px-3 py-2 text-sm text-white focus:border-brand-200 focus:outline-none"
          >
            <option value="">Select an exam date…</option>
            {dateOptions.map((d) => (
              <option key={d.id} value={d.exam_date}>
                {format(new Date(d.exam_date), "MMM d, yyyy")}
                {d.label ? ` — ${d.label}` : ""}
              </option>
            ))}
          </select>
        )}
      </label>
      <div className="flex justify-end">
        <SaveButton saving={saving} />
      </div>
    </form>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-brand-100">
        {label}
      </span>
      {/* `color-scheme: dark` is what makes the native date/number spinners render
          light — without it the browser draws a dark widget on a dark field. */}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-lg border border-brand-400/60 bg-brand-800 px-3 py-2 text-sm text-white [color-scheme:dark] placeholder:text-brand-200 focus:border-brand-200 focus:outline-none"
      />
    </label>
  );
}

function SaveButton({ saving }: { saving: boolean }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="btn-brand inline-flex items-center gap-2 rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
    >
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
    </button>
  );
}
