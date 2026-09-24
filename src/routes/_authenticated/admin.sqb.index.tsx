import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Plus, Edit3, Eye, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ListSkeleton } from "@/components/ui/skeletons";
import { RevealCard } from "@/components/ui/reveal-card";
import {
  SECTION_LABEL,
  difficultyColor,
  formatSourceDate,
  type Section,
} from "@/lib/sat";

export const Route = createFileRoute("/_authenticated/admin/sqb/")({
  component: AdminSqbHub,
  head: () => ({ meta: [{ title: "SQB Tests — BeyondSAT Admin" }] }),
});

type SqbTest = {
  id: string;
  title: string;
  section: Section;
  module: number;
  difficulty: string;
  published: boolean;
  source_month: number | null;
  source_year: number | null;
};

function AdminSqbHub() {
  const navigate = useNavigate();
  const [tests, setTests] = useState<SqbTest[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section | "all">("all");
  const [publishedOnly, setPublishedOnly] = useState<"all" | "yes" | "no">("all");

  const load = useCallback(async () => {
    setLoading(true);
    let tq = supabase
      .from("tests")
      .select("id,title,section,module,difficulty,published,source_month,source_year")
      .eq("bank_format", "sqb")
      .order("created_at", { ascending: false });
    if (section !== "all") tq = tq.eq("section", section);
    if (publishedOnly === "yes") tq = tq.eq("published", true);
    if (publishedOnly === "no") tq = tq.eq("published", false);

    const [{ data }, { data: links }] = await Promise.all([
      tq,
      supabase.from("test_questions").select("test_id"),
    ]);
    setTests((data ?? []) as SqbTest[]);
    const tally = new Map<string, number>();
    for (const l of (links ?? []) as { test_id: string }[]) {
      tally.set(l.test_id, (tally.get(l.test_id) ?? 0) + 1);
    }
    setCounts(tally);
    setLoading(false);
  }, [section, publishedOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    if (!confirm("Delete this SQB test?")) return;
    await supabase.from("tests").delete().eq("id", id);
    void load();
  }

  function newQuestion() {
    sessionStorage.removeItem("sqb-draft");
    void navigate({
      to: "/admin/sqb/questions/$id",
      params: { id: "new" },
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-brand-900">SQB Tests</h1>
          <p className="mt-1 text-sm text-slate-500">
            Question Bank–format practice sets. Students take them in the ordinary practice player.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          to="/admin/sqb/import"
          className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> New SQB test
        </Link>
        <button
          type="button"
          onClick={newQuestion}
          className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-400/50 bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
        >
          <Plus className="h-4 w-4" /> New SQB question
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", "reading_writing", "math"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setSection(k)}
            className={
              "tap rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider " +
              (section === k
                ? "bg-brand-400 text-white"
                : "bg-brand-600 text-brand-100 hover:bg-brand-500")
            }
          >
            {k === "all" ? "All" : SECTION_LABEL[k]}
          </button>
        ))}
        {(["all", "yes", "no"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setPublishedOnly(k)}
            className={
              "tap rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider " +
              (publishedOnly === k
                ? "bg-brand-400 text-white"
                : "bg-slate-200 text-slate-600 hover:bg-slate-300")
            }
          >
            {k === "all" ? "Any status" : k === "yes" ? "Published" : "Draft"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-6">
          <ListSkeleton rows={5} />
        </div>
      ) : tests.length === 0 ? (
        <RevealCard className="mt-6 p-8 text-center">
          <p className="text-sm text-slate-600">No SQB tests yet.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link
              to="/admin/sqb/import"
              className="btn-brand rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white"
            >
              New SQB test
            </Link>
            <button
              type="button"
              onClick={newQuestion}
              className="tap rounded-lg border border-brand-400/50 bg-white px-4 py-2 text-sm font-semibold text-brand-700"
            >
              Add SQB questions first
            </button>
          </div>
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
                    <span className="rounded bg-brand-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      SQB
                    </span>
                    <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                      {SECTION_LABEL[t.section]}
                    </span>
                    <span
                      className={
                        "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
                        difficultyColor(t.difficulty)
                      }
                    >
                      {t.difficulty}
                    </span>
                    <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                      {counts.get(t.id) ?? 0} Q
                    </span>
                    {formatSourceDate(t.source_month, t.source_year) && (
                      <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                        {formatSourceDate(t.source_month, t.source_year)}
                      </span>
                    )}
                    <span
                      className={
                        "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
                        (t.published ? "bg-emerald-600 text-white" : "bg-amber-700 text-white")
                      }
                    >
                      {t.published ? "Published" : "Draft"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void navigate({
                      to: "/admin/tests",
                      search: { edit: t.id, bank: "sqb" } as never,
                    })
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
                  onClick={() => void remove(t.id)}
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
    </div>
  );
}
