import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Edit3, X, Eye, EyeOff, Layers } from "lucide-react";
import { ListSkeleton } from "@/components/ui/skeletons";
import {
  SECTION_LABEL,
  difficultyColor,
  formatSourceDate,
  type Section,
  type LetterDifficulty,
} from "@/lib/sat";
import {
  buildFullPapers,
  collectUsedTestIds,
  filterPapersForMockPicker,
  DEFAULT_MOCK_TIMINGS,
  groupByPaperDate,
  saveMockExam,
  type FullPaper,
} from "@/lib/mock-exams";

type Mock = {
  id: string;
  title: string;
  description: string | null;
  rw_module1_time_seconds: number;
  rw_module2_time_seconds: number;
  math_module1_time_seconds: number;
  math_module2_time_seconds: number;
  rw_module1_threshold: number;
  math_module1_threshold: number;
  section_break_seconds: number;
  published: boolean;
};

type Test = {
  id: string;
  title: string;
  section: Section;
  module: 1 | 2;
  difficulty: LetterDifficulty;
  source_month: number | null;
  source_year: number | null;
};

export const Route = createFileRoute("/_authenticated/admin/mocks")({
  component: AdminMocks,
});

/** Shared control styling. `color-scheme` keeps native selects and number
    spinners light-on-dark instead of white-on-white. */
const CONTROL_CLASS =
  "w-full rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2 text-sm text-white [color-scheme:dark] placeholder:text-brand-200 focus:border-brand-200 focus:outline-none";

const empty = (): Mock => ({
  id: "",
  title: "",
  description: "",
  ...DEFAULT_MOCK_TIMINGS,
  published: false,
});

