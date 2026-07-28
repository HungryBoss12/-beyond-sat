import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  Trash2,
  Edit3,
  X,
  ChevronUp,
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import {
  SECTION_LABEL,
  LETTER_DIFFICULTIES,
  MONTHS,
  formatSourceDate,
  difficultyColor,
  type Section,
  type LetterDifficulty,
} from "@/lib/sat";

type Test = {
  id: string;
  title: string;
  section: Section;
  module: 1 | 2;
  difficulty: LetterDifficulty;
  source_month: number | null;
  source_year: number | null;
};

type QRow = {
  id: string;
  question_text: string;
  section: Section;
  difficulty: string;
  skill: string;
};

export const Route = createFileRoute("/_authenticated/admin/tests")({
  component: AdminTests,
});

const empty = (): Test => ({
  id: "",
  title: "",
  section: "math",
  module: 1,
  difficulty: "C",
  source_month: null,
  source_year: new Date().getFullYear(),
});

function AdminTests() {
  const [items, setItems] = useState<Test[]>([]);
  const [editing, setEditing] = useState<Test | null>(null);
  const [editingQs, setEditingQs] = useState<string[] | null>(null);
  const [pool, setPool] = useState<QRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("tests")
      .select("*")
      .order("module")
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Test[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function openEditor(t?: Test) {
    const target = t ?? empty();
    setEditing(target);
    if (target.id) {
      const [{ data: tq }, { data: p }] = await Promise.all([
        supabase
          .from("test_questions")
          .select("question_id, position")
          .eq("test_id", target.id)
          .order("position"),
        supabase
          .from("questions")
          .select("id,question_text,section,difficulty,skill")
          .eq("section", target.section)
          .order("created_at", { ascending: false })
          .limit(400),
      ]);
      setPool((p ?? []) as QRow[]);
      setEditingQs((tq ?? []).map((r: any) => r.question_id as string));
    } else {
      const { data: p } = await supabase
        .from("questions")
        .select("id,question_text,section,difficulty,skill")
        .eq("section", target.section)
        .order("created_at", { ascending: false })
        .limit(400);
      setPool((p ?? []) as QRow[]);
      setEditingQs([]);
    }
  }

  async function reloadPool(section: Section) {
    const { data: p } = await supabase
      .from("questions")
      .select("id,question_text,section,difficulty,skill")
      .eq("section", section)
      .order("created_at", { ascending: false })
      .limit(400);
    setPool((p ?? []) as QRow[]);
  }

  async function save() {
    if (!editing || !editingQs) return;
    if (!editing.title.trim()) {
      alert("Please enter a test title.");
      return;
    }
    if (editingQs.length < 1) {
      alert("A test must contain at least 1 question.");
      return;
    }
    const payload = {
      title: editing.title.trim(),
      section: editing.section,
      module: editing.module,
      difficulty: editing.difficulty,
      source_month: editing.source_month,
      source_year: editing.source_year,
    };
    let testId = editing.id;
    if (testId) {
      const { error } = await supabase.from("tests").update(payload).eq("id", testId);
      if (error) return alert(error.message);
    } else {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("tests")
        .insert({ ...payload, created_by: u.user?.id })
        .select("id")
        .single();
      if (error) return alert(error.message);
      testId = data.id as string;
    }
    await supabase.from("test_questions").delete().eq("test_id", testId);
    if (editingQs.length > 0) {
      await supabase.from("test_questions").insert(
        editingQs.map((qid, i) => ({ test_id: testId, question_id: qid, position: i + 1 })),
      );
    }
    setEditing(null);
    setEditingQs(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this test?")) return;
    await supabase.from("tests").delete().eq("id", id);
    load();
  }

  function toggleQ(qid: string) {
    if (!editingQs) return;
    setEditingQs(
      editingQs.includes(qid) ? editingQs.filter((x) => x !== qid) : [...editingQs, qid],
    );
  }
  function moveQ(qid: string, dir: -1 | 1) {
    if (!editingQs) return;
    const i = editingQs.indexOf(qid);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= editingQs.length) return;
    const next = editingQs.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setEditingQs(next);
  }

  const grouped = { 1: items.filter((t) => t.module === 1), 2: items.filter((t) => t.module === 2) };

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Group questions into tests. Add as many questions as you need. Tests are used by daily tests and mock exams.
        </p>
        <button
          onClick={() => openEditor()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New test
        </button>
      </div>

      {loading ? (
        <div className="mt-6 rounded-2xl border border-border bg-white p-10 text-center text-sm text-slate-500">
          Loading…
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {[1, 2].map((m) => (
            <div key={m}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Module {m}
              </h2>
              <div className="rounded-2xl border border-border bg-white overflow-hidden">
                {grouped[m as 1 | 2].length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">No tests in module {m}.</div>
                ) : (
                  <ul className="divide-y divide-border">
                    {grouped[m as 1 | 2].map((t) => (
                      <li key={t.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-800 truncate">{t.title}</div>
                          <div className="mt-1 flex gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              {SECTION_LABEL[t.section]}
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
                        <button
                          onClick={() => openEditor(t)}
                          className="rounded-lg h-8 w-8 grid place-items-center text-slate-500 hover:bg-slate-100"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => remove(t.id)}
                          className="rounded-lg h-8 w-8 grid place-items-center text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && editingQs && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 grid place-items-center p-4 overflow-y-auto">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl my-8 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-bold text-slate-800">
                {editing.id ? "Edit test" : "New test"}
              </h3>
              <button
                onClick={() => {
                  setEditing(null);
                  setEditingQs(null);
                }}
                className="rounded-lg h-8 w-8 grid place-items-center text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <Field label="Title">
                <input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="Test 1"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </Field>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="Section">
                  <select
                    value={editing.section}
                    onChange={(e) => {
                      const s = e.target.value as Section;
                      setEditing({ ...editing, section: s });
                      setEditingQs([]);
                      reloadPool(s);
                    }}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <option value="math">Math</option>
                    <option value="reading_writing">Reading & Writing</option>
                  </select>
                </Field>
                <Field label="Module">
                  <select
                    value={editing.module}
                    onChange={(e) => setEditing({ ...editing, module: Number(e.target.value) as 1 | 2 })}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <option value={1}>Module 1</option>
                    <option value={2}>Module 2</option>
                  </select>
                </Field>
                <Field label="Difficulty">
                  <select
                    value={editing.difficulty}
                    onChange={(e) =>
                      setEditing({ ...editing, difficulty: e.target.value as LetterDifficulty })
                    }
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    {LETTER_DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Source date">
                  <div className="flex gap-1">
                    <select
                      value={editing.source_month ?? ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          source_month: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="flex-1 rounded-lg border border-border px-2 py-2 text-sm"
                    >
                      <option value="">Month</option>
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={2000}
                      max={2099}
                      value={editing.source_year ?? ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          source_year: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="Year"
                      className="w-20 rounded-lg border border-border px-2 py-2 text-sm"
                    />
                  </div>
                </Field>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Questions in this test ({editingQs.length})
                  </span>
                  {editingQs.length < 1 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                      <AlertCircle className="h-3.5 w-3.5" /> Add at least 1 question
                    </span>
                  )}
                </div>
                {editingQs.length > 0 && (
                  <ol className="mb-4 rounded-lg border border-border overflow-hidden">
                    {editingQs.map((qid, idx) => {
                      const q = pool.find((x) => x.id === qid);
                      return (
                        <li
                          key={qid}
                          className="flex items-center gap-2 px-3 py-2 text-sm border-b last:border-b-0 border-border bg-slate-50"
                        >
                          <span className="tabular-nums text-xs font-bold text-slate-400 w-6">
                            {idx + 1}.
                          </span>
                          <span className="flex-1 truncate">
                            {q?.question_text ?? "(question not in pool)"}
                          </span>
                          <button
                            onClick={() => moveQ(qid, -1)}
                            className="rounded h-6 w-6 grid place-items-center text-slate-500 hover:bg-slate-200"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => moveQ(qid, 1)}
                            className="rounded h-6 w-6 grid place-items-center text-slate-500 hover:bg-slate-200"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => toggleQ(qid)}
                            className="rounded h-6 w-6 grid place-items-center text-red-500 hover:bg-red-50"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
                <div className="rounded-lg border border-border max-h-72 overflow-y-auto">
                  <ul className="divide-y divide-border">
                    {pool
                      .filter((q) => !editingQs.includes(q.id))
                      .map((q) => (
                        <li key={q.id} className="flex items-start gap-3 px-3 py-2">
                          <button
                            onClick={() => toggleQ(q.id)}
                            className="mt-0.5 rounded-md border border-border h-6 w-6 grid place-items-center text-primary hover:bg-primary hover:text-white"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          <div className="flex-1 min-w-0 text-sm">
                            <div className="font-medium text-slate-800 line-clamp-2">
                              {q.question_text}
                            </div>
                            <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                              {q.skill} · {q.difficulty}
                            </div>
                          </div>
                        </li>
                      ))}
                    {pool.length === 0 && (
                      <li className="px-3 py-6 text-center text-sm text-slate-500">
                        No questions available for this section.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditing(null);
                  setEditingQs(null);
                }}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
              >
                Save test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
