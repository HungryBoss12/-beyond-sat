import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, X, ChevronUp, ChevronDown } from "lucide-react";
import { format } from "date-fns";
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
  const [items, setItems] = useState<DailyTest[]>([]);
  const [editing, setEditing] = useState<{ dt: DailyTest; tests: string[] } | null>(null);
  const [pool, setPool] = useState<Test[]>([]);

  async function load() {
    const { data } = await supabase.from("daily_tests").select("*").order("date", { ascending: false });
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
      supabase
        .from("tests")
        .select("*")
        .order("module")
        .order("created_at", { ascending: false }),
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
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New daily test
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-white overflow-hidden">
        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No daily tests scheduled.</div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((d) => (
              <li key={d.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-800">
                    {d.title || `Daily · ${d.date}`}
                  </div>
                  <div className="text-xs text-slate-500">{d.date}</div>
                </div>
                <button
                  onClick={() => openEditor(d)}
                  className="rounded-lg bg-white border border-border px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-primary/40"
                >
                  Manage tests
                </button>
                <button
                  onClick={() => remove(d.id)}
                  className="rounded-lg h-8 w-8 grid place-items-center text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 grid place-items-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-bold text-slate-800">
                {editing.dt.title || `Daily · ${editing.dt.date}`}
                <span className="ml-2 text-xs font-normal text-slate-500">
                  {editing.tests.length} test{editing.tests.length === 1 ? "" : "s"} selected
                </span>
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg h-8 w-8 grid place-items-center text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {editing.tests.length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Selected order
                  </div>
                  <ol className="rounded-lg border border-border overflow-hidden">
                    {editing.tests.map((tid, idx) => {
                      const t = pool.find((x) => x.id === tid);
                      return (
                        <li
                          key={tid}
                          className="flex items-center gap-2 px-3 py-2 text-sm border-b last:border-b-0 border-border bg-slate-50"
                        >
                          <span className="tabular-nums text-xs font-bold text-slate-400 w-6">
                            {idx + 1}.
                          </span>
                          <span className="flex-1 truncate font-semibold">
                            {t?.title ?? "(missing)"}
                          </span>
                          {t && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              M{t.module}
                            </span>
                          )}
                          <button
                            onClick={() => move(tid, -1)}
                            className="rounded h-6 w-6 grid place-items-center text-slate-500 hover:bg-slate-200"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => move(tid, 1)}
                            className="rounded h-6 w-6 grid place-items-center text-slate-500 hover:bg-slate-200"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => toggle(tid)}
                            className="rounded h-6 w-6 grid place-items-center text-red-500 hover:bg-red-50"
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
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Available tests
                </div>
                <ul className="rounded-lg border border-border divide-y divide-border">
                  {pool
                    .filter((t) => !editing.tests.includes(t.id))
                    .map((t) => (
                      <li key={t.id} className="flex items-center gap-3 px-3 py-2">
                        <button
                          onClick={() => toggle(t.id)}
                          className="rounded-md border border-border h-7 w-7 grid place-items-center text-primary hover:bg-primary hover:text-white"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-800 truncate">
                            {t.title}
                          </div>
                          <div className="mt-0.5 flex gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              {SECTION_LABEL[t.section]} · M{t.module}
                            </span>
                            <span
                              className={
                                "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded " +
                                difficultyColor(t.difficulty)
                              }
                            >
                              {t.difficulty}
                            </span>
                            {formatSourceDate(t.source_month, t.source_year) && (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                {formatSourceDate(t.source_month, t.source_year)}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  {pool.length === 0 && (
                    <li className="p-6 text-center text-sm text-slate-500">
                      No tests yet. Create tests first from the Tests page.
                    </li>
                  )}
                </ul>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
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
