import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SqbQuestionEditor } from "@/components/admin/SqbQuestionEditor";
import { loadQuestionWithAnswers } from "@/components/admin/question-edit-modal";
import {
  emptyAdminQuestion,
  type AdminChoice,
  type AdminQuestion,
} from "@/lib/admin/question";
import { QUESTION_SELECT_COLS } from "@/lib/sqb";
import { applyResolvedImageUrls } from "@/lib/storage-url";

export const Route = createFileRoute("/_authenticated/admin/sqb/questions/$id")({
  component: SqbQuestionPage,
  head: () => ({ meta: [{ title: "SQB Question — BeyondSAT Admin" }] }),
});

function SqbQuestionPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [question, setQuestion] = useState<AdminQuestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (id === "new") {
          const raw = sessionStorage.getItem("sqb-draft");
          sessionStorage.removeItem("sqb-draft");
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as AdminQuestion;
              if (!cancelled) setQuestion({ ...parsed, bank_format: "sqb", id: "" });
              return;
            } catch {
              /* fall through */
            }
          }
          if (!cancelled) setQuestion(emptyAdminQuestion("math", "sqb"));
          return;
        }
        const { data, error: qErr } = await supabase
          .from("questions")
          .select(QUESTION_SELECT_COLS)
          .eq("id", id)
          .single();
        if (qErr || !data) throw new Error(qErr?.message ?? "Question not found.");
        const mapped = {
          ...data,
          choices: (data.choices ?? []) as AdminChoice[],
          bank_format: (data.bank_format as "ordinary" | "sqb") ?? "sqb",
          external_id: data.external_id ?? null,
          assessment: data.assessment ?? null,
          domain: data.domain ?? null,
          subskill: data.subskill ?? null,
          image_alt: data.image_alt ?? null,
          published: data.published !== false,
          correct_choice_id: null,
          correct_grid_answers: [],
          explanation: null,
        } as AdminQuestion;
        const [withImg] = await applyResolvedImageUrls([mapped]);
        const full = await loadQuestionWithAnswers(withImg);
        if (!cancelled) setQuestion(full);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }
  if (error || !question) {
    return <div className="py-12 text-center text-sm text-red-600">{error ?? "Not found"}</div>;
  }

  return (
    <SqbQuestionEditor
      initial={question}
      onSaved={(saved) => {
        if (id === "new" && saved.id) {
          void navigate({
            to: "/admin/sqb/questions/$id",
            params: { id: saved.id },
            replace: true,
          });
        }
      }}
    />
  );
}
