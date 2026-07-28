import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CalendarClock, Flame, ArrowLeft } from "lucide-react";
import { startDailySession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/practice/daily")({
  component: DailyGate,
  head: () => ({ meta: [{ title: "Daily Test — BeyondSAT" }] }),
});

function DailyGate() {
  const navigate = useNavigate();
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "not-available" }
    | { kind: "done" }
    | { kind: "ready"; sessionId: string; title: string | null; count: number }
  >({ kind: "loading" });

  useEffect(() => {
    (async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      const { data: dt } = await supabase
        .from("daily_tests")
        .select("id,title")
        .eq("date", today)
        .maybeSingle();
      if (!dt) {
        setState({ kind: "not-available" });
        return;
      }
      if (uid) {
        const { data: sp } = await supabase
          .from("student_profiles")
          .select("last_daily_completed_date")
          .eq("user_id", uid)
          .maybeSingle();
        if (sp?.last_daily_completed_date === today) {
          setState({ kind: "done" });
          return;
        }
      }
      try {
        const { sessionId } = await startDailySession();
        const { data: sess } = await supabase
          .from("test_sessions")
          .select("total_questions")
          .eq("id", sessionId)
          .maybeSingle();
        setState({
          kind: "ready",
          sessionId,
          title: dt.title,
          count: sess?.total_questions ?? 0,
        });
      } catch (e: any) {
        setState({ kind: "not-available" });
      }
    })();
  }, []);

  if (state.kind === "loading") {
    return (
      <div className="grid place-items-center h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (state.kind === "done") {
    return <CenterCard emoji="🔥" title="Streak locked in for today." body="Come back tomorrow for a fresh set." />;
  }
  if (state.kind === "not-available") {
    return <CenterCard emoji="📅" title="No daily test today." body="Check back once an admin posts today's set." />;
  }
  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate({ to: "/practice" })}
        className="inline-flex items-center gap-1 text-sm font-bold text-slate-600 hover:text-primary mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Practice
      </button>
      <div className="rounded-2xl bg-gradient-to-br from-primary to-[#00234a] text-white p-8 soft-shadow">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
          <CalendarClock className="h-3 w-3" /> Today's daily
        </div>
        <h1 className="mt-3 text-3xl font-black">{state.title ?? "Daily Test"}</h1>
        <p className="mt-2 text-white/70 text-sm">
          {state.count} mixed questions. Feeds your streak.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={() => navigate({ to: `/practice/session/${state.sessionId}` })}
            className="inline-flex items-center gap-2 rounded-lg bg-white text-primary px-5 py-2.5 text-sm font-bold hover:bg-white/90 transition"
          >
            <Flame className="h-4 w-4" /> Start
          </button>
        </div>
      </div>
    </div>
  );
}

function CenterCard({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  const navigate = useNavigate();
  return (
    <div className="max-w-md mx-auto rounded-2xl border border-border bg-white p-10 text-center soft-shadow">
      <div className="text-4xl">{emoji}</div>
      <h2 className="mt-3 text-xl font-black text-primary">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{body}</p>
      <button
        onClick={() => navigate({ to: "/practice" })}
        className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white"
      >
        Back to practice
      </button>
    </div>
  );
}
