import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookText, Calculator, ClipboardList, CalendarClock, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/practice/")({
  component: PracticeLanding,
});

function PracticeLanding() {
  const [rwCount, setRwCount] = useState<number | null>(null);
  const [mathCount, setMathCount] = useState<number | null>(null);
  const [mockCount, setMockCount] = useState<number | null>(null);
  const [dailyExists, setDailyExists] = useState<boolean>(false);
  const [dailyDone, setDailyDone] = useState<boolean>(false);
  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    (async () => {
      const [{ count: rw }, { count: m }, { count: mocks }, { data: dt }, { data: userData }] =
        await Promise.all([
          supabase
            .from("questions")
            .select("*", { count: "exact", head: true })
            .eq("section", "reading_writing"),
          supabase.from("questions").select("*", { count: "exact", head: true }).eq("section", "math"),
          supabase
            .from("mock_exams")
            .select("*", { count: "exact", head: true })
            .eq("published", true),
          supabase.from("daily_tests").select("id").eq("date", today).maybeSingle(),
          supabase.auth.getUser(),
        ]);
      setRwCount(rw ?? 0);
      setMathCount(m ?? 0);
      setMockCount(mocks ?? 0);
      setDailyExists(!!dt);
      const uid = userData.user?.id;
      if (uid) {
        const { data: sp } = await supabase
          .from("student_profiles")
          .select("last_daily_completed_date")
          .eq("user_id", uid)
          .maybeSingle();
        setDailyDone(sp?.last_daily_completed_date === today);
      }
    })();
  }, [today]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Practice</h1>
        <p className="text-sm text-slate-600 mt-1">
          Choose a section, jump into today's daily test, or take a full mock exam.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <SectionCard
          to="/practice/reading_writing"
          icon={<BookText className="h-6 w-6" />}
          title="Reading & Writing"
          count={rwCount}
          accent="from-indigo-500 to-primary"
        />
        <SectionCard
          to="/practice/math"
          icon={<Calculator className="h-6 w-6" />}
          title="Math"
          count={mathCount}
          accent="from-emerald-500 to-teal-700"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 soft-shadow">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-50 text-orange-600">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-black text-slate-900">Today's daily test</div>
              <div className="text-xs text-slate-500">
                {dailyExists
                  ? dailyDone
                    ? "You've completed today's test. Nice."
                    : "Short mixed set. Feeds your streak."
                  : "No daily test posted for today yet."}
              </div>
            </div>
          </div>
          <Link
            to={dailyExists && !dailyDone ? "/practice/daily" : "/practice/daily"}
            aria-disabled={!dailyExists || dailyDone}
            className={
              "mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition " +
              (!dailyExists || dailyDone ? "opacity-40 pointer-events-none" : "")
            }
          >
            {dailyDone ? "Completed" : "Start"} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 soft-shadow">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-black text-slate-900">Full mock exams</div>
              <div className="text-xs text-slate-500">
                {mockCount ?? 0} exam{mockCount === 1 ? "" : "s"} available · two-module adaptive
              </div>
            </div>
          </div>
          <Link
            to="/practice/mock"
            aria-disabled={!mockCount}
            className={
              "mt-5 inline-flex items-center gap-2 rounded-lg border border-blue-600 px-4 py-2.5 text-sm font-bold text-blue-600 hover:bg-blue-50 transition " +
              (!mockCount ? "opacity-40 pointer-events-none" : "")
            }
          >
            Browse mocks <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  to,
  icon,
  title,
  count,
  accent,
}: {
  to: "/practice/reading_writing" | "/practice/math";
  icon: React.ReactNode;
  title: string;
  count: number | null;
  accent: string;
}) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 soft-shadow hover:border-blue-600/40 transition"
    >
      <div className={"absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br " + accent + " opacity-10"} />
      <div className="relative">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600">{icon}</div>
        <h2 className="mt-4 text-2xl font-black text-slate-900">{title}</h2>
        <div className="mt-1 text-sm text-slate-500">
          <span className="text-slate-900 font-black tabular-nums">{count ?? "—"}</span> questions available
        </div>
        <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 group-hover:gap-2.5 transition-all">
          Practice this section <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}
