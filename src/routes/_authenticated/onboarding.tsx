import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, Loader2, Sparkles, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
  head: () => ({
    meta: [
      { title: "Welcome — BeyondSAT" },
      { name: "description", content: "Set your target score and exam date to personalize your BeyondSAT prep." },
    ],
  }),
});

type ExamDateOpt = { id: string; exam_date: string; label: string | null };

function Onboarding() {
  const navigate = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [examDate, setExamDate] = useState<string>("");
  const [targetRw, setTargetRw] = useState<string>("700");
  const [targetMath, setTargetMath] = useState<string>("700");
  const [dateOptions, setDateOptions] = useState<ExamDateOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        const { data: sess } = await supabase.auth.getSession();
        user = sess.session?.user ?? null;
      }
      if (!user) {
        await new Promise((r) => setTimeout(r, 400));
        user = (await supabase.auth.getUser()).data.user;
      }
      if (!user) {
        navigate({ to: "/signin", replace: true });
        return;
      }
      if (cancelled) return;
      setUid(user.id);

      const [{ data: prof }, { data: sp }, { data: dates }] = await Promise.all([
        supabase.from("profiles").select("intro_completed").eq("id", user.id).maybeSingle(),
        supabase
          .from("student_profiles")
          .select("exam_date,target_rw,target_math,target_score")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("exam_dates")
          .select("id,exam_date,label")
          .eq("active", true)
          .gte("exam_date", new Date().toISOString().slice(0, 10))
          .order("exam_date", { ascending: true }),
      ]);

      if (prof?.intro_completed) {
        navigate({ to: "/dashboard", replace: true });
        return;
      }

      const opts = (dates ?? []) as ExamDateOpt[];
      setDateOptions(opts);
      if (sp?.exam_date && opts.some((o) => o.exam_date === sp.exam_date)) {
        setExamDate(sp.exam_date);
      }
      if (sp?.target_rw) setTargetRw(String(sp.target_rw));
      if (sp?.target_math) setTargetMath(String(sp.target_math));
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const daysLeft = examDate
    ? Math.max(0, Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000))
    : null;

  const rwNum = Number(targetRw);
  const mathNum = Number(targetMath);
  const totalNum = (rwNum || 0) + (mathNum || 0);

  async function finish() {
    if (!uid) return;
    if (!examDate) {
      setErr("Please pick your exam date.");
      return;
    }
    if (!rwNum || rwNum < 200 || rwNum > 800) {
      setErr("Reading & Writing target must be between 200 and 800.");
      return;
    }
    if (!mathNum || mathNum < 200 || mathNum > 800) {
      setErr("Math target must be between 200 and 800.");
      return;
    }
    setSaving(true);
    setErr(null);
    const { error: spErr } = await supabase
      .from("student_profiles")
      .upsert(
        {
          user_id: uid,
          exam_date: examDate,
          target_rw: rwNum,
          target_math: mathNum,
          target_score: rwNum + mathNum,
          step: 1,
          intro_completed_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (spErr) {
      setSaving(false);
      setErr(spErr.message);
      return;
    }
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", uid)
      .maybeSingle();
    if (!existing) {
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from("profiles").insert({
        id: uid,
        email: userData.user?.email ?? null,
        intro_completed: true,
      });
    } else {
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ intro_completed: true })
        .eq("id", uid);
      if (pErr) {
        setSaving(false);
        setErr(pErr.message);
        return;
      }
    }
    setSaving(false);
    navigate({ to: "/dashboard", replace: true });
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-blue-600 to-blue-700 text-white p-6">
      <div className="w-full max-w-md rounded-3xl bg-white text-slate-800 p-8 md:p-10 shadow-2xl">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-600 mb-5">
          <CalendarDays className="h-7 w-7" />
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
          Set your SAT goals
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Pick your exam date and set separate targets for English and Math. You can update these any time from your profile.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              <Target className="h-3.5 w-3.5" /> English (R&W)
            </span>
            <input
              type="number"
              min={200}
              max={800}
              step={10}
              value={targetRw}
              onChange={(e) => setTargetRw(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-lg font-semibold text-slate-800 focus:border-blue-600 focus:outline-none"
            />
            <span className="text-[11px] text-slate-500">200–800</span>
          </label>
          <label className="block">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              <Target className="h-3.5 w-3.5" /> Math
            </span>
            <input
              type="number"
              min={200}
              max={800}
              step={10}
              value={targetMath}
              onChange={(e) => setTargetMath(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-lg font-semibold text-slate-800 focus:border-blue-600 focus:outline-none"
            />
            <span className="text-[11px] text-slate-500">200–800</span>
          </label>
        </div>

        <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total target</span>
          <span className="text-lg font-black text-blue-600 tabular-nums">
            {totalNum || "—"} <span className="text-xs font-bold text-slate-400">/ 1600</span>
          </span>
        </div>

        <label className="mt-4 block">
          <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Exam date
          </span>
          {dateOptions.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
              No official exam dates published yet. Please check back soon.
            </div>
          ) : (
            <select
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-lg font-semibold text-slate-800 focus:border-blue-600 focus:outline-none bg-white"
            >
              <option value="">Select an exam date…</option>
              {dateOptions.map((d) => (
                <option key={d.id} value={d.exam_date}>
                  {format(new Date(d.exam_date), "EEEE, MMMM d, yyyy")}
                  {d.label ? ` — ${d.label}` : ""}
                </option>
              ))}
            </select>
          )}
        </label>

        {daysLeft !== null && (
          <div className="mt-4 rounded-xl bg-blue-50 border border-blue-600/10 px-4 py-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-bold text-blue-600">
              {daysLeft === 0 ? "Exam is today!" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} until your exam`}
            </span>
          </div>
        )}

        {err && <div className="mt-3 text-sm text-red-600">{err}</div>}

        <button
          onClick={finish}
          disabled={saving || !examDate || !rwNum || !mathNum}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white font-bold py-3.5 hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Continue to BeyondSAT
        </button>
      </div>
    </div>
  );
}
