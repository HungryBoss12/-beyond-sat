import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Edit3, X, Eye, EyeOff, Layers } from "lucide-react";
import {
  SECTION_LABEL,
  difficultyColor,
  formatSourceDate,
  type Section,
  type LetterDifficulty,
} from "@/lib/sat";

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

type SectionSlot = {
  id?: string;
  module: 1 | 2;
  section_index: 1 | 2 | 3 | 4;
  section_name: string;
  test_id: string | null;
};

const DEFAULT_SECTION_NAMES = [
  "Information and Ideas",
  "Craft and Structure",
  "Expression of Ideas",
  "Standard English Conventions",
];

export const Route = createFileRoute("/_authenticated/admin/mocks")({
  component: AdminMocks,
});

const empty = (): Mock => ({
  id: "",
  title: "",
  description: "",
  rw_module1_time_seconds: 1920,
  rw_module2_time_seconds: 1920,
  math_module1_time_seconds: 2100,
  math_module2_time_seconds: 2100,
  rw_module1_threshold: 15,
  math_module1_threshold: 12,
  published: false,
});

function emptySlots(): SectionSlot[] {
  const arr: SectionSlot[] = [];
  for (const mod of [1, 2] as const) {
    for (let i = 0; i < 4; i++) {
      arr.push({
        module: mod,
        section_index: (i + 1) as 1 | 2 | 3 | 4,
        section_name: DEFAULT_SECTION_NAMES[i],
        test_id: null,
      });
    }
  }
  return arr;
}

