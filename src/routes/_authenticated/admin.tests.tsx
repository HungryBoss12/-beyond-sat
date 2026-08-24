import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  Trash2,
  Edit3,
  X,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Link2,
} from "lucide-react";
import { ListSkeleton } from "@/components/ui/skeletons";
import {
  QuestionEditModal,
  loadQuestionWithAnswers,
} from "@/components/admin/question-edit-modal";
import type { AdminChoice, AdminQuestion } from "@/lib/admin/question";
import {
  SECTION_LABEL,
  LETTER_DIFFICULTIES,
  MONTHS,
  formatSourceDate,
  difficultyColor,
  stripModuleSuffix,
  paperKey,
  moduleTitle,
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

type PaperGroup = {
  key: string;
  base: string;
  section: Section;
  mod1: Test[];
  mod2: Test[];
  source_month: number | null;
  source_year: number | null;
};

export const Route = createFileRoute("/_authenticated/admin/tests")({
  component: AdminTests,
});

/** Shared control styling for the editor's inputs and selects. `color-scheme`
    keeps the native select dropdown light-on-dark instead of white-on-white. */
const CONTROL_CLASS =
  "w-full rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2 text-sm text-white [color-scheme:dark] placeholder:text-brand-200 focus:border-brand-200 focus:outline-none";

const empty = (): Test => ({
  id: "",
  title: "",
  section: "math",
  module: 1,
  difficulty: "C",
  source_month: null,
  source_year: new Date().getFullYear(),
});

function sortGroups(a: PaperGroup, b: PaperGroup): number {
  const ay = a.source_year ?? 0;
  const by = b.source_year ?? 0;
  if (ay !== by) return by - ay;
  const am = a.source_month ?? 0;
  const bm = b.source_month ?? 0;
  return bm - am;
}

function groupTests(items: Test[]): { papers: PaperGroup[]; singles: PaperGroup[] } {
  const map = new Map<string, PaperGroup>();

  for (const t of items) {
    const key = paperKey(t.title, t.section);
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        base: stripModuleSuffix(t.title),
        section: t.section,
        mod1: [],
        mod2: [],
        source_month: t.source_month,
        source_year: t.source_year,
      };
      map.set(key, g);
    }
    if (t.module === 1) g.mod1.push(t);
    else g.mod2.push(t);
  }

  const papers: PaperGroup[] = [];
  const singles: PaperGroup[] = [];

  for (const g of map.values()) {
    if (g.mod1.length > 0 && g.mod2.length > 0) papers.push(g);
    else singles.push(g);
  }

  papers.sort(sortGroups);
  singles.sort(sortGroups);
  return { papers, singles };
}

