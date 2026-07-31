import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarClock, Flame, ArrowLeft } from "lucide-react";
import { startDailySession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Panel, Skeleton } from "@/components/ui/panel";

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

  /* This gate does three awaited round-trips before it knows which branch to
     render, so it's the longest wait in the practice area. Mirror the hero's
     shape rather than centring a spinner. */
  if (state.kind === "loading") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-56 rounded-2xl" />
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
    <div className="mx-auto max-w-2xl">
      {/* Back link sits on the white page background, so it stays dark until hover. */}
      <button
        onClick={() => navigate({ to: "/practice" })}
        className="nudge mb-4 inline-flex items-center gap-1 text-sm font-bold text-slate-600 hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" /> Practice
      </button>
      <Panel tone="brand" className="rise-in p-8 md:p-8">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-400 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
          <CalendarClock className="h-3 w-3" /> Today's daily
        </div>
        <h1 className="mt-3 text-3xl font-black text-white">{state.title ?? "Daily Test"}</h1>
        <p className="mt-2 text-sm text-brand-100">
          {state.count} mixed questions. Feeds your streak.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={() => navigate({ to: `/practice/session/${state.sessionId}` })}
            className="btn-brand inline-flex items-center gap-2 rounded-lg bg-brand-400 px-5 py-2.5 text-sm font-bold text-white"
          >
            <Flame className="h-4 w-4" /> Start
          </button>
        </div>
      </Panel>
    </div>
  );
}

function CenterCard({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  const navigate = useNavigate();
  return (
    <Panel className="pop-in mx-auto max-w-md p-10 text-center md:p-10">
      <div className="text-4xl">{emoji}</div>
      <h2 className="mt-3 text-xl font-black text-white">{title}</h2>
      <p className="mt-2 text-sm text-brand-100">{body}</p>
      <button
        onClick={() => navigate({ to: "/practice" })}
        className="btn-brand mt-5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold text-white"
      >
        Back to practice
      </button>
    </Panel>
  );
}
