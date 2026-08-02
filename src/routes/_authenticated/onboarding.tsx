import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, Loader2, Sparkles, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/panel";

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

/* `exam_date` is a Postgres DATE, so it arrives as a bare "YYYY-MM-DD".
   `new Date("2026-08-29")` parses that as UTC midnight, which formats as the
   28th for anyone west of Greenwich. Split the parts and build a local date so
   the day shown is the day stored. */
function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function todayYmd(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

function Onboarding() {
  const navigate = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [examDate, setExamDate] = useState<string>("");
  const [targetRw, setTargetRw] = useState<string>("700");
  const [targetMath, setTargetMath] = useState<string>("700");
  const [dateOptions, setDateOptions] = useState<ExamDateOpt[]>([]);
  /* When an admin hasn't published any exam dates yet, onboarding used to be a
     dead end: the only control was a select with nothing in it, so Continue
     stayed disabled forever. Since every authenticated route redirects here
     until intro_completed is true, that locked *everyone* out of the app —
     including the first admin, the only person who could add the dates.
     Manual entry is the escape hatch. */
  const [manual, setManual] = useState(false);
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
          .gte("exam_date", todayYmd())
          .order("exam_date", { ascending: true }),
      ]);

      if (prof?.intro_completed) {
        navigate({ to: "/dashboard", replace: true });
        return;
      }

      const opts = (dates ?? []) as ExamDateOpt[];
      setDateOptions(opts);
      if (sp?.exam_date) {
        /* Keep a previously saved date even when it isn't one of the published
           options — it was chosen deliberately, so drop into manual mode
           rather than silently discarding it. */
        setExamDate(sp.exam_date);
        if (!opts.some((o) => o.exam_date === sp.exam_date)) setManual(true);
      }
      if (opts.length === 0) setManual(true);
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
    ? Math.max(
        0,
        Math.round(
          (parseLocalDate(examDate).getTime() - parseLocalDate(todayYmd()).getTime()) / 86400000,
        ),
      )
    : null;

  const rwNum = Number(targetRw);
  const mathNum = Number(targetMath);
  const totalNum = (rwNum || 0) + (mathNum || 0);

  function switchMode(toManual: boolean) {
    setManual(toManual);
    setExamDate("");
    setErr(null);
  }

  async function finish() {
    if (!uid) return;
    if (!examDate) {
      setErr("Please pick your exam date.");
      return;
    }
    if (manual) {
      const picked = parseLocalDate(examDate);
      if (Number.isNaN(picked.getTime())) {
        setErr("That doesn't look like a valid date.");
        return;
      }
      if (picked.getTime() < parseLocalDate(todayYmd()).getTime()) {
        setErr("Your exam date can't be in the past.");
        return;
      }
      const limit = new Date();
      limit.setFullYear(limit.getFullYear() + 3);
      if (picked.getTime() > limit.getTime()) {
        setErr("Please pick a date within the next three years.");
        return;
      }
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
    /* This route renders outside the app shell, so the skeleton has to draw its
       own centred card on the white page — head, two target fields, the date
       select and the button. */
    return (
      <div className="grid min-h-screen place-items-center bg-white p-6">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-full" />
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Skeleton className="h-[70px] rounded-xl" />
            <Skeleton className="h-[70px] rounded-xl" />
          </div>
          <Skeleton className="h-11 rounded-xl" />
          <Skeleton className="h-[70px] rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
      </div>
    );
  }

  const fieldClass =
    "w-full rounded-xl border-2 border-brand-400/50 bg-brand-800 px-4 py-3 text-lg font-semibold text-white [color-scheme:dark] focus:border-brand-200 focus:outline-none";

  return (
    <div className="grid min-h-screen place-items-center bg-white p-6">
      <div className="pop-in w-full max-w-md rounded-3xl border border-brand-400/40 bg-brand-600 p-8 text-white shadow-brand md:p-10">
        <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-brand-400 text-white">
          <CalendarDays className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">
          Set your SAT goals
        </h1>
        <p className="mt-2 text-sm text-brand-100">
          Pick your exam date and set separate targets for English and Math. You can update these any time from your profile.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-100">
              <Target className="h-3.5 w-3.5" /> English (R&W)
            </span>
            <input
              type="number"
              min={200}
              max={800}
              step={10}
              value={targetRw}
              onChange={(e) => setTargetRw(e.target.value)}
              className={fieldClass}
            />
            <span className="text-[11px] text-brand-200">200–800</span>
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-100">
              <Target className="h-3.5 w-3.5" /> Math
            </span>
            <input
              type="number"
              min={200}
              max={800}
              step={10}
              value={targetMath}
              onChange={(e) => setTargetMath(e.target.value)}
              className={fieldClass}
            />
            <span className="text-[11px] text-brand-200">200–800</span>
          </label>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-xl border border-brand-400/40 bg-brand-800 px-4 py-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-100">Total target</span>
          <span className="text-lg font-black tabular-nums text-white">
            {totalNum || "—"} <span className="text-xs font-bold text-brand-200">/ 1600</span>
          </span>
        </div>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-brand-100">
            Exam date
          </span>
          {manual ? (
            <>
              <input
                type="date"
                value={examDate}
                min={todayYmd()}
                onChange={(e) => setExamDate(e.target.value)}
                className={fieldClass}
              />
              {dateOptions.length === 0 && (
                <span className="mt-1.5 block text-[11px] text-brand-200">
                  No official dates published yet — enter the date you plan to sit the SAT. You can
                  change it any time from your profile.
                </span>
              )}
            </>
          ) : (
            <select
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className={fieldClass}
            >
              <option value="">Select an exam date…</option>
              {dateOptions.map((d) => (
                <option key={d.id} value={d.exam_date}>
                  {format(parseLocalDate(d.exam_date), "EEEE, MMMM d, yyyy")}
                  {d.label ? ` — ${d.label}` : ""}
                </option>
              ))}
            </select>
          )}
          {dateOptions.length > 0 && (
            <button
              type="button"
              onClick={() => switchMode(!manual)}
              className="mt-2 text-xs font-bold text-brand-100 underline decoration-brand-300 underline-offset-2 transition-colors hover:text-white"
            >
              {manual ? "Choose from published dates" : "My date isn't listed — enter it myself"}
            </button>
          )}
        </label>

        {daysLeft !== null && (
          <div className="pop-in mt-4 flex items-center gap-2 rounded-xl border border-brand-200/50 bg-brand-400 px-4 py-3">
            <Sparkles className="h-4 w-4 text-white" />
            <span className="text-sm font-bold text-white">
              {daysLeft === 0 ? "Exam is today!" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} until your exam`}
            </span>
          </div>
        )}

        {/* Errors read as a darker inset chip with a light ring rather than red —
            the copy already says what went wrong. */}
        {err && (
          <div className="mt-3 rounded-lg bg-brand-900 px-3 py-2 text-sm font-semibold text-white ring-1 ring-brand-300/60">
            {err}
          </div>
        )}

        <button
          onClick={finish}
          disabled={saving || !examDate || !rwNum || !mathNum}
          className="btn-brand mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-400 py-3.5 font-bold text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Continue to BeyondSAT
        </button>
      </div>
    </div>
  );
}
