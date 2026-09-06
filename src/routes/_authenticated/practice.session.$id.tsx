import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TestPlayer } from "@/components/TestPlayer";
import {
  emptyAnswer,
  type AnswerState,
  type QuestionRow,
} from "@/components/QuestionCard";
import type { TestType } from "@/lib/session";
import { applyResolvedImageUrls } from "@/lib/storage-url";

export const Route = createFileRoute("/_authenticated/practice/session/$id")({
  component: SessionRunner,
  head: () => ({ meta: [{ title: "Test session — BeyondSAT" }] }),
});

type SessionMeta = {
  question_ids?: string[];
  draft_answers?: unknown;
  [key: string]: unknown;
};

function hydrateDraftAnswers(count: number, drafts: unknown): AnswerState[] {
  const base = Array.from({ length: count }, () => emptyAnswer());
  if (!Array.isArray(drafts)) return base;
  for (let i = 0; i < count; i++) {
    const d = drafts[i];
    if (!d || typeof d !== "object") continue;
    const row = d as Partial<AnswerState>;
    base[i] = {
      selectedChoiceId:
        typeof row.selectedChoiceId === "string" ? row.selectedChoiceId : null,
      gridAnswer: typeof row.gridAnswer === "string" ? row.gridAnswer : "",
      eliminated: Array.isArray(row.eliminated)
        ? row.eliminated.filter((x): x is string => typeof x === "string")
        : [],
      markedForReview: row.markedForReview === true,
      highlights: Array.isArray(row.highlights) ? (row.highlights as AnswerState["highlights"]) : [],
    };
  }
  return base;
}

function SessionRunner() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [type, setType] = useState<TestType>("practice");
  const [userId, setUserId] = useState<string>("");
  const [duration, setDuration] = useState<number>(0);
  const [mockSchedule, setMockSchedule] = useState<
    | {
        rwSeconds: number;
        mathSeconds: number;
        breakSeconds: number;
      }
    | undefined
  >();
  const [initialAnswers, setInitialAnswers] = useState<AnswerState[] | undefined>();
  const [sessionMeta, setSessionMeta] = useState<SessionMeta>({});

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
      const meta = (sess.metadata as SessionMeta) ?? {};
      const ids = meta.question_ids ?? [];
      if (ids.length === 0) {
        setErr("This session has no questions.");
        setLoading(false);
        return;
      }
      /* Chunk `.in("id", …)` — a full mock is ~98 UUIDs and a single GET can
         truncate or fail under URL length limits, which looked like an empty exam. */
      const qs: QuestionRow[] = [];
      const chunkSize = 40;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const { data, error: qErr } = await supabase
          .from("questions")
          .select(
            "id,section,skill,difficulty,kind,prompt,question_text,choices,image_url,time_limit_seconds",
          )
          .in("id", chunk);
        if (qErr) {
          setErr(qErr.message);
          setLoading(false);
          return;
        }
        qs.push(...((data ?? []) as QuestionRow[]));
      }
      const byId = new Map(qs.map((q) => [q.id, q]));
      const ordered = ids.map((qid) => byId.get(qid)).filter(Boolean) as QuestionRow[];
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
      setQuestions(await applyResolvedImageUrls(ordered));

      /* Only mocks get a session clock (module timings). Practice/daily stay
         Untimed — summing per-question time_limit_seconds produced absurd clocks
         (e.g. ~2 minutes for a 20-question mixed set). */
      if (sess.type === "mock" && sess.mock_exam_id) {
        let mx: {
          rw_module1_time_seconds: number | null;
          rw_module2_time_seconds: number | null;
          math_module1_time_seconds: number | null;
          math_module2_time_seconds: number | null;
          section_break_seconds?: number | null;
        } | null = null;
        const withBreak = await supabase
          .from("mock_exams")
          .select(
            "rw_module1_time_seconds,rw_module2_time_seconds,math_module1_time_seconds,math_module2_time_seconds,section_break_seconds",
          )
          .eq("id", sess.mock_exam_id)
          .maybeSingle();
        if (withBreak.error) {
          const fallback = await supabase
            .from("mock_exams")
            .select(
              "rw_module1_time_seconds,rw_module2_time_seconds,math_module1_time_seconds,math_module2_time_seconds",
            )
            .eq("id", sess.mock_exam_id)
            .maybeSingle();
          mx = fallback.data;
        } else {
          mx = withBreak.data;
        }
        if (mx) {
          const rw =
            (mx.rw_module1_time_seconds ?? 0) + (mx.rw_module2_time_seconds ?? 0);
          const math =
            (mx.math_module1_time_seconds ?? 0) + (mx.math_module2_time_seconds ?? 0);
          const breakSeconds =
            typeof mx.section_break_seconds === "number" ? mx.section_break_seconds : 1200;
          setMockSchedule({ rwSeconds: rw, mathSeconds: math, breakSeconds });
          /* Total remaining clock for resume fallback / non-sectioned display. */
          setDuration(rw + math);
        }
      }

      setInitialAnswers(hydrateDraftAnswers(ordered.length, meta.draft_answers));
      setSessionMeta(meta);
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
      mockSchedule={mockSchedule}
      initialAnswers={initialAnswers}
      sessionMetadata={sessionMeta}
      onExit={() => navigate({ to: "/practice" })}
    />
  );
}
