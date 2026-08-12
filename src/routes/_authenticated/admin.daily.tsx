import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, X, ChevronUp, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { ListSkeleton } from "@/components/ui/skeletons";
import {
  SECTION_LABEL,
  formatSourceDate,
  difficultyColor,
  type Section,
  type LetterDifficulty,
} from "@/lib/sat";

type DailyTest = { id: string; date: string; title: string | null };
type Test = {
  id: string;
  title: string;
  section: Section;
  module: 1 | 2;
  difficulty: LetterDifficulty;
  source_month: number | null;
  source_year: number | null;
};

export const Route = createFileRoute("/_authenticated/admin/daily")({
  component: AdminDaily,
});

function AdminDaily() {
  const [items, setItems] = useState<DailyTest[] | null>(null);
  const [editing, setEditing] = useState<{ dt: DailyTest; tests: string[] } | null>(null);
  const [pool, setPool] = useState<Test[]>([]);

  async function load() {
    const { data } = await supabase
      .from("daily_tests")
      .select("*")
      .order("date", { ascending: false });
    setItems((data ?? []) as DailyTest[]);
  }
  useEffect(() => {
    load();
  }, []);

  async function openEditor(dt?: DailyTest) {
    let target = dt;
    if (!target) {
      const date = prompt("Date (YYYY-MM-DD):", format(new Date(), "yyyy-MM-dd"));
      if (!date) return;
      const { data, error } = await supabase
        .from("daily_tests")
        .insert({ date, title: `Daily · ${date}` })
        .select("*")
        .single();
      if (error) return alert(error.message);
      target = data as DailyTest;
    }
    const [{ data: dtt }, { data: p }] = await Promise.all([
      supabase
        .from("daily_test_tests")
        .select("test_id, position")
        .eq("daily_test_id", target!.id)
        .order("position"),
      supabase.from("tests").select("*").order("module").order("created_at", { ascending: false }),
    ]);
    setPool((p ?? []) as Test[]);
    setEditing({
      dt: target!,
      tests: ((dtt ?? []) as { test_id: string; position: number }[])
        .sort((a, b) => a.position - b.position)
        .map((r) => r.test_id),
    });
    load();
  }

  async function save() {
    if (!editing) return;
    await supabase.from("daily_test_tests").delete().eq("daily_test_id", editing.dt.id);
    if (editing.tests.length > 0) {
      await supabase.from("daily_test_tests").insert(
        editing.tests.map((tid, i) => ({
          daily_test_id: editing.dt.id,
          test_id: tid,
          position: i + 1,
        })),
      );
    }
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this daily test?")) return;
    await supabase.from("daily_tests").delete().eq("id", id);
    load();
  }

  function toggle(tid: string) {
    if (!editing) return;
    setEditing({
      ...editing,
      tests: editing.tests.includes(tid)
        ? editing.tests.filter((x) => x !== tid)
        : [...editing.tests, tid],
    });
  }
  function move(tid: string, dir: -1 | 1) {
    if (!editing) return;
    const i = editing.tests.indexOf(tid);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= editing.tests.length) return;
    const next = editing.tests.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setEditing({ ...editing, tests: next });
  }

  return (
    <div>
      <div className="flex justify-end">
        <button
          onClick={() => openEditor()}
          className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> New daily test
        </button>
      </div>

      {items === null ? (
        <div className="mt-4">
          <ListSkeleton rows={4} />
        </div>
      ) : (
        <div className="rise-in mt-4 overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 shadow-panel">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-brand-100">No daily tests scheduled.</div>
          ) : (
            <ul className="divide-y divide-brand-400/30">
              {items.map((d) => (
                <li key={d.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white">
                      {d.title || `Daily · ${d.date}`}
                    </div>
                    <div className="text-xs text-brand-100">{d.date}</div>
                  </div>
                  <button
                    onClick={() => openEditor(d)}
                    className="tap rounded-lg bg-brand-800 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-brand-400/40 hover:bg-brand-400"
                  >
                    Manage tests
                  </button>
                  <button
                    onClick={() => remove(d.id)}
                    className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-800 hover:text-white"
                    aria-label="Delete daily test"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Modal. The scrim is the deepest brand step so the dialog above it still
          reads as a #0B0761 surface rather than a white sheet. */}
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-brand-900/60 p-4 backdrop-blur-sm">
          <div className="pop-in flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-brand-400/40 bg-brand-600 shadow-float">
            <div className="flex items-center justify-between border-b border-brand-400/30 px-6 py-4">
              <h3 className="text-lg font-bold text-white">
                {editing.dt.title || `Daily · ${editing.dt.date}`}
                <span className="ml-2 text-xs font-normal text-brand-100">
                  {editing.tests.length} test{editing.tests.length === 1 ? "" : "s"} selected
                </span>
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-800 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              {editing.tests.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-100">
                    Selected order
                  </div>
                  <ol className="overflow-hidden rounded-lg border border-brand-400/40">
                    {editing.tests.map((tid, idx) => {
                      const t = pool.find((x) => x.id === tid);
                      return (
                        <li
                          key={tid}
                          className="flex items-center gap-2 border-b border-brand-400/30 bg-brand-800 px-3 py-2 text-sm text-white last:border-b-0"
                        >
                          <span className="w-6 text-xs font-bold tabular-nums text-brand-200">
                            {idx + 1}.
                          </span>
                          <span className="flex-1 truncate font-semibold">
                            {t?.title ?? "(missing)"}
                          </span>
                          {t && (
                            <span className="rounded bg-brand-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                              M{t.module}
                            </span>
                          )}
                          <button
                            onClick={() => move(tid, -1)}
                            className="grid h-6 w-6 place-items-center rounded text-brand-100 hover:bg-brand-700 hover:text-white"
                            aria-label="Move up"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => move(tid, 1)}
                            className="grid h-6 w-6 place-items-center rounded text-brand-100 hover:bg-brand-700 hover:text-white"
                            aria-label="Move down"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => toggle(tid)}
                            className="grid h-6 w-6 place-items-center rounded text-brand-100 hover:bg-brand-900 hover:text-white"
                            aria-label="Remove from selection"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              <div>
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-100">
                  Available tests
                </div>
                <ul className="divide-y divide-brand-400/30 rounded-lg border border-brand-400/40">
                  {pool
                    .filter((t) => !editing.tests.includes(t.id))
                    .map((t) => (
                      <li key={t.id} className="flex items-center gap-3 px-3 py-2">
                        <button
                          onClick={() => toggle(t.id)}
                          className="tap grid h-7 w-7 place-items-center rounded-md bg-brand-800 text-white ring-1 ring-brand-400/40 hover:bg-brand-400"
                          aria-label="Add test"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-white">{t.title}</div>
                          <div className="mt-0.5 flex flex-wrap gap-1.5">
                            <span className="rounded bg-brand-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                              {SECTION_LABEL[t.section]} · M{t.module}
                            </span>
                            <span
                              className={
                                "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
                                difficultyColor(t.difficulty)
                              }
                            >
                              {t.difficulty}
                            </span>
                            {formatSourceDate(t.source_month, t.source_year) && (
                              <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                                {formatSourceDate(t.source_month, t.source_year)}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  {pool.length === 0 && (
                    <li className="p-6 text-center text-sm text-brand-100">
                      No tests yet. Create tests first from the Tests page.
                    </li>
                  )}
                </ul>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-brand-400/30 px-6 py-4">
              <button
                onClick={() => setEditing(null)}
                className="tap rounded-lg px-4 py-2 text-sm font-semibold text-brand-100 hover:bg-brand-800 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="btn-brand rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white"
              >
                Save selection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