function AdminMocks() {
  const [items, setItems] = useState<Mock[]>([]);
  const [editing, setEditing] = useState<Mock | null>(null);
  const [slots, setSlots] = useState<SectionSlot[]>(emptySlots());
  const [testPool, setTestPool] = useState<Test[]>([]);

  async function load() {
    const { data } = await supabase.from("mock_exams").select("*").order("created_at", { ascending: false });
    setItems((data ?? []) as Mock[]);
  }
  useEffect(() => {
    load();
  }, []);

  async function openEditor(m?: Mock) {
    const target = m ?? empty();
    setEditing(target);
    const { data: tests } = await supabase
      .from("tests")
      .select("*")
      .order("module")
      .order("title");
    setTestPool((tests ?? []) as Test[]);
    if (target.id) {
      const { data: mes } = await supabase
        .from("mock_exam_sections")
        .select("*")
        .eq("mock_exam_id", target.id)
        .order("module")
        .order("section_index");
      const loaded = (mes ?? []) as SectionSlot[];
      const filled = emptySlots().map((s) => {
        const found = loaded.find(
          (l) => l.module === s.module && l.section_index === s.section_index,
        );
        return found ? { ...s, ...found } : s;
      });
      setSlots(filled);
    } else {
      setSlots(emptySlots());
    }
  }

  async function save() {
    if (!editing) return;
    const payload = { ...editing } as any;
    delete payload.id;
    let mockId = editing.id;
    if (mockId) {
      const { error } = await supabase.from("mock_exams").update(payload).eq("id", mockId);
      if (error) return alert(error.message);
    } else {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("mock_exams")
        .insert({ ...payload, created_by: u.user?.id })
        .select("id")
        .single();
      if (error) return alert(error.message);
      mockId = data.id as string;
    }
    await supabase.from("mock_exam_sections").delete().eq("mock_exam_id", mockId);
    const rows = slots
      .filter((s) => s.test_id || s.section_name)
      .map((s) => ({
        mock_exam_id: mockId,
        module: s.module,
        section_index: s.section_index,
        section_name: s.section_name || `Section ${s.section_index}`,
        test_id: s.test_id,
      }));
    if (rows.length > 0) {
      const { error } = await supabase.from("mock_exam_sections").insert(rows);
      if (error) return alert(error.message);
    }
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

  function updateSlot(module: 1 | 2, idx: 1 | 2 | 3 | 4, patch: Partial<SectionSlot>) {
    setSlots(
      slots.map((s) =>
        s.module === module && s.section_index === idx ? { ...s, ...patch } : s,
      ),
    );
  }

  return (
    <div>
      <div className="flex justify-end">
        <button
          onClick={() => openEditor()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New mock exam
        </button>
      </div>
      <div className="mt-4 rounded-2xl border border-border bg-white overflow-hidden">
        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No mock exams yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((m) => (
              <li key={m.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 truncate">{m.title}</span>
                    <span
                      className={
                        "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded " +
                        (m.published ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")
                      }
                    >
                      {m.published ? "Published" : "Draft"}
                    </span>
                  </div>
                  {m.description && (
                    <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{m.description}</div>
                  )}
                </div>
                <button
                  onClick={() => togglePublish(m)}
                  className="rounded-lg h-8 w-8 grid place-items-center text-slate-500 hover:bg-slate-100"
                >
                  {m.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => openEditor(m)}
                  className="rounded-lg h-8 w-8 grid place-items-center text-slate-500 hover:bg-slate-100"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remove(m.id)}
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
        <div className="fixed inset-0 z-50 bg-slate-900/50 grid place-items-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl my-8 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-bold text-slate-800">
                {editing.id ? "Edit mock exam" : "New mock exam"}
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg h-8 w-8 grid place-items-center text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto">
              <Row label="Title">
                <input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </Row>
              <Row label="Description">
                <textarea
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </Row>

              {[1, 2].map((mod) => (
                <div key={mod} className="rounded-xl border border-border p-4 bg-slate-50">
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-bold text-primary">Module {mod} — 4 sections</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map((idx) => {
                      const slot = slots.find(
                        (s) => s.module === mod && s.section_index === idx,
                      )!;
                      const availableTests = testPool.filter((t) => t.module === mod);
                      const currentTest = testPool.find((t) => t.id === slot.test_id);
                      return (
                        <div
                          key={idx}
                          className="rounded-lg bg-white border border-border p-3 space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                              {idx}
                            </span>
                            <input
                              value={slot.section_name}
                              onChange={(e) =>
                                updateSlot(mod as 1 | 2, idx as 1 | 2 | 3 | 4, {
                                  section_name: e.target.value,
                                })
                              }
                              className="flex-1 rounded-md border border-border px-2 py-1 text-xs font-semibold"
                              placeholder={`Section ${idx} name`}
                            />
                          </div>
                          <select
                            value={slot.test_id ?? ""}
                            onChange={(e) =>
                              updateSlot(mod as 1 | 2, idx as 1 | 2 | 3 | 4, {
                                test_id: e.target.value || null,
                              })
                            }
                            className="w-full rounded-md border border-border px-2 py-1.5 text-xs"
                          >
                            <option value="">— Choose a test —</option>
                            {availableTests.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.title} · {SECTION_LABEL[t.section]} · {t.difficulty}
                              </option>
                            ))}
                          </select>
                          {currentTest && (
                            <div className="flex gap-1 flex-wrap">
                              <span
                                className={
                                  "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded " +
                                  difficultyColor(currentTest.difficulty)
                                }
                              >
                                {currentTest.difficulty}
                              </span>
                              {formatSourceDate(
                                currentTest.source_month,
                                currentTest.source_year,
                              ) && (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                  {formatSourceDate(
                                    currentTest.source_month,
                                    currentTest.source_year,
                                  )}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <details className="rounded-xl border border-border p-4">
                <summary className="text-sm font-bold text-slate-700 cursor-pointer">
                  Advanced: timings & thresholds
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
                  <Row label="R&W module-1 threshold">
                    <NumInput
                      v={editing.rw_module1_threshold}
                      set={(v) => setEditing({ ...editing, rw_module1_threshold: v })}
                    />
                  </Row>
                  <Row label="Math module-1 threshold">
                    <NumInput
                      v={editing.math_module1_threshold}
                      set={(v) => setEditing({ ...editing, math_module1_threshold: v })}
                    />
                  </Row>
                </div>
              </details>

              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={editing.published}
                  onChange={(e) => setEditing({ ...editing, published: e.target.checked })}
                />
                Published
              </label>
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
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
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
      className="w-full rounded-lg border border-border px-3 py-2 text-sm"
    />
  );
}
