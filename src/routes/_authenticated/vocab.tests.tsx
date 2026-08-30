import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHead, Panel, EmptyState } from "@/components/ui/panel";
import type { VocabQuiz } from "@/lib/vocab/types";
import { ListSkeleton } from "@/components/ui/skeletons";

export const Route = createFileRoute("/_authenticated/vocab/tests")({
  component: VocabTestsList,
});

function VocabTestsList() {
  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState<VocabQuiz[]>([]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("vocab_quizzes")
        .select("*")
        .order("created_at", { ascending: false });
      setQuizzes((data ?? []) as VocabQuiz[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <PageHead
        title="Vocab tests"
        subtitle="Digital SAT Words-in-Context practice with timed quizzes."
      />

      {loading ? (
        <ListSkeleton rows={4} />
      ) : quizzes.length === 0 ? (
        <EmptyState title="No quizzes yet" description="Your instructor will publish vocab tests soon." />
      ) : (
        <div className="space-y-3">
          {quizzes.map((q) => (
            <Link key={q.id} to="/vocab/tests/$id" params={{ id: q.id }} className="block">
              <Panel className="group flex items-center justify-between p-5 transition hover:border-brand-400/40">
                <div>
                  <h2 className="font-bold text-white">{q.title}</h2>
                  {q.description ? (
                    <p className="mt-1 text-sm text-white/60">{q.description}</p>
                  ) : null}
                  {q.time_limit_seconds ? (
                    <p className="mt-2 flex items-center gap-1 text-xs text-white/50">
                      <Clock className="h-3.5 w-3.5" />
                      {Math.round(q.time_limit_seconds / 60)} min limit
                    </p>
                  ) : null}
                </div>
                <ArrowRight className="h-5 w-5 text-white/30 transition group-hover:text-brand-300" />
              </Panel>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
