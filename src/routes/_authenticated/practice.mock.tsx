import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ClipboardList, Clock, ArrowLeft, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { startMockSession } from "@/lib/session";
import { EmptyState } from "@/components/ui/panel";
import { ListSkeleton } from "@/components/ui/skeletons";
import { errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/practice/mock")({
  component: MockList,
  head: () => ({ meta: [{ title: "Mock Exams — BeyondSAT" }] }),
});

type Mock = {
  id: string;
  title: string;
  description: string | null;
  rw_module1_time_seconds: number;
  rw_module2_time_seconds: number;
  math_module1_time_seconds: number;
  math_module2_time_seconds: number;
  questionCount: number;
};

function MockList() {
  const navigate = useNavigate();
  const [mocks, setMocks] = useState<Mock[] | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("mock_exams")
        .select(
          "id,title,description,rw_module1_time_seconds,rw_module2_time_seconds,math_module1_time_seconds,math_module2_time_seconds",
        )
        .eq("published", true)
        .order("created_at", { ascending: false });
      const rows = (data ?? []) as Omit<Mock, "questionCount">[];
      const withCounts: Mock[] = [];
      for (const m of rows) {
        /* Counts come from fetched rows rather than `{ count: "exact", head: true }`.
           A head request's count arrives in the Content-Range header, which isn't
           always readable client-side — when it isn't, `count` is null. That made
           every exam show "0 questions", and worse, a null `sectionsCount` fell
           through to the legacy branch below and counted the wrong table. */
        const { data: sectionRows } = await supabase
          .from("mock_exam_sections")
          .select("test_id")
          .eq("mock_exam_id", m.id)
          .not("test_id", "is", null);
        const testIds = (sectionRows ?? []).map((r) => r.test_id as string);
        let questionCount = 0;
        // Prefer sections-based count (newer format); fall back to legacy per-question rows.
        if (testIds.length > 0) {
          const { data: tq } = await supabase
            .from("test_questions")
            .select("id")
            .in("test_id", testIds);
          questionCount = (tq ?? []).length;
        } else {
          const { data: meq } = await supabase
            .from("mock_exam_questions")
            .select("id")
            .eq("mock_exam_id", m.id);
          questionCount = (meq ?? []).length;
        }
        withCounts.push({ ...m, questionCount });
      }
      setMocks(withCounts);
    })();
  }, []);

  async function start(id: string) {
    setStarting(id);
    try {
      const { sessionId } = await startMockSession(id);
      navigate({ to: `/practice/session/${sessionId}` });
    } catch (e: unknown) {
      alert(errorMessage(e, "Could not start mock exam."));
      setStarting(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rise-in flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/practice" })}
          className="tap inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-panel hover:bg-brand-400"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          {/* Was text-white, which made the heading invisible against the white page. */}
          <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
            Mock Exams
          </h1>
          <p className="text-sm text-slate-500">Full-length practice tests. Timed and scored.</p>
        </div>
      </div>

      {mocks == null ? (
        <ListSkeleton rows={3} />
      ) : mocks.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title="No mock exams yet"
          body="Admins will publish full-length tests here."
          className="py-14"
        />
      ) : (
        <ul className="stagger space-y-3">
          {mocks.map((m) => {
            const totalMin = Math.round(
              (m.rw_module1_time_seconds +
                m.rw_module2_time_seconds +
                m.math_module1_time_seconds +
                m.math_module2_time_seconds) /
                60,
            );
            return (
              <li
                key={m.id}
                className="lift flex items-start justify-between gap-4 rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-panel"
              >
                <div className="min-w-0">
                  <h3 className="text-lg font-black text-white">{m.title}</h3>
                  {m.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-brand-100">{m.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-brand-100">
                    <span className="inline-flex items-center gap-1">
                      <ClipboardList className="h-3.5 w-3.5" /> {m.questionCount} questions
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> ~{totalMin} min
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => start(m.id)}
                  disabled={m.questionCount === 0 || starting === m.id}
                  className="btn-brand inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                >
                  {starting === m.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Start
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
