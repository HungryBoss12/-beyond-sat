import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ClipboardList, Clock, ArrowLeft, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { startMockSession } from "@/lib/session";

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
        .select("id,title,description,rw_module1_time_seconds,rw_module2_time_seconds,math_module1_time_seconds,math_module2_time_seconds")
        .eq("published", true)
        .order("created_at", { ascending: false });
      const rows = (data ?? []) as Omit<Mock, "questionCount">[];
      const withCounts: Mock[] = [];
      for (const m of rows) {
        // Prefer sections-based count (newer format); fall back to legacy per-question rows.
        const { count: sectionsCount } = await supabase
          .from("mock_exam_sections")
          .select("*", { count: "exact", head: true })
          .eq("mock_exam_id", m.id)
          .not("test_id", "is", null);
        let questionCount = 0;
        if (sectionsCount && sectionsCount > 0) {
          const { data: testIds } = await supabase
            .from("mock_exam_sections")
            .select("test_id")
            .eq("mock_exam_id", m.id)
            .not("test_id", "is", null);
          const ids = (testIds ?? []).map((r) => r.test_id as string);
          if (ids.length > 0) {
            const { count } = await supabase
              .from("test_questions")
              .select("*", { count: "exact", head: true })
              .in("test_id", ids);
            questionCount = count ?? 0;
          }
        } else {
          const { count } = await supabase
            .from("mock_exam_questions")
            .select("*", { count: "exact", head: true })
            .eq("mock_exam_id", m.id);
          questionCount = count ?? 0;
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
    } catch (e: any) {
      alert(e.message ?? "Could not start mock exam.");
      setStarting(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/practice" })}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-slate-600 hover:text-primary transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Mock Exams</h1>
          <p className="text-sm text-slate-600">Full-length practice tests. Timed, scored, adaptive-style.</p>
        </div>
      </div>

      {mocks == null ? (
        <div className="grid place-items-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : mocks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center soft-shadow">
          <ClipboardList className="h-8 w-8 mx-auto text-slate-400" />
          <h2 className="mt-3 text-lg font-bold text-slate-800">No mock exams yet</h2>
          <p className="text-sm text-slate-500 mt-1">Admins will publish full-length tests here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
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
                className="rounded-2xl border border-border bg-white p-5 flex items-start justify-between gap-4 soft-shadow"
              >
                <div className="min-w-0">
                  <h3 className="text-lg font-black text-primary">{m.title}</h3>
                  {m.description && (
                    <p className="mt-1 text-sm text-slate-600 line-clamp-2">{m.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
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
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50 hover:bg-blue-700 transition shrink-0"
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
