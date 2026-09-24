import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Edit3, ImageIcon, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  SECTION_LABEL,
  formatSourceDate,
  difficultyColor,
  type Section,
} from "@/lib/sat";
import { ListSkeleton } from "@/components/ui/skeletons";
import { loadQuestionWithAnswers } from "@/components/admin/question-edit-modal";
import {
  type AdminChoice,
  type AdminQuestion,
  type BankFormat,
} from "@/lib/admin/question";
import { QUESTION_SELECT_COLS } from "@/lib/sqb";
import { applyResolvedImageUrls } from "@/lib/storage-url";

export const Route = createFileRoute("/_authenticated/admin/sqb/questions/")({
  component: AdminSqbQuestions,
  head: () => ({ meta: [{ title: "SQB Questions — BeyondSAT Admin" }] }),
});

function AdminSqbQuestions() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Section | "all">("all");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("questions")
      .select(QUESTION_SELECT_COLS)
      .eq("bank_format", "sqb")
      .order("created_at", { ascending: false })
      .limit(300);
    if (filter !== "all") q = q.eq("section", filter);
    const { data } = await q;
    const mapped = (data ?? []).map((r) => ({
      ...r,
      choices: (r.choices ?? []) as AdminChoice[],
      bank_format: "sqb" as BankFormat,
      external_id: r.external_id ?? null,
      assessment: r.assessment ?? null,
      domain: r.domain ?? null,
      subskill: r.subskill ?? null,
      image_alt: r.image_alt ?? null,
      published: r.published !== false,
      correct_choice_id: null,
      correct_grid_answers: [],
      explanation: null,
      time_limit_seconds: r.time_limit_seconds ?? null,
    }));
    setItems(await applyResolvedImageUrls(mapped));
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    if (!confirm("Delete this SQB question?")) return;
    await supabase.from("questions").delete().eq("id", id);
    void load();
  }

  async function duplicate(q: AdminQuestion) {
    const full = await loadQuestionWithAnswers(q);
    sessionStorage.setItem(
      "sqb-draft",
      JSON.stringify({ ...full, id: "", published: false, bank_format: "sqb" }),
    );
    void navigate({ to: "/admin/sqb/questions/$id", params: { id: "new" } });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black tracking-tight text-brand-900">SQB Questions</h1>
          <p className="mt-1 text-sm text-slate-500">
            Question Bank–format items. Publish from the editor before adding to a live test.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-2">
            {(["all", "reading_writing", "math"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={
                  "tap rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider " +
                  (filter === k
                    ? "bg-brand-400 text-white"
                    : "bg-brand-600 text-brand-100 hover:bg-brand-500 hover:text-white")
                }
              >
                {k === "all" ? "All" : SECTION_LABEL[k]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem("sqb-draft");
              void navigate({ to: "/admin/sqb/questions/$id", params: { id: "new" } });
            }}
            className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> New SQB question
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-6">
          <ListSkeleton rows={6} />
        </div>
      ) : (
        <div className="rise-in mt-6 overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 shadow-panel">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-brand-100">No SQB questions yet.</div>
          ) : (
            <ul className="divide-y divide-brand-400/30">
              {items.map((q) => (
                <li
                  key={q.id}
                  className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-brand-500"
                >
                  {q.image_url ? (
                    <img
                      src={q.image_url}
                      alt={q.image_alt ?? ""}
                      className="h-10 w-10 shrink-0 rounded-md border border-brand-400/50 object-cover"
                    />
                  ) : (
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-800">
                      <ImageIcon className="h-4 w-4 text-brand-200" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-sm font-semibold text-white">
                      {q.question_text || q.prompt}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="rounded bg-brand-400 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-white">
                        {q.external_id || q.id.slice(0, 8)}
                      </span>
                      <span className="rounded bg-brand-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        {SECTION_LABEL[q.section]}
                      </span>
                      <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                        {q.skill}
                        {q.subskill ? ` · ${q.subskill}` : ""}
                      </span>
                      <span
                        className={
                          "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
                          difficultyColor(q.difficulty)
                        }
                      >
                        {q.difficulty}
                      </span>
                      <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                        {q.kind === "grid_in" ? "Grid-in" : "MCQ"}
                      </span>
                      <span
                        className={
                          "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
                          (q.published ? "bg-emerald-600 text-white" : "bg-amber-700 text-white")
                        }
                      >
                        {q.published ? "Published" : "Draft"}
                      </span>
                      {formatSourceDate(q.source_month, q.source_year) && (
                        <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                          {formatSourceDate(q.source_month, q.source_year)}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void navigate({ to: "/admin/sqb/questions/$id", params: { id: q.id } })
                    }
                    className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-800 hover:text-white"
                    aria-label="Edit question"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void duplicate(q)}
                    className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-800 hover:text-white"
                    aria-label="Duplicate question"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(q.id)}
                    className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-900 hover:text-white"
                    aria-label="Delete question"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
