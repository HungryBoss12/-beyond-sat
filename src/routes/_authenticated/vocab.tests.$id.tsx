import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VocabQuizPlayer } from "@/components/vocab/VocabQuizPlayer";
import type { VocabQuiz, VocabQuizQuestion } from "@/lib/vocab/types";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/vocab/tests/$id")({
  component: VocabTestRun,
});

function VocabTestRun() {
  const { id } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<VocabQuiz | null>(null);
  const [questions, setQuestions] = useState<VocabQuizQuestion[]>([]);

  useEffect(() => {
    void (async () => {
      const [{ data: qz }, { data: qs }] = await Promise.all([
        supabase.from("vocab_quizzes").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("vocab_quiz_questions")
          .select("*")
          .eq("quiz_id", id)
          .order("position", { ascending: true }),
      ]);

      setQuiz(qz as VocabQuiz | null);
      setQuestions((qs ?? []) as VocabQuizQuestion[]);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#0b0761]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-300" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#0b0761] text-white">
        Quiz not found.
      </div>
    );
  }

  return <VocabQuizPlayer quiz={quiz} questions={questions} />;
}
