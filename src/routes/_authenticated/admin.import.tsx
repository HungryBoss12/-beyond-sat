import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  parseDelimited,
  parseJson,
  validateRecord,
  flagDuplicates,
  dedupeKey,
  JSON_TEMPLATE,
  TSV_TEMPLATE,
  TSV_COLUMNS,
  type ParseResult,
} from "@/lib/question-import";
import { readDocx } from "@/lib/import/docx";
import {
  blankDraft,
  blocksToDrafts,
  draftModule,
  stampDraftModules,
  type Draft,
  type ParseDefaults,
  type SourceBlock,
} from "@/lib/import/parse";
import { needsFigure } from "@/lib/import/attach-figures";
import { parseAnswerKey, applyAnswerKey, describeKey } from "@/lib/import/answer-key";
import {
  skillsFor,
  MONTHS,
  LETTER_DIFFICULTIES,
  formatSourceDate,
  moduleTitle,
  type Section,
  type LetterDifficulty,
} from "@/lib/sat";
import {
  AnswerKeyBox,
  CHUNK,
  CONTROL_CLASS,
  CopyBox,
  Field,
  mergeDrafts,
  PreviewPanel,
  VisionPanel,
  WizardSteps,
  type FigureProgress,
  type FixProgress,
  type ImportWizardStep,
  type Mode,
  type VisionState,
} from "@/components/admin-import";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Braces,
  Check,
  ClipboardPaste,
  FileText,
  FileUp,
  Loader2,
  Plus,
  Table2,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/import")({
  component: AdminImport,
  head: () => ({ meta: [{ title: "Add tests — BeyondSAT" }] }),
});

type ModuleChoice = 1 | 2 | "both";

