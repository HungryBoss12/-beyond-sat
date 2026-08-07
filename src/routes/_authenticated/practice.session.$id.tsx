import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TestPlayer } from "@/components/TestPlayer";
import type { QuestionRow } from "@/components/QuestionCard";
import type { TestType } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/practice/session/$id")({
  component: SessionRunner,
  head: () => ({ meta: [{ title: "Test session — BeyondSAT" }] }),
});

function SessionRunner() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [type, setType] = useState<TestType>("practice");
  const [userId, setUserId] = useState<string>("");
  const [duration, setDuration] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        navigate({ to: "/signin", replace: true });
        return;
      }
      setUserId(uid);
      const { data: sess, error } = await supabase
        .from("test_sessions")
        .select("id,type,metadata,mock_exam_id,daily_test_id,completed_at")
        .eq("id", id)
        .eq("user_id", uid)
        .maybeSingle();
      if (error || !sess) {
        setErr("Session not found.");
        setLoading(false);
        return;
      }
      if (sess.completed_at) {
        navigate({ to: "/practice" });
        return;
      }
      setType(sess.type as TestType);
      const meta = (sess.metadata as { question_ids?: string[] }) ?? {};
      const ids = meta.question_ids ?? [];
      if (ids.length === 0) {
        setErr("This session has no questions.");
        setLoading(false);
        return;
      }
      const { data: qs, error: qErr } = await supabase
        .from("questions")
        .select("id,section,skill,difficulty,kind,prompt,question_text,choices,image_url,time_limit_seconds")
        .in("id", ids);
      if (qErr) {
        setErr(qErr.message);
        setLoading(false);
        return;
      }
      const byId = new Map((qs ?? []).map((q) => [q.id, q]));
      const ordered = ids
        .map((qid) => byId.get(qid))
        .filter(Boolean) as QuestionRow[];
      /* `ids` being non-empty doesn't guarantee any rows came back — questions
         can be deleted after a session is created, and the reorder above drops
         every id that no longer resolves. Handing TestPlayer an empty array left
         its current question undefined, which QuestionCard then dereferenced,
         throwing mid-render and blanking the whole screen. */
      if (ordered.length === 0) {
        setErr("The questions in this session are no longer available.");
        setLoading(false);
        return;
      }
      setQuestions(ordered);


      // duration: mocks use module timings; practice/daily sum admin-set per-question limits
      if (sess.type === "mock" && sess.mock_exam_id) {
        const { data: mx } = await supabase
          .from("mock_exams")
          .select("rw_module1_time_seconds,rw_module2_time_seconds,math_module1_time_seconds,math_module2_time_seconds")
          .eq("id", sess.mock_exam_id)
          .maybeSingle();
        if (mx) {
          setDuration(
            (mx.rw_module1_time_seconds ?? 0) +
              (mx.rw_module2_time_seconds ?? 0) +
              (mx.math_module1_time_seconds ?? 0) +
              (mx.math_module2_time_seconds ?? 0),
          );
        }
      } else {
        const total = ordered.reduce(
          (acc, q: any) => acc + (q.time_limit_seconds ?? 0),
          0,
        );
        if (total > 0) setDuration(total);
      }
      setLoading(false);
    })();
  }, [id, navigate]);

  /* Sketch the player's chrome — header bar, dashed rule, split panes, footer —
     so the wait reads as "your test is coming up" instead of a bare spinner.
     This route renders outside AppShell, so it supplies its own page padding.
     It has to track TestPlayer's chrome: a skeleton that paints the wrong bars
     flashes one layout and then swaps to another. */
  /* The runner is a light surface, so these use `skeleton-light` rather than the
     app-wide `Skeleton` — that one shimmers through the dark blue ramp and would
     flash a navy slab before the white test UI paints. */
  if (loading) {
    return (
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-test-canvas">
        <div className="h-16 w-full shrink-0 border-b border-dashed border-test-edge bg-test-chrome" />
        <div className="h-6 w-full shrink-0 bg-test-banner" />
        <div className="flex min-h-0 flex-1">
          <div className="hidden flex-1 border-r border-test-line p-6 md:block">
            <div className="skeleton-light h-full rounded" />
          </div>
          <div className="flex-1 space-y-4 p-6">
            <div className="skeleton-light h-7 w-32 rounded" />
            <div className="skeleton-light h-20 rounded" />
            <div className="skeleton-light h-14 rounded-lg" />
            <div className="skeleton-light h-14 rounded-lg" />
            <div className="skeleton-light h-14 rounded-lg" />
            <div className="skeleton-light h-14 rounded-lg" />
          </div>
        </div>
        <div className="flex h-16 shrink-0 items-center justify-between border-t border-test-line bg-test-chrome px-4 sm:px-6">
          <div className="skeleton-light h-6 w-32 rounded" />
          <div className="skeleton-light h-9 w-40 rounded-md" />
          <div className="skeleton-light h-10 w-28 rounded-full" />
        </div>
      </div>
    );
  }
  if (err) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-test-chrome px-4 py-6 sm:px-6">
        <div className="w-full max-w-md rounded-lg border border-test-line bg-white p-8 text-center shadow-panel">
          <h1 className="text-xl font-black tracking-tight text-test-ink">{err}</h1>
          <p className="mt-2 text-sm text-test-muted">
            The session may have been removed, or it belongs to another account.
          </p>
          <button
            onClick={() => navigate({ to: "/practice" })}
            className="btn-test mt-6 rounded-full bg-test-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-test-accent-deep"
          >
            Back to practice
          </button>
        </div>
      </div>
    );
  }

  return (
    <TestPlayer
      sessionId={id}
      type={type}
      userId={userId}
      questions={questions}
      durationSeconds={duration}
      onExit={() => navigate({ to: "/practice" })}
    />
  );
}