function AdminMocks() {
  const [items, setItems] = useState<Mock[] | null>(null);
  const [editing, setEditing] = useState<Mock | null>(null);
  const [papers, setPapers] = useState<FullPaper[]>([]);
  const [selectedPapers, setSelectedPapers] = useState<Record<Section, string | null>>({
    reading_writing: null,
    math: null,
  });
  const [usedTestIds, setUsedTestIds] = useState<Set<string>>(() => new Set());

  async function load() {
    const { data } = await supabase
      .from("mock_exams")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Mock[]);
  }
  useEffect(() => {
    load();
  }, []);

  async function openEditor(m?: Mock) {
    const target = m
      ? {
          ...DEFAULT_MOCK_TIMINGS,
          ...m,
          section_break_seconds:
            m.section_break_seconds ?? DEFAULT_MOCK_TIMINGS.section_break_seconds,
        }
      : empty();
    setEditing(target);
    const [{ data: tests }, { data: linked }, { data: allSections }] = await Promise.all([
      supabase.from("tests").select("*").order("title").order("module"),
      target.id
        ? supabase.from("mock_exam_sections").select("test_id").eq("mock_exam_id", target.id)
        : Promise.resolve({ data: [] as { test_id: string | null }[] }),
      supabase.from("mock_exam_sections").select("mock_exam_id, test_id"),
    ]);
    const nextPapers = buildFullPapers((tests ?? []) as Test[]);
    const consumed = collectUsedTestIds(allSections ?? [], target.id || null);
    setUsedTestIds(consumed);
    const linkedIds = new Set(
      ((linked ?? []) as { test_id: string | null }[])
        .map((row) => row.test_id)
        .filter((id): id is string => Boolean(id)),
    );
    setPapers(nextPapers);
    setSelectedPapers({
      reading_writing:
        nextPapers.find(
          (paper) =>
            paper.section === "reading_writing" &&
            linkedIds.has(paper.module1.id) &&
            linkedIds.has(paper.module2.id),
        )?.key ?? null,
      math:
        nextPapers.find(
          (paper) =>
            paper.section === "math" &&
            linkedIds.has(paper.module1.id) &&
            linkedIds.has(paper.module2.id),
        )?.key ?? null,
    });
    setPapers(nextPapers);
  }

  async function save() {
    if (!editing) return;
    const rwPaper = papers.find((paper) => paper.key === selectedPapers.reading_writing);
    const mathPaper = papers.find((paper) => paper.key === selectedPapers.math);
    if (!rwPaper || !mathPaper) {
      return alert("Choose one complete Reading & Writing paper and one complete Math paper.");
    }
    const { id, ...payload } = editing;
    const result = await saveMockExam(rwPaper, mathPaper, payload, id || undefined);
    if (result.error) return alert(result.error);
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this mock exam?")) return;
    await supabase.from("mock_exams").delete().eq("id", id);
    load();
  }
  async function togglePublish(m: Mock) {
    await supabase.from("mock_exams").update({ published: !m.published }).eq("id", m.id);
    load();
  }

  return (
    <div>
      <div className="flex justify-end">
        <button
          onClick={() => openEditor()}
          className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> New mock exam
        </button>
      </div>

      {items === null ? (
        <div className="mt-4">
          <ListSkeleton rows={4} />
        </div>
      ) : (
        <div className="rise-in mt-4 overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 shadow-panel">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-brand-100">No mock exams yet.</div>
          ) : (
            <ul className="divide-y divide-brand-400/30">
              {items.map((m) => (
                <li key={m.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-white">{m.title}</span>
                      {/* Published vs draft reads through the ramp's lightness. */}
                      <span
                        className={
                          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
                          (m.published
                            ? "bg-brand-400 text-white"
                            : "bg-brand-800 text-brand-100 ring-1 ring-brand-400/40")
                        }
                      >
                        {m.published ? "Published" : "Draft"}
                      </span>
                    </div>
                    {m.description && (
                      <div className="mt-0.5 line-clamp-1 text-xs text-brand-100">
                        {m.description}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => togglePublish(m)}
                    className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-800 hover:text-white"
                    title={m.published ? "Unpublish" : "Publish"}
                  >
                    {m.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => openEditor(m)}
                    className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-800 hover:text-white"
                    aria-label="Edit mock exam"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => remove(m.id)}
                    className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-900 hover:text-white"
                    aria-label="Delete mock exam"
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
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-brand-900/60 p-4 backdrop-blur-sm">
          <div className="pop-in my-8 flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-brand-400/40 bg-brand-600 shadow-float">
            <div className="flex items-center justify-between border-b border-brand-400/30 px-6 py-4">
              <h3 className="text-lg font-bold text-white">
                {editing.id ? "Edit mock exam" : "New mock exam"}
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-800 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-6 overflow-y-auto p-6">
              <Row label="Title">
                <input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className={CONTROL_CLASS}
                />
              </Row>
              <Row label="Description">
                <textarea
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={2}
                  className={CONTROL_CLASS}
                />
              </Row>

              <div className="rounded-xl border border-brand-400/40 bg-brand-700 p-4">
                <div className="mb-1 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-brand-100" />
                  <h4 className="text-sm font-bold text-white">Full mock papers</h4>
                </div>
                <p className="mb-4 text-xs leading-relaxed text-brand-100">
                  Choose one complete paper for each SAT section. Both modules are included
                  automatically.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {(["reading_writing", "math"] as const).map((section) => (
                    <PaperPicker
                      key={section}
                      section={section}
                      papers={filterPapersForMockPicker(
                        papers.filter((paper) => paper.section === section),
                        usedTestIds,
                        [selectedPapers[section]],
                      )}
                      selectedKey={selectedPapers[section]}
                      onChange={(key) =>
                        setSelectedPapers((current) => ({ ...current, [section]: key }))
                      }
                    />
                  ))}
                </div>
              </div>

              <details className="rounded-xl border border-brand-400/40 p-4">
                <summary className="cursor-pointer text-sm font-bold text-white">
                  Advanced: timings
                </summary>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Row label="R&W module 1 time (s)">
                    <NumInput
                      v={editing.rw_module1_time_seconds}
                      set={(v) => setEditing({ ...editing, rw_module1_time_seconds: v })}
                    />
                  </Row>
                  <Row label="R&W module 2 time (s)">
                    <NumInput
                      v={editing.rw_module2_time_seconds}
                      set={(v) => setEditing({ ...editing, rw_module2_time_seconds: v })}
                    />
                  </Row>
                  <Row label="Math module 1 time (s)">
                    <NumInput
                      v={editing.math_module1_time_seconds}
                      set={(v) => setEditing({ ...editing, math_module1_time_seconds: v })}
                    />
                  </Row>
                  <Row label="Math module 2 time (s)">
                    <NumInput
                      v={editing.math_module2_time_seconds}
                      set={(v) => setEditing({ ...editing, math_module2_time_seconds: v })}
                    />
                  </Row>
                  <Row label="Break between R&W and Math (minutes)">
                    <NumInput
                      v={Math.round((editing.section_break_seconds ?? 1200) / 60)}
                      set={(v) =>
                        setEditing({
                          ...editing,
                          section_break_seconds: Math.max(0, Math.floor(v)) * 60,
                        })
                      }
                    />
                  </Row>
                </div>
              </details>

              <label className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                {/* accent-color keeps the native checkbox on-palette when checked. */}
                <input
                  type="checkbox"
                  checked={editing.published}
                  onChange={(e) => setEditing({ ...editing, published: e.target.checked })}
                  className="h-4 w-4 accent-brand-200 [color-scheme:dark]"
                />
                Published
              </label>
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
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PaperPicker({
  section,
  papers,
  selectedKey,
  onChange,
}: {
  section: Section;
  papers: FullPaper[];
  selectedKey: string | null;
  onChange: (key: string | null) => void;
}) {
  const dateGroups = useMemo(
    () =>
      groupByPaperDate(papers),
    [papers],
  );
  const selected = papers.find((paper) => paper.key === selectedKey);

  return (
    <div className="rounded-xl border border-brand-400/40 bg-brand-600 p-4">
      <label className="block">
        <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-white">
          {SECTION_LABEL[section]}
        </span>
        <select
          value={selectedKey ?? ""}
          onChange={(event) => onChange(event.target.value || null)}
          className={CONTROL_CLASS}
        >
          <option value="">— Choose a full paper —</option>
          {dateGroups.map((dateGroup) => (
            <optgroup key={dateGroup.key} label={dateGroup.label}>
              {dateGroup.items.map((paper) => (
                <option key={paper.key} value={paper.key}>
                  {paper.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {papers.length === 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-brand-200">
          No complete {SECTION_LABEL[section]} paper is available. Add and pair both modules on the
          Tests page first.
        </p>
      ) : selected ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {([selected.module1, selected.module2] as const).map((test) => (
            <div key={test.id} className="rounded-lg bg-brand-800 px-3 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-brand-200">
                Module {test.module}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                <span
                  className={
                    "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
                    difficultyColor(test.difficulty)
                  }
                >
                  {test.difficulty}
                </span>
                {formatSourceDate(test.source_month, test.source_year) && (
                  <span className="rounded bg-brand-700 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                    {formatSourceDate(test.source_month, test.source_year)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-brand-200">Select a paper to include Modules 1 and 2.</p>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-brand-100">
        {label}
      </span>
      {children}
    </label>
  );
}
function NumInput({ v, set }: { v: number; set: (n: number) => void }) {
  return (
    <input
      type="number"
      value={v}
      onChange={(e) => set(parseInt(e.target.value) || 0)}
      className={CONTROL_CLASS}
    />
  );
}