function AdminTests() {
  const [items, setItems] = useState<Test[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [editing, setEditing] = useState<Test | null>(null);
  const [editingQs, setEditingQs] = useState<string[] | null>(null);
  const [pool, setPool] = useState<QRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pairing, setPairing] = useState<Test | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<AdminQuestion | null>(null);
  const [openingQuestion, setOpeningQuestion] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data }, { data: links }] = await Promise.all([
      supabase
        .from("tests")
        .select("*")
        .order("module")
        .order("created_at", { ascending: false }),
      supabase.from("test_questions").select("test_id"),
    ]);
    setItems((data ?? []) as Test[]);
    const tally = new Map<string, number>();
    for (const l of (links ?? []) as { test_id: string }[]) {
      tally.set(l.test_id, (tally.get(l.test_id) ?? 0) + 1);
    }
    setCounts(tally);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const { papers, singles } = useMemo(() => groupTests(items), [items]);

  const pairCandidates = useMemo(() => {
    if (!pairing) return [];
    const want = pairing.module === 1 ? 2 : 1;
    return singles
      .flatMap((g) => (want === 1 ? g.mod1 : g.mod2))
      .filter((t) => t.section === pairing.section && t.id !== pairing.id);
  }, [pairing, singles]);

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
      setEditingQs((tq ?? []).map((r) => r.question_id as string));
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

  function openAddMissing(t: Test) {
    const missing = t.module === 1 ? 2 : 1;
    const base = stripModuleSuffix(t.title);
    void openEditor({
      ...empty(),
      title: moduleTitle(base, missing),
      section: t.section,
      module: missing,
      difficulty: t.difficulty,
      source_month: t.source_month,
      source_year: t.source_year,
    });
  }

  async function pairTests(source: Test, partner: Test) {
    const mod1 = source.module === 1 ? source : partner;
    const mod2 = source.module === 2 ? source : partner;
    const base = stripModuleSuffix(mod1.title);
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("tests").update({ title: moduleTitle(base, 1) }).eq("id", mod1.id),
      supabase.from("tests").update({ title: moduleTitle(base, 2) }).eq("id", mod2.id),
    ]);
    if (e1 || e2) {
      alert(e1?.message ?? e2?.message ?? "Could not pair tests.");
      return;
    }
    setPairing(null);
    load();
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

  async function openQuestionEditor(qid: string) {
    if (openingQuestion) return;
    setOpeningQuestion(true);
    try {
      const { data, error } = await supabase
        .from("questions")
        .select(
          "id,section,skill,difficulty,kind,prompt,question_text,choices,image_url,source_month,source_year,time_limit_seconds",
        )
        .eq("id", qid)
        .single();
      if (error || !data) {
        alert(error?.message ?? "Could not load that question.");
        return;
      }
      const full = await loadQuestionWithAnswers({
        ...data,
        choices: (data.choices ?? []) as AdminChoice[],
        time_limit_seconds: data.time_limit_seconds ?? null,
      });
      setEditingQuestion(full);
    } finally {
      setOpeningQuestion(false);
    }
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
      await supabase
        .from("test_questions")
        .insert(
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

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          Group questions into tests. Papers with both modules appear as one card. Tests are used by
          daily tests and mock exams.
        </p>
        <button
          onClick={() => openEditor()}
          className="btn-brand inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> New test
        </button>
      </div>

      {loading ? (
        <div className="mt-6">
          <ListSkeleton rows={6} />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-brand-400/40 bg-brand-600 p-8 text-center text-sm text-brand-100 shadow-panel">
          No tests yet. Import a paper or create one manually.
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {papers.length > 0 && (
            <div>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                Papers (both modules)
              </h2>
              <div className="space-y-4">
                {papers.map((g) => (
                  <PaperCard key={g.key} group={g} counts={counts} onEdit={openEditor} onRemove={remove} />
                ))}
              </div>
            </div>
          )}

          {singles.length > 0 && (
            <div>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                Single modules
              </h2>
              <div className="space-y-4">
                {singles.map((g) => (
                  <PaperCard
                    key={g.key}
                    group={g}
                    counts={counts}
                    onEdit={openEditor}
                    onRemove={remove}
                    onPair={(t) => setPairing(t)}
                    onAddMissing={openAddMissing}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {pairing && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-brand-900/60 p-4 backdrop-blur-sm">
          <div className="pop-in my-8 w-full max-w-md rounded-2xl border border-brand-400/40 bg-brand-600 shadow-float">
            <div className="flex items-center justify-between border-b border-brand-400/30 px-5 py-4">
              <h3 className="text-base font-bold text-white">
                Pair with Module {pairing.module === 1 ? 2 : 1}
              </h3>
              <button
                onClick={() => setPairing(null)}
                className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-800 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <p className="mb-3 text-sm text-brand-100">
                Choose a {SECTION_LABEL[pairing.section]} test to pair with{" "}
                <strong className="text-white">{pairing.title}</strong>. Both will be renamed to
                share the same paper title.
              </p>
              {pairCandidates.length === 0 ? (
                <p className="text-sm text-brand-200">
                  No unpaired Module {pairing.module === 1 ? 2 : 1} tests in this section. Use Add
                  Module instead.
                </p>
              ) : (
                <ul className="max-h-64 divide-y divide-brand-400/30 overflow-y-auto rounded-lg border border-brand-400/40">
                  {pairCandidates.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => void pairTests(pairing, c)}
                        className="tap flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm text-white hover:bg-brand-500"
                      >
                        <span className="truncate font-medium">{c.title}</span>
                        <span className="shrink-0 text-xs text-brand-200">
                          {counts.get(c.id) ?? 0} q
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {editing && editingQs && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-brand-900/60 p-4 backdrop-blur-sm">
          <div className="pop-in my-8 flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-brand-400/40 bg-brand-600 shadow-float">
            <div className="flex items-center justify-between border-b border-brand-400/30 px-6 py-4">
              <h3 className="text-lg font-bold text-white">
                {editing.id ? "Edit test" : "New test"}
              </h3>
              <button
                onClick={() => {
                  setEditing(null);
                  setEditingQs(null);
                }}
                className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-800 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto p-6">
              <Field label="Title">
                <input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="Test 1"
                  className={CONTROL_CLASS}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Field label="Section">
                  <select
                    value={editing.section}
                    onChange={(e) => {
                      const s = e.target.value as Section;
                      setEditing({ ...editing, section: s });
                      setEditingQs([]);
                      reloadPool(s);
                    }}
                    className={CONTROL_CLASS}
                  >
                    <option value="math">Math</option>
                    <option value="reading_writing">Reading &amp; Writing</option>
                  </select>
                </Field>
                <Field label="Module">
                  <select
                    value={editing.module}
                    onChange={(e) =>
                      setEditing({ ...editing, module: Number(e.target.value) as 1 | 2 })
                    }
                    className={CONTROL_CLASS}
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
                    className={CONTROL_CLASS}
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
                      className={CONTROL_CLASS + " flex-1 px-2"}
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
                      className={CONTROL_CLASS + " w-20 px-2"}
                    />
                  </div>
                </Field>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-brand-100">
                    Questions in this test ({editingQs.length})
                  </span>
                  {editingQs.length < 1 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-900 px-2 py-0.5 text-[11px] font-semibold text-white ring-1 ring-brand-300/60">
                      <AlertCircle className="h-3.5 w-3.5" /> Add at least 1 question
                    </span>
                  )}
                </div>
                {editingQs.length > 0 && (
                  <ol className="mb-4 overflow-hidden rounded-lg border border-brand-400/40">
                    {editingQs.map((qid, idx) => {
                      const q = pool.find((x) => x.id === qid);
                      return (
                        <li
                          key={qid}
                          className="flex items-center gap-2 border-b border-brand-400/30 bg-brand-800 px-3 py-2 text-sm text-white last:border-b-0"
                        >
                          <span className="w-6 text-xs font-bold tabular-nums text-brand-200">
                            {idx + 1}.
                          </span>
                          <span className="flex-1 truncate">
                            {q?.question_text ?? "(question not in pool)"}
                          </span>
                          <button
                            type="button"
                            onClick={() => void openQuestionEditor(qid)}
                            disabled={openingQuestion}
                            className="grid h-6 w-6 place-items-center rounded text-brand-100 hover:bg-brand-700 hover:text-white disabled:opacity-40"
                            aria-label="Edit question"
                            title="Edit question text with AI"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => moveQ(qid, -1)}
                            className="grid h-6 w-6 place-items-center rounded text-brand-100 hover:bg-brand-700 hover:text-white"
                            aria-label="Move up"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => moveQ(qid, 1)}
                            className="grid h-6 w-6 place-items-center rounded text-brand-100 hover:bg-brand-700 hover:text-white"
                            aria-label="Move down"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => toggleQ(qid)}
                            className="grid h-6 w-6 place-items-center rounded text-brand-100 hover:bg-brand-900 hover:text-white"
                            aria-label="Remove question"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
                <div className="max-h-72 overflow-y-auto rounded-lg border border-brand-400/40">
                  <ul className="divide-y divide-brand-400/30">
                    {pool
                      .filter((q) => !editingQs.includes(q.id))
                      .map((q) => (
                        <li key={q.id} className="flex items-start gap-3 px-3 py-2">
                          <button
                            onClick={() => toggleQ(q.id)}
                            className="tap mt-0.5 grid h-6 w-6 place-items-center rounded-md bg-brand-800 text-white ring-1 ring-brand-400/40 hover:bg-brand-400"
                            aria-label="Add question"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          <div className="min-w-0 flex-1 text-sm">
                            <div className="line-clamp-2 font-medium text-white">
                              {q.question_text}
                            </div>
                            <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-brand-100">
                              {q.skill} · {q.difficulty}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void openQuestionEditor(q.id)}
                            disabled={openingQuestion}
                            className="tap mt-0.5 grid h-6 w-6 place-items-center rounded text-brand-100 hover:bg-brand-700 hover:text-white disabled:opacity-40"
                            aria-label="Edit question"
                            title="Edit question text with AI"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    {pool.length === 0 && (
                      <li className="px-3 py-6 text-center text-sm text-brand-100">
                        No questions available for this section.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-brand-400/30 px-6 py-4">
              <button
                onClick={() => {
                  setEditing(null);
                  setEditingQs(null);
                }}
                className="tap rounded-lg px-4 py-2 text-sm font-semibold text-brand-100 hover:bg-brand-800 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="btn-brand rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white"
              >
                Save test
              </button>
            </div>
          </div>
        </div>
      )}

      {editingQuestion && (
        <QuestionEditModal
          initial={editingQuestion}
          onClose={() => setEditingQuestion(null)}
          onSaved={(saved) => {
            setEditingQuestion(null);
            setPool((current) =>
              current.map((row) =>
                row.id === saved.id
                  ? {
                      ...row,
                      question_text: saved.question_text,
                      section: saved.section,
                      difficulty: saved.difficulty,
                      skill: saved.skill,
                    }
                  : row,
              ),
            );
            if (editing) void reloadPool(editing.section);
          }}
        />
      )}
    </div>
  );
}

function PaperCard({
  group,
  counts,
  onEdit,
  onRemove,
  onPair,
  onAddMissing,
}: {
  group: PaperGroup;
  counts: Map<string, number>;
  onEdit: (t: Test) => void;
  onRemove: (id: string) => void;
  onPair?: (t: Test) => void;
  onAddMissing?: (t: Test) => void;
}) {
  const date = formatSourceDate(group.source_month, group.source_year);
  const existing = [...group.mod1, ...group.mod2][0];

  return (
    <div className="rise-in overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 shadow-panel">
      <div className="border-b border-brand-400/30 px-4 py-3">
        <div className="truncate text-sm font-semibold text-white">{group.base}</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <span className="rounded bg-brand-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            {SECTION_LABEL[group.section]}
          </span>
          {date && (
            <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
              {date}
            </span>
          )}
        </div>
      </div>
      {/* Module 1 stacks above Module 2 under this paper only. */}
      <div className="flex flex-col gap-3 p-3">
        {([1, 2] as const).map((mod) => {
          const rows = mod === 1 ? group.mod1 : group.mod2;
          return (
            <div
              key={mod}
              className="overflow-hidden rounded-xl border border-brand-400/30 border-l-4 border-l-brand-400 bg-brand-800/50"
            >
              <div className="border-b border-brand-400/20 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-brand-200">
                Module {mod}
              </div>
              {rows.length === 0 ? (
                <div className="space-y-2 px-4 py-3">
                  <div className="text-xs text-brand-200">No module yet</div>
                  {existing && onPair && onAddMissing && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => onPair(existing)}
                        className="tap inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-100 hover:bg-brand-800 hover:text-white"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        Pair
                      </button>
                      <button
                        onClick={() => onAddMissing(existing)}
                        className="tap inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-100 hover:bg-brand-800 hover:text-white"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Module {mod}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <ul>
                  {rows.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-2 px-4 py-2.5 transition-colors hover:bg-brand-500"
                    >
                      <span
                        className={
                          "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
                          difficultyColor(t.difficulty)
                        }
                      >
                        {t.difficulty}
                      </span>
                      <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                        {counts.get(t.id) ?? 0} q
                      </span>
                      <div className="flex-1" />
                      <button
                        onClick={() => onEdit(t)}
                        className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-800 hover:text-white"
                        aria-label={`Edit Module ${mod}`}
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onRemove(t.id)}
                        className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-900 hover:text-white"
                        aria-label={`Delete Module ${mod}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-brand-100">
        {label}
      </span>
      {children}
    </label>
  );
}
