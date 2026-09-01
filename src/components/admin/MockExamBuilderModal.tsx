import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, Layers, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  SECTION_LABEL,
  difficultyColor,
  type Section,
} from "@/lib/sat";
import {
  buildFullPapers,
  collectUsedTestIds,
  filterPapersForMockPicker,
  DEFAULT_MOCK_TIMINGS,
  groupByPaperDate,
  matchPaperForSection,
  saveMockExam,
  suggestMockTitle,
  type FullPaper,
  type MockExamTest,
} from "@/lib/mock-exams";

const CONTROL_CLASS =
  "w-full rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2 text-sm text-white [color-scheme:dark] placeholder:text-brand-200 focus:border-brand-200 focus:outline-none";

export function MockExamBuilderModal({
  open,
  onClose,
  onSaved,
  initialRwKey,
  initialMathKey,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (mockId: string) => void;
  /** Pre-select an R&W paper (FullPaper.key). */
  initialRwKey?: string | null;
  /** Pre-select a Math paper (FullPaper.key). */
  initialMathKey?: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [papers, setPapers] = useState<FullPaper[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [published, setPublished] = useState(false);
  const [selected, setSelected] = useState<Record<Section, string | null>>({
    reading_writing: null,
    math: null,
  });
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSavedId(null);
    setLoading(true);
    (async () => {
      const [{ data }, { data: sectionLinks }] = await Promise.all([
        supabase.from("tests").select("*").order("title").order("module"),
        supabase.from("mock_exam_sections").select("mock_exam_id, test_id"),
      ]);
      const nextPapers = buildFullPapers((data ?? []) as MockExamTest[]);
      const usedTestIds = collectUsedTestIds(sectionLinks ?? []);

      let rwKey = initialRwKey ?? null;
      let mathKey = initialMathKey ?? null;
      let available = filterPapersForMockPicker(nextPapers, usedTestIds, [rwKey, mathKey]);

      const rwPaper = rwKey ? available.find((p) => p.key === rwKey) : null;
      if (rwPaper && !mathKey) {
        const matched = matchPaperForSection(rwPaper, available, "math");
        mathKey = matched?.key ?? null;
      }
      const mathPaper = mathKey ? available.find((p) => p.key === mathKey) : null;
      if (mathPaper && !rwKey) {
        const matched = matchPaperForSection(mathPaper, available, "reading_writing");
        rwKey = matched?.key ?? null;
      }

      available = filterPapersForMockPicker(nextPapers, usedTestIds, [rwKey, mathKey]);
      const rw = rwKey ? available.find((p) => p.key === rwKey) : null;
      const math = mathKey ? available.find((p) => p.key === mathKey) : null;
      setPapers(available);
      setSelected({ reading_writing: rwKey, math: mathKey });
      setTitle(rw && math ? suggestMockTitle(rw, math) : "");
      setDescription("");
      setPublished(false);
      setLoading(false);
    })();
  }, [open, initialRwKey, initialMathKey]);

  const rwPaper = papers.find((p) => p.key === selected.reading_writing);
  const mathPaper = papers.find((p) => p.key === selected.math);

  const rwOptions = useMemo(
    () => papers.filter((p) => p.section === "reading_writing"),
    [papers],
  );
  const mathOptions = useMemo(() => papers.filter((p) => p.section === "math"), [papers]);
  const rwDateGroups = useMemo(() => groupByPaperDate(rwOptions), [rwOptions]);
  const mathDateGroups = useMemo(() => groupByPaperDate(mathOptions), [mathOptions]);

  function pickSection(section: Section, key: string | null) {
    setSelected((current) => {
      const next = { ...current, [section]: key };
      const rw = key && section === "reading_writing" ? papers.find((p) => p.key === key) : papers.find((p) => p.key === next.reading_writing);
      const math = key && section === "math" ? papers.find((p) => p.key === key) : papers.find((p) => p.key === next.math);

      if (section === "reading_writing" && rw && !next.math) {
        const matched = matchPaperForSection(rw, papers, "math");
        if (matched) next.math = matched.key;
      }
      if (section === "math" && math && !next.reading_writing) {
        const matched = matchPaperForSection(math, papers, "reading_writing");
        if (matched) next.reading_writing = matched.key;
      }

      const finalRw = papers.find((p) => p.key === next.reading_writing);
      const finalMath = papers.find((p) => p.key === next.math);
      if (finalRw && finalMath) {
        setTitle(suggestMockTitle(finalRw, finalMath));
      }
      return next;
    });
  }

  async function handleSave() {
    if (!rwPaper || !mathPaper) {
      alert("Choose one complete Reading & Writing paper and one complete Math paper.");
      return;
    }
    setSaving(true);
    const result = await saveMockExam(rwPaper, mathPaper, {
      title,
      description: description.trim() || null,
      published,
      ...DEFAULT_MOCK_TIMINGS,
    });
    setSaving(false);
    if (result.error) {
      alert(result.error);
      return;
    }
    setSavedId(result.mockId);
    onSaved?.(result.mockId);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-brand-900/60 p-4 backdrop-blur-sm">
      <div className="pop-in my-8 flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-brand-400/40 bg-brand-600 shadow-float">
        <div className="flex items-center justify-between border-b border-brand-400/30 px-6 py-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-brand-100" />
            <h3 className="text-lg font-bold text-white">Combine papers into full mock</h3>
          </div>
          <button
            onClick={onClose}
            className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-800 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {savedId ? (
          <div className="space-y-4 p-6 text-center">
            <p className="text-sm font-semibold text-white">Mock exam created.</p>
            <p className="text-xs text-brand-100">
              Students can take it from Practice → Full mock exams once published.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <Link
                to="/admin/mocks"
                className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white"
              >
                View mock exams
              </Link>
              <button
                onClick={onClose}
                className="tap rounded-lg border border-brand-400/50 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-6 overflow-y-auto p-6">
              <p className="text-sm leading-relaxed text-brand-100">
                Pick one complete EBRW paper and one complete Math paper. All four modules (R&W Mod
                1 & 2, Math Mod 1 & 2) are linked automatically.
              </p>

              {loading ? (
                <div className="py-8 text-center text-sm text-brand-200">Loading papers…</div>
              ) : (
                <>
                  <div className="rounded-xl border border-brand-400/40 bg-brand-700 p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <Layers className="h-4 w-4 text-brand-100" />
                      <h4 className="text-sm font-bold text-white">Choose papers</h4>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <PaperPicker
                        section="reading_writing"
                        dateGroups={rwDateGroups}
                        selectedKey={selected.reading_writing}
                        onChange={(key) => pickSection("reading_writing", key)}
                      />
                      <PaperPicker
                        section="math"
                        dateGroups={mathDateGroups}
                        selectedKey={selected.math}
                        onChange={(key) => pickSection("math", key)}
                      />
                    </div>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-brand-100">
                      Mock title
                    </span>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. November 2024 · Full Mock"
                      className={CONTROL_CLASS}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-brand-100">
                      Description (optional)
                    </span>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      className={CONTROL_CLASS}
                    />
                  </label>

                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                    <input
                      type="checkbox"
                      checked={published}
                      onChange={(e) => setPublished(e.target.checked)}
                      className="h-4 w-4 accent-brand-200 [color-scheme:dark]"
                    />
                    Publish for students
                  </label>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-brand-400/30 px-6 py-4">
              <button
                onClick={onClose}
                className="tap rounded-lg px-4 py-2 text-sm font-semibold text-brand-100 hover:bg-brand-800 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={loading || saving || !rwPaper || !mathPaper || !title.trim()}
                className="btn-brand rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {saving ? "Creating…" : "Create mock exam"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PaperPicker({
  section,
  dateGroups,
  selectedKey,
  onChange,
}: {
  section: Section;
  dateGroups: ReturnType<typeof groupByPaperDate<FullPaper>>;
  selectedKey: string | null;
  onChange: (key: string | null) => void;
}) {
  const papers = dateGroups.flatMap((g) => g.items);
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
          No complete {SECTION_LABEL[section]} paper yet. Pair both modules on the Tests page
          first.
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
