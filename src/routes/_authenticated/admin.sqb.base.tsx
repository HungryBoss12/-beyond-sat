import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Edit3, Eye, Trash2, ListPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchTestQuestionCounts } from "@/lib/test-question-counts";
import { ListSkeleton } from "@/components/ui/skeletons";
import { RevealCard } from "@/components/ui/reveal-card";
import { SqbTestDeleteDialog } from "@/components/admin/SqbTestDeleteDialog";
import {
  SECTION_LABEL,
  formatSourceDate,
  type Section,
} from "@/lib/sat";

export const Route = createFileRoute("/_authenticated/admin/sqb/base")({
  component: AdminSqbTestBase,
  head: () => ({ meta: [{ title: "SQB Test Base — BeyondSAT Admin" }] }),
});

type SqbTest = {
  id: string;
  title: string;
  section: Section;
  difficulty: string;
  source_month: number | null;
  source_year: number | null;
};

function AdminSqbTestBase() {
  const navigate = useNavigate();
  const [tests, setTests] = useState<SqbTest[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<SqbTest | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data }, tally] = await Promise.all([
      supabase
        .from("tests")
        .select("id,title,section,difficulty,source_month,source_year")
        .eq("bank_format", "sqb")
        .eq("in_test_base", true)
        .order("created_at", { ascending: false }),
      fetchTestQuestionCounts(),
    ]);
    setTests((data ?? []) as SqbTest[]);
    setCounts(tally);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addToTests(id: string) {
    setBusyId(id);
    const { error } = await supabase.rpc("staff_publish_sqb_test", {
      p_test_id: id,
      p_publish: true,
    });
    setBusyId(null);
    if (error) {
      alert(error.message);
      return;
    }
    void load();
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-black tracking-tight text-brand-900">Test Base</h1>
        <p className="mt-1 text-sm text-slate-500">
          New SQB packs land here first. Add one to the Tests list when it is ready to review and
          publish. Students do not see packs while they stay in the base.
        </p>
      </div>

      {loading ? (
        <div className="mt-6">
          <ListSkeleton rows={5} />
        </div>
      ) : tests.length === 0 ? (
        <RevealCard className="mt-6 p-8 text-center">
          <p className="text-sm text-slate-600">No packs in Test Base.</p>
        </RevealCard>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 shadow-panel">
          <ul className="divide-y divide-brand-400/30">
            {tests.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 text-white hover:bg-brand-500"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{t.title}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                      {SECTION_LABEL[t.section]}
                    </span>
                    <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                      {(counts.get(t.id) ?? 0) === 0
                        ? "No questions yet"
                        : `${counts.get(t.id)} questions`}
                    </span>
                    {formatSourceDate(t.source_month, t.source_year) && (
                      <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                        {formatSourceDate(t.source_month, t.source_year)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busyId === t.id}
                  onClick={() => void addToTests(t.id)}
                  className="tap inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  <ListPlus className="h-3.5 w-3.5" />
                  Add to Tests
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void navigate({ to: "/admin/sqb/import", search: { testId: t.id } })
                  }
                  className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-800 hover:text-white"
                  aria-label="Edit"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void navigate({
                      to: "/admin/sqb/review/$testId",
                      params: { testId: t.id },
                    })
                  }
                  className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-800 hover:text-white"
                  aria-label="Review"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(t)}
                  className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-900 hover:text-white"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pendingDelete && (
        <SqbTestDeleteDialog
          testId={pendingDelete.id}
          title={pendingDelete.title}
          mode="base"
          onClose={() => setPendingDelete(null)}
          onDone={() => {
            setPendingDelete(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