function AdminImport() {
  const [step, setStep] = useState<ImportWizardStep>("setup");
  const [mode, setMode] = useState<Mode>("upload");

  const [makeSet, setMakeSet] = useState(true);
  const [title, setTitle] = useState("");
  const [section, setSection] = useState<Section>("reading_writing");
  const [module, setModule] = useState<ModuleChoice>(1);
  const [difficulty, setDifficulty] = useState<LetterDifficulty>("C");
  const [month, setMonth] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(new Date().getFullYear());

  const [text, setText] = useState("");
  const [checking, setChecking] = useState(false);
  const [parsed, setParsed] = useState<ParseResult | null>(null);

  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [vision, setVision] = useState<VisionState | null>(null);
  const stopRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const [fixing, setFixing] = useState(false);
  const [fixProgress, setFixProgress] = useState<FixProgress | null>(null);
  const [attachingFigures, setAttachingFigures] = useState(false);
  const [figureProgress, setFigureProgress] = useState<FigureProgress | null>(null);

  const [keyText, setKeyText] = useState("");
  const [keySummary, setKeySummary] = useState<string | null>(null);
  const [sourcePdf, setSourcePdf] = useState<File | null>(null);

  const [existingKeys, setExistingKeys] = useState<Set<string>>(new Set());
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{
    inserted: number;
    failed: number;
    errors: string[];
    setTitle?: string;
  } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      stopRef.current = true;
      abortRef.current?.abort();
    },
    [],
  );

  async function fetchExisting(): Promise<Set<string>> {
    const keys = new Set<string>();
    const { data, error } = await supabase
      .from("questions")
      .select("section,question_text")
      .limit(5000);
    if (!error) {
      for (const r of (data ?? []) as { section: string; question_text: string }[]) {
        keys.add(dedupeKey(r.section, r.question_text));
      }
    }
    setExistingKeys(keys);
    return keys;
  }

  function clearExtracted() {
    setParsed(null);
    setDrafts(null);
    setNotes([]);
    setReadError(null);
    setResult(null);
    setKeySummary(null);
    setVision(null);
    setFileName("");
    setSourcePdf(null);
  }

  function defaults(): ParseDefaults {
    return {
      section,
      skill: skillsFor(section)[0],
      difficulty,
      source_month: month ? String(month) : "",
      source_year: year ? String(year) : "",
      module: module === "both" ? undefined : module === 2 ? "2" : "1",
    };
  }

  function commitDrafts(list: Draft[]) {
    setDrafts(stampDraftModules(list, module));
  }

  function splitNote(list: Draft[]): string | null {
    if (module !== "both" || list.length === 0) return null;
    const m1 = list.filter((d) => draftModule(d) === 1).length;
    return `Split as ${m1} Module 1 and ${list.length - m1} Module 2 question(s). Change a question's module in the editor if a split is wrong.`;
  }

  function setModuleChoice(next: ModuleChoice) {
    setModule(next);
    setDrafts((current) =>
      current
        ? stampDraftModules(
            current.map((d) => ({ ...d, rec: { ...d.rec, module: "" } })),
            next,
          )
        : current,
    );
  }

  const hasRows = Boolean((drafts && drafts.length > 0) || (parsed && parsed.rows.length > 0));

  const unlocked = useMemo(() => {
    const s = new Set<ImportWizardStep>(["setup", "source"]);
    s.add("extract");
    if (hasRows) s.add("editor");
    return s;
  }, [hasRows]);

  async function checkPaste() {
    setChecking(true);
    setResult(null);
    setDrafts(null);
    const base = mode === "sheet" ? parseDelimited(text) : parseJson(text);
    if (base.fatal) {
      setParsed(base);
      setChecking(false);
      return;
    }
    await fetchExisting();
    const next = stampDraftModules(
      base.rows.map((r) => ({
        number: r.index,
        rec: r.rec ? { ...r.rec } : {},
        warnings: r.warnings.filter(
          (w) => !w.includes("Duplicate") && !w.includes("already exists"),
        ),
      })),
      module,
    );
    setDrafts(next);
    const split = splitNote(next);
    setNotes(split ? [split] : []);
    setParsed({ ...base, rows: [] });
    setChecking(false);
    setStep("editor");
  }

  function loadSheetFile(f: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result ?? ""));
      clearExtracted();
      if (/\.json$/i.test(f.name)) setMode("json");
      else setMode("sheet");
    };
    reader.readAsText(f);
  }

  async function finishDocument(blocks: Array<string | SourceBlock>, extraNotes: string[] = []) {
    const out = blocksToDrafts(blocks, defaults());
    const stamped = stampDraftModules(out.drafts, module);
    setDrafts(stamped);
    const split = splitNote(stamped);
    setNotes([...extraNotes, ...out.notes, ...(split ? [split] : [])]);
    if (stamped.length > 0) {
      await fetchExisting();
      setStep("editor");
    }
  }

  async function loadDocument(f: File) {
    clearExtracted();
    setFileName(f.name);
    setKeyText("");
    setMode("upload");

    try {
      if (/\.docx$/i.test(f.name)) {
        setReading("Reading the document…");
        const blocks = await readDocx(f);
        await finishDocument(blocks);
        return;
      }

      if (/\.pdf$/i.test(f.name)) {
        setSourcePdf(f);
        setReading("Looking for a text layer…");
        const { readPdfText } = await import("@/lib/import/pdf");
        const out = await readPdfText(f, (p, t) => setReading(`Reading page ${p} of ${t}…`));
        if (out.scanned) {
          setReading(null);
          setNotes([
            `This PDF has no text layer — it's a scan of ${out.pages} page${out.pages === 1 ? "" : "s"}. Reading it uses Gemini, one page at a time.`,
          ]);
          setVision({
            file: f,
            pages: out.pages,
            from: 1,
            to: Math.min(out.pages, 10),
            running: false,
            progress: null,
          });
          return;
        }
        await finishDocument(out.blocks, [
          `Read the text layer of ${out.pages} page(s) — no AI needed.`,
        ]);
        return;
      }

      if (/\.(txt|md)$/i.test(f.name)) {
        setReading("Reading the document…");
        const raw = await f.text();
        await finishDocument(
          raw
            .replace(/\r\n?/g, "\n")
            .split(/\n\s*\n/)
            .map((b) => b.trim())
            .filter(Boolean),
        );
        return;
      }

      setReadError(
        `"${f.name}" isn't a format this can read. Upload a .docx, a .pdf, or a .txt — or use Spreadsheet / JSON.`,
      );
    } catch (err) {
      setReadError((err as Error)?.message ?? "That file couldn't be read.");
    } finally {
      setReading(null);
    }
  }

  async function runVision() {
    if (!vision) return;
    stopRef.current = false;
    const ac = new AbortController();
    abortRef.current = ac;
    setVision({ ...vision, running: true, progress: null });
    setReadError(null);

    try {
      const { extractByVision } = await import("@/lib/import/vision");
      const out = await extractByVision(vision.file, {
        defaults: defaults(),
        from: vision.from,
        to: vision.to,
        signal: ac.signal,
        shouldStop: () => stopRef.current,
        onProgress: (p) =>
          setVision((v) =>
            v
              ? {
                  ...v,
                  progress: {
                    page: p.page,
                    done: p.pagesDone,
                    total: p.pagesTotal,
                    found: p.questionsFound,
                    stage: p.stage,
                    stageLabel: p.stageLabel,
                    stage1Done: p.stage1Done,
                    stage2Done: p.stage2Done,
                  },
                }
              : v,
          ),
      });
      let merged: Draft[] = [];
      setDrafts((current) => {
        merged = stampDraftModules(mergeDrafts(current ?? [], out.drafts), module);
        return merged;
      });
      const split = splitNote(merged);
      setNotes((current) => [...current, ...out.notes, ...(split ? [split] : [])]);
      await fetchExisting();
      if (out.drafts.length > 0) setStep("editor");
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setReadError((err as Error)?.message ?? "The scan couldn't be read.");
      }
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      stopRef.current = false;
      setVision((v) => (v ? { ...v, running: false } : v));
    }
  }

  function applyKey() {
    if (!drafts) return;
    const key = parseAnswerKey(keyText);
    const out = applyAnswerKey(drafts, key);
    setDrafts(out.drafts);
    setKeySummary(describeKey(key, out.filled, drafts, out.unmatched));
  }

  function setDraftAnswer(index: number, value: string) {
    setDrafts((current) =>
      current
        ? current.map((d, i) => (i === index ? { ...d, rec: { ...d.rec, correct: value } } : d))
        : current,
    );
  }

  function updateDraftRec(index: number, rec: Record<string, string>) {
    setDrafts((current) =>
      current ? current.map((d, i) => (i === index ? { ...d, rec, reviewed: false } : d)) : current,
    );
  }

  function setDraftReviewed(index: number, reviewed: boolean) {
    setDrafts((current) =>
      current ? current.map((d, i) => (i === index ? { ...d, reviewed } : d)) : current,
    );
  }

  function addDraftAfter(index: number) {
    setDrafts((current) => {
      const list = current ?? [];
      const max = list.reduce((m, d) => Math.max(m, d.number), 0);
      const neighbor = list[index];
      const page = neighbor?.sourcePage;
      const next = [...list];
      next.splice(
        index + 1,
        0,
        blankDraft(
          {
            ...defaults(),
            module: neighbor?.rec.module === "2" ? "2" : "1",
          },
          max + 1,
          page,
        ),
      );
      return next;
    });
  }

  function deleteDraft(index: number) {
    setDrafts((current) => (current ? current.filter((_, i) => i !== index) : current));
  }

  async function runAttachFigures(onlyIndex?: number) {
    const file = sourcePdf ?? vision?.file ?? null;
    if (!file || !drafts || attachingFigures || fixing || vision?.running) return;
    const targets =
      onlyIndex != null
        ? drafts[onlyIndex]
          ? [{ draftIndex: onlyIndex, draft: drafts[onlyIndex] }]
          : []
        : drafts
            .map((draft, draftIndex) => ({ draftIndex, draft }))
            .filter((t) => needsFigure(t.draft) && t.draft.sourcePage);
    if (targets.length === 0) return;

    stopRef.current = false;
    const ac = new AbortController();
    abortRef.current = ac;
    setAttachingFigures(true);
    setFigureProgress(null);
    setReadError(null);

    try {
      const { attachFiguresToDrafts } = await import("@/lib/import/attach-figures");
      const out = await attachFiguresToDrafts(file, drafts, targets, {
        signal: ac.signal,
        shouldStop: () => stopRef.current,
        onProgress: setFigureProgress,
      });
      setDrafts(out.drafts);
      setNotes((current) => [...current, ...out.notes]);
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setReadError((err as Error)?.message ?? "Figures could not be attached.");
      }
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      stopRef.current = false;
      setAttachingFigures(false);
      setFigureProgress(null);
    }
  }

  const previewRows = useMemo(() => {
    if (drafts) {
      const base = drafts.map((d) => {
        const r = validateRecord(d.rec, d.number);
        return { ...r, warnings: [...d.warnings, ...r.warnings] };
      });
      return flagDuplicates(base, existingKeys).map((row, i) => ({
        row,
        draftIndex: i as number | null,
      }));
    }
    return (parsed?.rows ?? []).map((row) => ({ row, draftIndex: null as number | null }));
  }, [drafts, parsed, existingKeys]);

  const stats = useMemo(() => {
    const rows = previewRows.map((p) => p.row);
    const valid = rows.filter((r) => r.question);
    const dupes = valid.filter((r) => r.duplicate);
    return {
      total: rows.length,
      valid: valid.length,
      invalid: rows.length - valid.length,
      warnings: valid.filter((r) => r.warnings.length > 0).length,
      duplicates: dupes.length,
      importable: skipDuplicates ? valid.length - dupes.length : valid.length,
    };
  }, [previewRows, skipDuplicates]);

  const figureCount = useMemo(
    () => (drafts ?? []).filter((d) => needsFigure(d) && d.sourcePage).length,
    [drafts],
  );

  async function runFixBroken() {
    if (!drafts || fixing) return;
    if (vision?.running) {
      setReadError("Wait for the page scan to finish (or stop it) before fixing rows.");
      return;
    }
    if (attachingFigures) {
      setReadError("Wait for figure attach to finish (or stop it) before fixing rows.");
      return;
    }
    const targets = previewRows
      .filter((p) => p.draftIndex != null && (!p.row.question || p.row.errors.length > 0))
      .map((p) => ({
        draftIndex: p.draftIndex!,
        draft: drafts[p.draftIndex!],
        errors: p.row.errors,
        warnings: p.row.warnings,
      }));
    if (targets.length === 0) {
      setReadError("No broken rows to fix.");
      return;
    }

    stopRef.current = false;
    const ac = new AbortController();
    abortRef.current = ac;
    setFixing(true);
    setFixProgress(null);
    setReadError(null);

    try {
      const { fixBrokenDrafts } = await import("@/lib/import/fix-broken");
      const out = await fixBrokenDrafts(drafts, targets, {
        signal: ac.signal,
        shouldStop: () => stopRef.current,
        onProgress: setFixProgress,
      });
      setDrafts(out.drafts);
      setNotes((current) => [...current, ...out.notes]);
      await fetchExisting();
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setReadError((err as Error)?.message ?? "Broken rows could not be fixed.");
      }
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      stopRef.current = false;
      setFixing(false);
      setFixProgress(null);
    }
  }

  async function runImport() {
    const tagged = previewRows
      .filter((p) => p.row.question && (!skipDuplicates || !p.row.duplicate))
      .map((p) => ({
        row: p.row,
        module:
          p.draftIndex != null && drafts?.[p.draftIndex]
            ? draftModule(drafts[p.draftIndex])
            : module === 2
              ? 2
              : 1,
      }));
    if (tagged.length === 0) return;

    setImporting(true);
    setResult(null);
    setProgress({ done: 0, total: tagged.length });

    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id ?? null;

    let inserted = 0;
    let failed = 0;
    const errors: string[] = [];
    const insertedItems: { id: string; module: 1 | 2 }[] = [];

    const payloadFor = (r: (typeof tagged)[number]["row"]) => ({
      ...r.question!,
      source_month: r.question!.source_month ?? month ?? null,
      source_year: r.question!.source_year ?? year ?? null,
      created_by: uid,
    });

    for (let i = 0; i < tagged.length; i += CHUNK) {
      const slice = tagged.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from("questions")
        .insert(slice.map((t) => payloadFor(t.row)))
        .select("id");
      if (error) {
        for (const t of slice) {
          const { data: one, error: e2 } = await supabase
            .from("questions")
            .insert(payloadFor(t.row))
            .select("id")
            .single();
          if (e2) {
            failed++;
            if (errors.length < 10) errors.push(`Row ${t.row.index}: ${e2.message}`);
          } else {
            inserted++;
            if (one?.id) insertedItems.push({ id: one.id as string, module: t.module });
          }
          setProgress((p) => ({ ...p, done: p.done + 1 }));
        }
      } else {
        inserted += slice.length;
        const ids = (data ?? []) as { id: string }[];
        for (let j = 0; j < ids.length; j++) {
          insertedItems.push({ id: ids[j].id, module: slice[j]?.module ?? 1 });
        }
        setProgress((p) => ({ ...p, done: p.done + slice.length }));
      }
    }

    let createdSet: string | undefined;
    if (makeSet && title.trim() && insertedItems.length > 0) {
      const base = title.trim();
      const createSet = async (label: string, mod: 1 | 2, ids: string[]) => {
        if (ids.length === 0) return null;
        const { data: t, error: te } = await supabase
          .from("tests")
          .insert({
            title: label,
            section,
            module: mod,
            difficulty,
            source_month: month,
            source_year: year,
            created_by: uid,
          })
          .select("id")
          .single();
        if (te) {
          errors.push(
            `The questions imported, but "${label}" couldn't be created: ${te.message}. Open Tests to build it by hand.`,
          );
          return null;
        }
        const { error: le } = await supabase.from("test_questions").insert(
          ids.map((qid, i) => ({
            test_id: t.id as string,
            question_id: qid,
            position: i + 1,
          })),
        );
        if (le) {
          errors.push(
            `"${label}" was created but its questions couldn't be linked: ${le.message}.`,
          );
          return null;
        }
        return label;
      };

      if (module === "both") {
        const names = (
          await Promise.all([
            createSet(
              moduleTitle(base, 1),
              1,
              insertedItems.filter((x) => x.module === 1).map((x) => x.id),
            ),
            createSet(
              moduleTitle(base, 2),
              2,
              insertedItems.filter((x) => x.module === 2).map((x) => x.id),
            ),
          ])
        ).filter((n): n is string => Boolean(n));
        createdSet = names.length ? names.join(" + ") : undefined;
      } else {
        createdSet =
          (await createSet(
            base,
            module,
            insertedItems.map((x) => x.id),
          )) ?? undefined;
      }
    }

    setImporting(false);
    setResult({ inserted, failed, errors, setTitle: createdSet });
    if (failed === 0 && errors.length === 0) {
      setText("");
      setKeyText("");
      setTitle("");
      clearExtracted();
      setFileName("");
      setStep("setup");
    }
  }

  const sourceLabel = formatSourceDate(month, year);

  function chooseSource(next: Mode) {
    if (next === mode) return;
    if (hasRows || vision) {
      const ok = window.confirm(
        "Switching source clears extracted questions on this page. Continue?",
      );
      if (!ok) return;
    }
    setMode(next);
    clearExtracted();
    setText("");
    setStep("extract");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            to="/admin/questions"
            className="group inline-flex items-center gap-2 text-xs font-bold text-brand-600 hover:text-brand-800"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
            Back to questions
          </Link>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-brand-900">Add a test</h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-600">
            One path from paper or paste → extract → editor → bank
            {makeSet ? " + test set" : ""}.
          </p>
        </div>
        {result?.setTitle && (
          <Link
            to="/admin/tests"
            className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Open Tests <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      <WizardSteps step={step} unlocked={unlocked} onStepClick={setStep} />

      {step === "setup" && (
        <div className="rise-in rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-panel md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-white">1 · Setup</h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-brand-100">
                Label the batch and optionally create a dated test set students can open in Practice
                — <strong className="text-white">{sourceLabel ?? "set a month and year"}</strong>.
                One file can cover both modules; that creates two sets.
              </p>
            </div>
            <label className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold text-brand-100">
              <input
                type="checkbox"
                checked={makeSet}
                onChange={(e) => setMakeSet(e.target.checked)}
                className="h-4 w-4 accent-brand-200 [color-scheme:dark]"
              />
              Create a test set
            </label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Test name">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="June 2025 · Reading & Writing"
                disabled={!makeSet}
                className={CONTROL_CLASS + " disabled:opacity-40"}
              />
            </Field>
            <Field label="Source date">
              <div className="flex gap-1">
                <select
                  value={month ?? ""}
                  onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : null)}
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
                  value={year ?? ""}
                  onChange={(e) => setYear(e.target.value ? Number(e.target.value) : null)}
                  placeholder="Year"
                  className={CONTROL_CLASS + " w-24 px-2"}
                />
              </div>
            </Field>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
            <Field label="Section">
              <select
                value={section}
                onChange={(e) => setSection(e.target.value as Section)}
                className={CONTROL_CLASS}
              >
                <option value="reading_writing">Reading &amp; Writing</option>
                <option value="math">Math</option>
              </select>
            </Field>
            <Field label="Module">
              <select
                value={module === "both" ? "both" : String(module)}
                onChange={(e) => {
                  const v = e.target.value;
                  setModuleChoice(v === "both" ? "both" : (Number(v) as 1 | 2));
                }}
                disabled={!makeSet}
                className={CONTROL_CLASS + " disabled:opacity-40"}
              >
                <option value="1">Module 1</option>
                <option value="2">Module 2</option>
                <option value="both">Both modules (one file)</option>
              </select>
            </Field>
            <Field label="Difficulty">
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as LetterDifficulty)}
                className={CONTROL_CLASS}
              >
                {LETTER_DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {module === "both" && makeSet && (
            <p className="mt-2 text-[11px] leading-relaxed text-brand-100">
              Numbering that restarts (or a full 27+27 / 22+22 paper) is split into two practice
              sets. You can fix a question&apos;s module in the editor.
            </p>
          )}

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => setStep("source")}
              className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {step === "source" && (
        <div className="rise-in space-y-4">
          <div className="rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-panel md:p-6">
            <h2 className="text-sm font-bold text-white">2 · Choose a source</h2>
            <p className="mt-1 text-xs text-brand-100">
              Pick how questions enter the pipeline. You can change this later (it clears extract
              results).
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <SourceCard
                active={mode === "upload"}
                icon={<FileText className="h-5 w-5" />}
                title="Exam paper"
                body="DOCX, PDF, or text. Scans use Gemini extract + recheck."
                onClick={() => chooseSource("upload")}
              />
              <SourceCard
                active={mode === "sheet"}
                icon={<Table2 className="h-5 w-5" />}
                title="Spreadsheet"
                body="Paste TSV/CSV with headers matching the bank columns."
                onClick={() => chooseSource("sheet")}
              />
              <SourceCard
                active={mode === "json"}
                icon={<Braces className="h-5 w-5" />}
                title="JSON"
                body="Paste an array of question objects from an external model."
                onClick={() => chooseSource("json")}
              />
            </div>
            <div className="mt-5 flex flex-wrap justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep("setup")}
                className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-400/50 bg-brand-800 px-4 py-2 text-sm font-semibold text-white"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button
                type="button"
                onClick={() => setStep("extract")}
                className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white"
              >
                Continue to extract <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "extract" && (
        <div className="rise-in space-y-4">
          <div className="rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-panel md:p-6">
            <h2 className="text-sm font-bold text-white">3 · Extract</h2>
            <p className="mt-1 text-xs text-brand-100">
              {mode === "upload"
                ? "Upload the paper. Text PDFs parse locally; scans open the Gemini reader."
                : mode === "sheet"
                  ? "Paste the sheet, then Check to validate rows."
                  : "Paste JSON, then Check to validate rows."}
            </p>

            {mode === "upload" && (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-brand-100">
                  Numbered paragraphs become questions;{" "}
                  <code className="text-white">A) B) C) D)</code> become choices.
                </p>
                <input
                  ref={docRef}
                  type="file"
                  accept=".docx,.pdf,.txt,.md"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void loadDocument(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => docRef.current?.click()}
                  disabled={reading != null || vision?.running || fixing}
                  className="tap flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-brand-300/50 bg-brand-800 px-4 py-10 text-sm font-semibold text-brand-100 transition hover:border-brand-200 hover:text-white disabled:opacity-40"
                >
                  {reading ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin text-brand-200" />
                      {reading}
                    </>
                  ) : (
                    <>
                      <FileUp className="h-6 w-6 text-brand-200" />
                      Drop or choose a .docx / .pdf / .txt
                      {fileName ? (
                        <span className="text-xs font-normal text-brand-200">
                          Current: {fileName}
                        </span>
                      ) : null}
                    </>
                  )}
                </button>
                {vision && (
                  <VisionPanel
                    state={vision}
                    onChange={(patch) => setVision({ ...vision, ...patch })}
                    onStart={() => void runVision()}
                    onStop={() => {
                      stopRef.current = true;
                      abortRef.current?.abort();
                    }}
                  />
                )}
              </div>
            )}

            {mode !== "upload" && (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-brand-100">
                    {mode === "sheet" ? "TSV / CSV paste" : "JSON array paste"}
                  </span>
                  <div className="flex gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept={mode === "json" ? ".json,application/json" : ".tsv,.csv,.txt"}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) loadSheetFile(f);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="tap inline-flex items-center gap-1 rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      <FileUp className="h-3.5 w-3.5" /> File
                    </button>
                    <button
                      type="button"
                      onClick={() => setText(mode === "sheet" ? TSV_TEMPLATE : JSON_TEMPLATE)}
                      className="tap inline-flex items-center gap-1 rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      <ClipboardPaste className="h-3.5 w-3.5" /> Template
                    </button>
                  </div>
                </div>
                {mode === "sheet" && (
                  <p className="text-[11px] text-brand-200">Columns: {TSV_COLUMNS.join(", ")}</p>
                )}
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={12}
                  spellCheck={false}
                  className={CONTROL_CLASS + " resize-y font-mono text-xs leading-relaxed"}
                  placeholder={mode === "sheet" ? TSV_TEMPLATE : JSON_TEMPLATE}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void checkPaste()}
                    disabled={!text.trim() || checking}
                    className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {checking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Check &amp; continue
                  </button>
                </div>
                <CopyBox text={mode === "sheet" ? TSV_TEMPLATE : JSON_TEMPLATE} />
              </div>
            )}

            {(readError || parsed?.fatal) && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-brand-900 px-3 py-2 text-xs font-semibold text-white ring-1 ring-brand-300/60">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-200" />
                {readError ?? parsed?.fatal}
              </div>
            )}

            {notes.length > 0 && (
              <ul className="mt-3 space-y-1 rounded-xl border border-brand-400/40 bg-brand-800 p-3 text-xs text-brand-100">
                {notes.map((n, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-200" />
                    {n}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5 flex flex-wrap justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep("source")}
                className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-400/50 bg-brand-800 px-4 py-2 text-sm font-semibold text-white"
              >
                <ArrowLeft className="h-4 w-4" /> Source
              </button>
              {hasRows && (
                <button
                  type="button"
                  onClick={() => setStep("editor")}
                  className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white"
                >
                  Editor <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {step === "editor" && (
        <div className="rise-in space-y-4">
          {parsed?.fatal && (
            <div className="rounded-2xl border border-brand-300/60 bg-brand-900 p-5 text-sm font-semibold text-white">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-200" />
                <span>{parsed.fatal}</span>
              </div>
            </div>
          )}

          {drafts && (
            <div className="rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-panel md:p-6">
              <h2 className="text-sm font-bold text-white">4 · Editor</h2>
              <p className="mt-1 text-xs text-brand-100">
                Paste an answer key if you have one
                {module === "both" ? " as Module 1 / Module 2" : ""}, then check each question
                against the page.
              </p>
              <div className="mt-4">
                <AnswerKeyBox
                  value={keyText}
                  onChange={setKeyText}
                  onApply={applyKey}
                  summary={keySummary}
                  bothModules={module === "both"}
                />
              </div>
              {(readError || parsed?.fatal) && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-brand-900 px-3 py-2 text-xs font-semibold text-white ring-1 ring-brand-300/60">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-200" />
                  {readError ?? parsed?.fatal}
                </div>
              )}
              {notes.length > 0 && (
                <ul className="mt-3 space-y-1 rounded-xl border border-brand-400/40 bg-brand-800 p-3 text-xs text-brand-100">
                  {notes.map((n, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-200" />
                      {n}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {previewRows.length > 0 ? (
            <PreviewPanel
              rows={previewRows}
              ignoredColumns={parsed?.ignoredColumns ?? []}
              stats={stats}
              skipDuplicates={skipDuplicates}
              setSkipDuplicates={setSkipDuplicates}
              importing={importing}
              progress={progress}
              onImport={() => void runImport()}
              onAnswerChange={drafts ? setDraftAnswer : undefined}
              onChangeDraft={drafts ? updateDraftRec : undefined}
              onSetReviewed={drafts ? setDraftReviewed : undefined}
              drafts={drafts}
              sourcePdf={sourcePdf ?? vision?.file ?? null}
              setLabel={
                makeSet && title.trim()
                  ? module === "both"
                    ? `${title.trim()} · Modules 1–2`
                    : title.trim()
                  : null
              }
              showModule={module === "both"}
              fixing={fixing}
              fixProgress={fixProgress}
              onFixBroken={drafts ? () => void runFixBroken() : undefined}
              onStopFix={() => {
                stopRef.current = true;
                abortRef.current?.abort();
              }}
              onAddAfter={addDraftAfter}
              onDeleteDraft={deleteDraft}
              onAttachFigure={(i) => void runAttachFigures(i)}
              onAttachFigures={
                figureCount > 0 && (sourcePdf || vision?.file)
                  ? () => void runAttachFigures()
                  : undefined
              }
              onStopFigures={() => {
                stopRef.current = true;
                abortRef.current?.abort();
              }}
              attachingFigures={attachingFigures}
              figureCount={figureCount}
              figureProgress={figureProgress}
              visionRunning={Boolean(vision?.running)}
            />
          ) : (
            <div className="rounded-2xl border border-brand-400/40 bg-brand-600 p-5 text-sm text-brand-100">
              <p>No questions yet. Add one here, or go back to Extract.</p>
              <button
                type="button"
                onClick={() => {
                  commitDrafts([blankDraft(defaults(), 1)]);
                }}
                className="btn-brand mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" /> Add question
              </button>
            </div>
          )}

          {result && (
            <div className="rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-panel">
              <div className="flex items-center gap-2.5">
                {result.failed === 0 && result.errors.length === 0 ? (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-400">
                    <Check className="h-4 w-4 text-white" />
                  </span>
                ) : (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-900">
                    <AlertTriangle className="h-4 w-4 text-brand-200" />
                  </span>
                )}
                <div>
                  <div className="text-sm font-bold text-white">
                    {result.inserted} question{result.inserted === 1 ? "" : "s"} imported
                    {result.setTitle ? ` · set “${result.setTitle}”` : ""}
                  </div>
                  {result.failed > 0 && (
                    <div className="text-xs text-brand-100">{result.failed} failed</div>
                  )}
                </div>
              </div>
              {result.errors.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-brand-100">
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
              {result.setTitle && (
                <Link
                  to="/admin/tests"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-brand-200 hover:text-white"
                >
                  Manage the set in Tests <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setStep("setup");
                }}
                className="mt-4 flex items-center gap-1 text-xs font-semibold text-brand-100 hover:text-white"
              >
                <X className="h-3.5 w-3.5" /> Start another test
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setStep("extract")}
            className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-400/40 bg-white px-4 py-2 text-sm font-semibold text-brand-800"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>
      )}
    </div>
  );
}

function SourceCard({
  active,
  icon,
  title,
  body,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "tap flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors " +
        (active
          ? "border-brand-200 bg-brand-500 text-white shadow-brand"
          : "border-brand-400/40 bg-brand-800 text-brand-100 hover:border-brand-200 hover:text-white")
      }
    >
      <span className={active ? "text-brand-200" : "text-brand-200"}>{icon}</span>
      <span className="text-sm font-bold text-white">{title}</span>
      <span className="text-[11px] leading-relaxed opacity-90">{body}</span>
    </button>
  );
}
