import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

/** Shared control styling. `color-scheme` keeps native selects and number
    spinners light-on-dark instead of white-on-white. */
const CONTROL_CLASS =
  "w-full rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2 text-sm text-white [color-scheme:dark] placeholder:text-brand-200 focus:border-brand-200 focus:outline-none";

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
  const [items, setItems] = useState<Mock[] | null>(null);
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
                      <div className="mt-0.5 line-clamp-1 text-xs text-brand-100">{m.description}</div>
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

              {[1, 2].map((mod) => (
                <div key={mod} className="rounded-xl border border-brand-400/40 bg-brand-700 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-brand-100" />
                    <h4 className="text-sm font-bold text-white">Module {mod} — 4 sections</h4>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {[1, 2, 3, 4].map((idx) => {
                      const slot = slots.find(
                        (s) => s.module === mod && s.section_index === idx,
                      )!;
                      const availableTests = testPool.filter((t) => t.module === mod);
                      const currentTest = testPool.find((t) => t.id === slot.test_id);
                      return (
                        <div
                          key={idx}
                          className="space-y-2 rounded-lg border border-brand-400/40 bg-brand-600 p-3"
                        >
                          <div className="flex items-center gap-2">
                            <span className="shrink-0 rounded bg-brand-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                              {idx}
                            </span>
                            <input
                              value={slot.section_name}
                              onChange={(e) =>
                                updateSlot(mod as 1 | 2, idx as 1 | 2 | 3 | 4, {
                                  section_name: e.target.value,
                                })
                              }
                              className="flex-1 rounded-md border border-brand-400/50 bg-brand-800 px-2 py-1 text-xs font-semibold text-white placeholder:text-brand-200 focus:border-brand-200 focus:outline-none"
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
                            className="w-full rounded-md border border-brand-400/50 bg-brand-800 px-2 py-1.5 text-xs text-white [color-scheme:dark] focus:border-brand-200 focus:outline-none"
                          >
                            <option value="">— Choose a test —</option>
                            {availableTests.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.title} · {SECTION_LABEL[t.section]} · {t.difficulty}
                              </option>
                            ))}
                          </select>
                          {currentTest && (
                            <div className="flex flex-wrap gap-1">
                              <span
                                className={
                                  "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
                                  difficultyColor(currentTest.difficulty)
                                }
                              >
                                {currentTest.difficulty}
                              </span>
                              {formatSourceDate(
                                currentTest.source_month,
                                currentTest.source_year,
                              ) && (
                                <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
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

              <details className="rounded-xl border border-brand-400/40 p-4">
                <summary className="cursor-pointer text-sm font-bold text-white">
                  Advanced: timings &amp; thresholds
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
