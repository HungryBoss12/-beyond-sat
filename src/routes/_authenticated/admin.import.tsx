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
  type RowResult,
} from "@/lib/question-import";
import { readDocx } from "@/lib/import/docx";
import { blocksToDrafts, type Draft, type ParseDefaults } from "@/lib/import/parse";
import { parseAnswerKey, applyAnswerKey, describeKey } from "@/lib/import/answer-key";
import {
  SECTION_LABEL,
  difficultyColor,
  skillsFor,
  RW_SKILLS,
  MATH_SKILLS,
  MONTHS,
  LETTER_DIFFICULTIES,
  formatSourceDate,
  type Section,
  type LetterDifficulty,
} from "@/lib/sat";
import { MathText } from "@/components/MathText";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ClipboardPaste,
  Copy,
  FileUp,
  Loader2,
  Table2,
  Braces,
  Upload,
  X,
  FileText,
  ScanEye,
  Square,
  KeyRound,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/import")({
  component: AdminImport,
  head: () => ({ meta: [{ title: "Import questions — BeyondSAT" }] }),
});

type Mode = "upload" | "sheet" | "json";

const CONTROL_CLASS =
  "w-full rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2 text-sm text-white [color-scheme:dark] placeholder:text-brand-200 focus:border-brand-200 focus:outline-none";

/** Rows per insert request. Keeps the payload well under any body limit. */
const CHUNK = 100;

/**
 * A row in the preview, plus the draft it came from.
 *
 * `draftIndex` is what makes the per-row answer selector possible: the paste
 * paths have no editable source (the textarea *is* the source), but a document
 * import's drafts live in state, so a row can write back into the exact draft it
 * was validated from.
 */
type PreviewRow = { row: RowResult; draftIndex: number | null };

/** What the vision run is doing, so the panel can show it without a second state. */
type VisionState = {
  file: File;
  pages: number;
  from: number;
  to: number;
  running: boolean;
  progress: { page: number; done: number; total: number; found: number } | null;
};

function AdminImport() {
  const [mode, setMode] = useState<Mode>("upload");

  // --- test-set header -----------------------------------------------------
  const [makeSet, setMakeSet] = useState(true);
  const [title, setTitle] = useState("");
  const [section, setSection] = useState<Section>("reading_writing");
  const [module, setModule] = useState<1 | 2>(1);
  const [difficulty, setDifficulty] = useState<LetterDifficulty>("C");
  const [skill, setSkill] = useState<string>(RW_SKILLS[0]);
  const [month, setMonth] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(new Date().getFullYear());

  // --- paste paths ---------------------------------------------------------
  const [text, setText] = useState("");
  const [checking, setChecking] = useState(false);
  const [parsed, setParsed] = useState<ParseResult | null>(null);

  // --- document path -------------------------------------------------------
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [vision, setVision] = useState<VisionState | null>(null);
  const stopRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // --- answer key ----------------------------------------------------------
  const [keyText, setKeyText] = useState("");
  const [keySummary, setKeySummary] = useState<string | null>(null);

  // --- shared --------------------------------------------------------------
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

  /* An in-flight vision run outliving the screen would keep firing requests at
     the model with nothing left to render them into. */
  useEffect(
    () => () => {
      stopRef.current = true;
      abortRef.current?.abort();
    },
    [],
  );

  /* Only the columns needed for the dedupe key. `select("*")` would 403 here:
     the answer-key columns are revoked at column level. */
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

  function resetOutput() {
    setParsed(null);
    setDrafts(null);
    setNotes([]);
    setReadError(null);
    setResult(null);
    setKeySummary(null);
    setVision(null);
  }

  function defaults(): ParseDefaults {
    return {
      section,
      skill,
      difficulty,
      source_month: month ? String(month) : "",
      source_year: year ? String(year) : "",
    };
  }

  // -------------------------------------------------------------------------
  // Paste paths
  // -------------------------------------------------------------------------

  /* Parsing is synchronous, but the existing-question fetch for duplicate
     detection isn't — so "Check" is async and the button shows a spinner. */
  async function check() {
    setChecking(true);
    setResult(null);
    setDrafts(null);
    const base = mode === "sheet" ? parseDelimited(text) : parseJson(text);
    if (base.fatal) {
      setParsed(base);
      setChecking(false);
      return;
    }
    const keys = await fetchExisting();
    setParsed({ ...base, rows: flagDuplicates(base.rows, keys) });
    setChecking(false);
  }

  function loadFile(f: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result ?? ""));
      resetOutput();
      /* Switch tab to match what was dropped, so a .json file doesn't get
         handed to the spreadsheet parser. */
      if (/\.json$/i.test(f.name)) setMode("json");
      else if (/\.(tsv|csv|txt)$/i.test(f.name)) setMode("sheet");
    };
    reader.readAsText(f);
  }

  // -------------------------------------------------------------------------
  // Document path
  // -------------------------------------------------------------------------

  async function loadDocument(f: File) {
    resetOutput();
    setFileName(f.name);
    setKeyText("");

    try {
      if (/\.docx$/i.test(f.name)) {
        setReading("Reading the document…");
        const blocks = await readDocx(f);
        finishDocument(blocks);
        return;
      }

      if (/\.pdf$/i.test(f.name)) {
        setReading("Looking for a text layer…");
        /* Loaded on demand rather than imported at the top: pdfjs-dist is ~1 MB
           and only this branch needs it, so the admin screen doesn't carry it. */
        const { readPdfText } = await import("@/lib/import/pdf");
        const out = await readPdfText(f, (p, t) => setReading(`Reading page ${p} of ${t}…`));
        if (out.scanned) {
          /* No usable text layer: this is a photocopy. Hand it to the vision
             panel rather than producing 108 pages of empty blocks. */
          setReading(null);
          setNotes([
            `This PDF has no text layer — it's a scan of ${out.pages} page${out.pages === 1 ? "" : "s"}. Reading it needs Beyond AI, one page at a time.`,
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
        finishDocument(out.blocks, [`Read the text layer of ${out.pages} page(s) — no AI needed.`]);
        return;
      }

      /* Plain text and markdown: blank lines are the paragraph boundaries, which
         is the same shape `blocksToDrafts` gets from a .docx. */
      if (/\.(txt|md)$/i.test(f.name)) {
        setReading("Reading the document…");
        const raw = await f.text();
        finishDocument(
          raw
            .replace(/\r\n?/g, "\n")
            .split(/\n\s*\n/)
            .map((b) => b.trim())
            .filter(Boolean),
        );
        return;
      }

      setReadError(
        `"${f.name}" isn't a format this can read. Upload a .docx, a .pdf, or a .txt — or use the Spreadsheet or JSON tab.`,
      );
    } catch (err) {
      setReadError((err as Error)?.message ?? "That file couldn't be read.");
    } finally {
      setReading(null);
    }
  }

  async function finishDocument(blocks: string[], extraNotes: string[] = []) {
    const out = blocksToDrafts(blocks, defaults());
    setDrafts(out.drafts);
    setNotes([...extraNotes, ...out.notes]);
    if (out.drafts.length > 0) await fetchExisting();
  }

  async function runVision() {
    if (!vision) return;
    stopRef.current = false;
    abortRef.current = new AbortController();
    setVision({ ...vision, running: true, progress: null });
    setReadError(null);

    try {
      const { extractByVision } = await import("@/lib/import/vision");
      const out = await extractByVision(vision.file, {
        defaults: defaults(),
        from: vision.from,
        to: vision.to,
        signal: abortRef.current.signal,
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
                  },
                }
              : v,
          ),
      });
      /* Appended, not replaced: a 108-page scan is read in batches, and the
         second batch must not throw away the first. */
      setDrafts((current) => mergeDrafts(current ?? [], out.drafts));
      setNotes((current) => [...current, ...out.notes]);
      await fetchExisting();
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setReadError((err as Error)?.message ?? "The scan couldn't be read.");
      }
    } finally {
      abortRef.current = null;
      setVision((v) => (v ? { ...v, running: false } : v));
    }
  }

  function applyKey() {
    if (!drafts) return;
    const key = parseAnswerKey(keyText);
    const out = applyAnswerKey(drafts, key);
    setDrafts(out.drafts);
    setKeySummary(describeKey(key, out.filled, drafts.length, out.unmatched));
  }

  function setDraftAnswer(index: number, value: string) {
    setDrafts((current) =>
      current
        ? current.map((d, i) => (i === index ? { ...d, rec: { ...d.rec, correct: value } } : d))
        : current,
    );
  }

  // -------------------------------------------------------------------------
  // Preview rows — one shape, whichever path produced them
  // -------------------------------------------------------------------------

  const previewRows = useMemo<PreviewRow[]>(() => {
    if (drafts) {
      /* Validated from scratch on every render, so a row can never hold a stale
         error after the answer key or a per-row selector changes it. The
         document's own question number is used as the row index — that is what
         an answer key refers to and what the editor is looking at on paper. */
      const base = drafts.map((d) => {
        const r = validateRecord(d.rec, d.number);
        return { ...r, warnings: [...d.warnings, ...r.warnings] };
      });
      return flagDuplicates(base, existingKeys).map((row, i) => ({ row, draftIndex: i }));
    }
    return (parsed?.rows ?? []).map((row) => ({ row, draftIndex: null }));
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

  // -------------------------------------------------------------------------
  // Import
  // -------------------------------------------------------------------------

  async function runImport() {
    const rows = previewRows
      .map((p) => p.row)
      .filter((r) => r.question && (!skipDuplicates || !r.duplicate)) as (RowResult & {
      question: NonNullable<RowResult["question"]>;
    })[];
    if (rows.length === 0) return;

    setImporting(true);
    setResult(null);
    setProgress({ done: 0, total: rows.length });

    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id ?? null;

    let inserted = 0;
    let failed = 0;
    const errors: string[] = [];
    /* Collected in document order so `test_questions.position` reproduces the
       paper. A row that failed simply isn't in the list, so the set has no gap. */
    const insertedIds: string[] = [];

    const payloadFor = (r: (typeof rows)[number]) => ({
      ...r.question,
      /* The header date is a fallback, not an override: a spreadsheet that
         carries its own source date per row keeps it. */
      source_month: r.question.source_month ?? month ?? null,
      source_year: r.question.source_year ?? year ?? null,
      created_by: uid,
    });

    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from("questions")
        .insert(slice.map(payloadFor))
        .select("id");
      if (error) {
        /* One bad row rejects its whole chunk, so fall back to row-by-row for
           this chunk to salvage the good ones and name the ones that failed. */
        for (const r of slice) {
          const { data: one, error: e2 } = await supabase
            .from("questions")
            .insert(payloadFor(r))
            .select("id")
            .single();
          if (e2) {
            failed++;
            if (errors.length < 10) errors.push(`Row ${r.index}: ${e2.message}`);
          } else {
            inserted++;
            if (one?.id) insertedIds.push(one.id as string);
          }
          setProgress((p) => ({ ...p, done: p.done + 1 }));
        }
      } else {
        inserted += slice.length;
        for (const row of (data ?? []) as { id: string }[]) insertedIds.push(row.id);
        setProgress((p) => ({ ...p, done: p.done + slice.length }));
      }
    }

    let createdSet: string | undefined;
    if (makeSet && title.trim() && insertedIds.length > 0) {
      const { data: t, error: te } = await supabase
        .from("tests")
        .insert({
          title: title.trim(),
          section,
          module,
          difficulty,
          source_month: month,
          source_year: year,
          created_by: uid,
        })
        .select("id")
        .single();
      if (te) {
        errors.push(
          `The questions imported, but the test set couldn't be created: ${te.message}. Build it by hand in Tests.`,
        );
      } else {
        const { error: le } = await supabase.from("test_questions").insert(
          insertedIds.map((qid, i) => ({
            test_id: t.id as string,
            question_id: qid,
            position: i + 1,
          })),
        );
        if (le) {
          errors.push(
            `The test set was created but its questions couldn't be linked: ${le.message}.`,
          );
        } else {
          createdSet = title.trim();
        }
      }
    }

    setImporting(false);
    setResult({ inserted, failed, errors, setTitle: createdSet });
    if (failed === 0 && errors.length === 0) {
      /* A clean run has nothing left to act on — clear the input so the same
         batch can't be imported twice by pressing the button again. */
      setText("");
      setKeyText("");
      setTitle("");
      resetOutput();
      setFileName("");
    }
  }

  const skills = skillsFor(section);
  const sourceLabel = formatSourceDate(month, year);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/admin/questions"
          className="group inline-flex items-center gap-2 text-xs font-bold text-brand-600 hover:text-brand-800"
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
          Back to questions
        </Link>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Test set header                                                   */}
      {/* ---------------------------------------------------------------- */}
      <div className="rise-in rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-panel md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">Name and date this test</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-brand-100">
              These settings label every question in the upload and, if you leave the box ticked,
              group them into one test set. Students pick sets by date on the practice screen —{" "}
              <strong className="text-white">{sourceLabel ?? "set a month and year"}</strong>.
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

        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Section">
            <select
              value={section}
              onChange={(e) => {
                const s = e.target.value as Section;
                setSection(s);
                setSkill(skillsFor(s)[0]);
              }}
              className={CONTROL_CLASS}
            >
              <option value="reading_writing">Reading &amp; Writing</option>
              <option value="math">Math</option>
            </select>
          </Field>
          <Field label="Module">
            <select
              value={module}
              onChange={(e) => setModule(Number(e.target.value) as 1 | 2)}
              disabled={!makeSet}
              className={CONTROL_CLASS + " disabled:opacity-40"}
            >
              <option value={1}>Module 1</option>
              <option value={2}>Module 2</option>
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
          <Field label="Default skill">
            <select
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              className={CONTROL_CLASS}
            >
              {skills.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-brand-200">
          Reading &amp; Writing skills are read from each question's wording where the phrasing
          makes it clear; the default is used for the rest, and for every Math question. Fix any row
          afterwards in the question bank.
        </p>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Source tabs                                                       */}
      {/* ---------------------------------------------------------------- */}
      <div className="rise-in overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 shadow-panel">
        <div className="flex border-b border-brand-400/30">
          <TabButton
            active={mode === "upload"}
            onClick={() => {
              setMode("upload");
              resetOutput();
            }}
            icon={<FileText className="h-4 w-4" />}
            label="Upload a paper"
          />
          <TabButton
            active={mode === "sheet"}
            onClick={() => {
              setMode("sheet");
              resetOutput();
            }}
            icon={<Table2 className="h-4 w-4" />}
            label="Spreadsheet"
          />
          <TabButton
            active={mode === "json"}
            onClick={() => {
              setMode("json");
              resetOutput();
            }}
            icon={<Braces className="h-4 w-4" />}
            label="JSON"
          />
        </div>

        <div className="space-y-4 p-5 md:p-6">
          {mode === "upload" ? (
            <>
              <p className="text-sm text-brand-100">
                Upload the exam paper itself — a <strong className="text-white">.docx</strong>, a{" "}
                <strong className="text-white">.pdf</strong>, or plain text. Questions are read
                straight out of the file: a numbered paragraph starts a question, the{" "}
                <code className="text-white">A) B) C) D)</code> line becomes its choices, and
                everything above the stem becomes the passage. A scanned PDF with no text in it is
                read by Beyond AI instead, one page at a time.
              </p>

              <input
                ref={docRef}
                type="file"
                accept=".docx,.pdf,.txt,.md"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) loadDocument(f);
                  e.target.value = "";
                }}
              />
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) loadDocument(f);
                }}
                className="rounded-xl border border-dashed border-brand-400/60 bg-brand-800/50 px-4 py-8 text-center"
              >
                <FileUp className="mx-auto h-7 w-7 text-brand-200" />
                <div className="mt-2 text-sm font-semibold text-white">
                  {fileName || "Drop a paper here"}
                </div>
                <button
                  onClick={() => docRef.current?.click()}
                  disabled={reading != null || vision?.running}
                  className="btn-brand mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {reading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileUp className="h-4 w-4" />
                  )}
                  {reading ?? "Choose a file"}
                </button>
                <p className="mt-2 text-[11px] text-brand-200">.docx · .pdf · .txt · .md</p>
              </div>

              {readError && (
                <div className="rounded-lg bg-brand-900 px-3 py-2 text-xs font-semibold text-white ring-1 ring-brand-300/60">
                  {readError}
                </div>
              )}

              {vision && (
                <VisionPanel
                  state={vision}
                  onChange={(patch) => setVision({ ...vision, ...patch })}
                  onStart={runVision}
                  onStop={() => {
                    stopRef.current = true;
                    abortRef.current?.abort();
                  }}
                />
              )}

              {drafts && drafts.length > 0 && (
                <AnswerKeyBox
                  value={keyText}
                  onChange={setKeyText}
                  onApply={applyKey}
                  summary={keySummary}
                />
              )}
            </>
          ) : mode === "sheet" ? (
            <p className="text-sm text-brand-100">
              Select your rows in Google Sheets or Excel —{" "}
              <strong className="text-white">including the header row</strong> — and paste them
              below. Tabs separate columns, so commas inside a question are fine. Comma-separated
              text works too.
            </p>
          ) : (
            <p className="text-sm text-brand-100">
              Paste a JSON array of question objects. Best for output from an AI model, since
              passages, commas and LaTeX backslashes survive without escaping problems.
            </p>
          )}

          {mode !== "upload" && (
            <>
              <details className="rounded-xl border border-brand-400/40 bg-brand-800/60 px-4 py-3">
                <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-brand-100">
                  Format &amp; example
                </summary>
                <div className="mt-3 space-y-3">
                  {mode === "sheet" && (
                    <div className="text-xs text-brand-100">
                      <div className="font-bold uppercase tracking-wider text-brand-200">
                        Columns
                      </div>
                      <p className="mt-1 leading-relaxed">{TSV_COLUMNS.join(" · ")}</p>
                      <p className="mt-2 leading-relaxed">
                        Only <strong className="text-white">section</strong>,{" "}
                        <strong className="text-white">skill</strong>,{" "}
                        <strong className="text-white">question_text</strong> and{" "}
                        <strong className="text-white">correct</strong> are required. Column order
                        doesn't matter — the header row is read. Unknown columns are ignored, and{" "}
                        <code className="text-white">kind</code> is inferred from whether you filled
                        in choices.
                      </p>
                    </div>
                  )}
                  <CopyBox text={mode === "sheet" ? TSV_TEMPLATE : JSON_TEMPLATE} />
                  <div className="text-xs text-brand-100">
                    <div className="font-bold uppercase tracking-wider text-brand-200">
                      Valid values
                    </div>
                    <ul className="mt-1 space-y-0.5 leading-relaxed">
                      <li>
                        <code className="text-white">section</code>: math · reading_writing
                      </li>
                      <li>
                        <code className="text-white">difficulty</code>: C · B · D · A · S (S
                        hardest), or easy/medium/hard
                      </li>
                      <li>
                        <code className="text-white">kind</code>: multiple_choice · grid_in
                      </li>
                      <li>
                        <code className="text-white">skill</code> (math): {MATH_SKILLS.join(" · ")}
                      </li>
                      <li>
                        <code className="text-white">skill</code> (R&amp;W): {RW_SKILLS.join(" · ")}
                      </li>
                      <li>
                        <code className="text-white">correct</code>: a letter (B), a number (2), or
                        the exact choice text. For grid-ins, comma-separate every accepted form.
                      </li>
                    </ul>
                    <p className="mt-2 leading-relaxed">
                      Math goes in as LaTeX between dollar signs —{" "}
                      <code className="text-white">$3x + 5 = 20$</code> inline,{" "}
                      <code className="text-white">$$…$$</code> on its own line. Images can't be
                      uploaded here; put an already-hosted URL in{" "}
                      <code className="text-white">image_url</code>, or add the image afterwards by
                      editing the question.
                    </p>
                  </div>
                </div>
              </details>

              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  resetOutput();
                }}
                rows={12}
                spellCheck={false}
                placeholder={
                  mode === "sheet"
                    ? "section\tskill\tdifficulty\tquestion_text\tA\tB\tC\tD\tcorrect\nmath\tAlgebra\tB\tIf $3x + 5 = 20$…\t3\t5\t15\t25\tB"
                    : '[\n  { "section": "math", "skill": "Algebra", "question_text": "…", "choices": ["3","5","15","25"], "correct": "B" }\n]'
                }
                className={
                  CONTROL_CLASS + " min-h-[220px] resize-y font-mono text-xs leading-relaxed"
                }
              />

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={check}
                  disabled={!text.trim() || checking}
                  className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {checking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ClipboardPaste className="h-4 w-4" />
                  )}
                  {checking ? "Checking…" : "Check"}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".tsv,.csv,.txt,.json,text/plain,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) loadFile(f);
                    e.target.value = "";
                  }}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-400/50 bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-400"
                >
                  <FileUp className="h-4 w-4" /> Load a file
                </button>
                {text && (
                  <button
                    onClick={() => {
                      setText("");
                      resetOutput();
                    }}
                    className="tap rounded-lg px-3 py-2 text-sm font-semibold text-brand-100 hover:bg-brand-800 hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {notes.length > 0 && (
        <ul className="pop-in space-y-1 rounded-2xl border border-brand-400/40 bg-brand-800 p-4 text-xs text-brand-100">
          {notes.map((n, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-200" />
              {n}
            </li>
          ))}
        </ul>
      )}

      {parsed?.fatal && (
        <div className="pop-in rounded-2xl border border-brand-300/60 bg-brand-900 p-5 text-sm font-semibold text-white">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-200" />
            <span>{parsed.fatal}</span>
          </div>
        </div>
      )}

      {previewRows.length > 0 && (
        <PreviewPanel
          rows={previewRows}
          ignoredColumns={parsed?.ignoredColumns ?? []}
          stats={stats}
          skipDuplicates={skipDuplicates}
          setSkipDuplicates={setSkipDuplicates}
          importing={importing}
          progress={progress}
          onImport={runImport}
          onAnswerChange={drafts ? setDraftAnswer : undefined}
          drafts={drafts}
          setLabel={makeSet && title.trim() ? title.trim() : null}
        />
      )}

      {result && (
        <div className="pop-in rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-panel">
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
                {result.failed > 0 ? `, ${result.failed} failed` : ""}
                {result.setTitle ? ` into "${result.setTitle}"` : ""}
              </div>
              <Link
                to="/admin/questions"
                className="text-xs font-semibold text-brand-100 underline decoration-brand-300 underline-offset-2 hover:text-white"
              >
                View them in the question bank
              </Link>
            </div>
          </div>
          {result.errors.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-brand-400/30 pt-3 text-xs text-brand-100">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Merge a fresh batch of vision drafts into what's already on screen.
 *
 * Existing rows win on a number collision: the editor may already have fixed an
 * answer on one, and re-reading a page they'd previously imported should not
 * quietly discard that work.
 */
function mergeDrafts(existing: Draft[], incoming: Draft[]): Draft[] {
  const have = new Set(existing.map((d) => d.number));
  return [...existing, ...incoming.filter((d) => !have.has(d.number))].sort(
    (a, b) => a.number - b.number,
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

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "relative inline-flex flex-1 items-center justify-center gap-2 px-4 py-3.5 text-sm font-bold transition-colors " +
        (active ? "bg-brand-500 text-white" : "text-brand-100 hover:bg-brand-800 hover:text-white")
      }
    >
      {icon}
      {label}
      {active && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand-200" />}
    </button>
  );
}

/**
 * The scanned-PDF panel.
 *
 * The page range is front and centre rather than hidden behind an "advanced"
 * toggle, because running all 108 pages of a scan through a free-tier vision
 * model is the wrong default in every case: it rate-limits, it takes an hour, and
 * the editor can't see whether the extraction is any good until it's over. Ten
 * pages, check the preview, then continue.
 */
function VisionPanel({
  state,
  onChange,
  onStart,
  onStop,
}: {
  state: VisionState;
  onChange: (patch: Partial<VisionState>) => void;
  onStart: () => void;
  onStop: () => void;
}) {
  const p = state.progress;
  const pct = p && p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;

  return (
    <div className="space-y-3 rounded-xl border border-brand-400/40 bg-brand-800 p-4">
      <div className="flex items-start gap-2.5">
        <ScanEye className="mt-0.5 h-4 w-4 shrink-0 text-brand-200" />
        <div className="text-xs leading-relaxed text-brand-100">
          <strong className="text-white">This is a scan.</strong> There's no text in the file, so
          each page is sent to Beyond AI as an image and read back. That takes a few seconds a page
          and can misread a figure — check every row in the preview before importing. Run a small
          range first.
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="From page">
          <input
            type="number"
            min={1}
            max={state.pages}
            value={state.from}
            disabled={state.running}
            onChange={(e) => onChange({ from: Math.max(1, Number(e.target.value) || 1) })}
            className={CONTROL_CLASS + " w-24 disabled:opacity-40"}
          />
        </Field>
        <Field label="To page">
          <input
            type="number"
            min={1}
            max={state.pages}
            value={state.to}
            disabled={state.running}
            onChange={(e) =>
              onChange({ to: Math.min(state.pages, Math.max(1, Number(e.target.value) || 1)) })
            }
            className={CONTROL_CLASS + " w-24 disabled:opacity-40"}
          />
        </Field>
        <span className="pb-2 text-xs text-brand-200">of {state.pages}</span>
        <div className="pb-0.5">
          {state.running ? (
            <button
              onClick={onStop}
              className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-300/60 bg-brand-900 px-4 py-2 text-sm font-semibold text-white"
            >
              <Square className="h-3.5 w-3.5" /> Stop
            </button>
          ) : (
            <button
              onClick={onStart}
              className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white"
            >
              <ScanEye className="h-4 w-4" /> Read pages {state.from}–{state.to}
            </button>
          )}
        </div>
      </div>

      {state.running && (
        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-brand-900">
            <div
              className="h-full rounded-full bg-brand-200 transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] font-semibold text-brand-100">
            <Loader2 className="h-3 w-3 animate-spin" />
            {p
              ? `Page ${p.page} · ${p.done} of ${p.total} read · ${p.found} question${p.found === 1 ? "" : "s"} so far`
              : "Rendering the first page…"}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The answer-key paste box.
 *
 * Neither sample paper carried its answers, so without this every document
 * import lands as rows that fail validation for "No correct answer given". The
 * per-row selector in the preview covers what the key misses.
 */
function AnswerKeyBox({
  value,
  onChange,
  onApply,
  summary,
}: {
  value: string;
  onChange: (v: string) => void;
  onApply: () => void;
  summary: string | null;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-brand-400/40 bg-brand-800 p-4">
      <div className="flex items-start gap-2.5">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-brand-200" />
        <div className="text-xs leading-relaxed text-brand-100">
          <strong className="text-white">Answer key.</strong> Paste it in any usual shape —{" "}
          <code className="text-white">1. A</code>, <code className="text-white">1) A</code>,{" "}
          <code className="text-white">1-A</code>, or a single run like{" "}
          <code className="text-white">1 A 2 D 3 C</code>. Grid-in values (
          <code className="text-white">16. 3/4</code>) work too. Answers are matched on the question
          number printed in the paper, never guessed by position.
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        spellCheck={false}
        placeholder={"1. A\n2. D\n3. C"}
        className={CONTROL_CLASS + " resize-y font-mono text-xs leading-relaxed"}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onApply}
          disabled={!value.trim()}
          className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-400/50 bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-400 disabled:opacity-40"
        >
          <KeyRound className="h-4 w-4" /> Apply key
        </button>
        {summary && <span className="text-xs text-brand-100">{summary}</span>}
      </div>
    </div>
  );
}

function CopyBox({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="max-h-56 overflow-auto rounded-lg border border-brand-400/40 bg-brand-900 p-3 text-[11px] leading-relaxed text-brand-100">
        {text}
      </pre>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="tap absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-brand-400/50 bg-brand-800 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-brand-400"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function PreviewPanel({
  rows,
  ignoredColumns,
  stats,
  skipDuplicates,
  setSkipDuplicates,
  importing,
  progress,
  onImport,
  onAnswerChange,
  drafts,
  setLabel,
}: {
  rows: PreviewRow[];
  ignoredColumns: string[];
  stats: {
    total: number;
    valid: number;
    invalid: number;
    warnings: number;
    duplicates: number;
    importable: number;
  };
  skipDuplicates: boolean;
  setSkipDuplicates: (v: boolean) => void;
  importing: boolean;
  progress: { done: number; total: number };
  onImport: () => void;
  onAnswerChange?: (index: number, value: string) => void;
  drafts: Draft[] | null;
  setLabel: string | null;
}) {
  const [showOnlyProblems, setShowOnlyProblems] = useState(false);
  const visible = showOnlyProblems
    ? rows.filter((p) => !p.row.question || p.row.warnings.length > 0)
    : rows;

  return (
    <div className="rise-in space-y-4 rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-panel md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Stat label="Parsed" value={stats.total} />
        <Stat label="Ready" value={stats.valid} tone="good" />
        {stats.invalid > 0 && <Stat label="Errors" value={stats.invalid} tone="bad" />}
        {stats.warnings > 0 && <Stat label="Warnings" value={stats.warnings} />}
        {stats.duplicates > 0 && <Stat label="Duplicates" value={stats.duplicates} />}
      </div>

      {ignoredColumns.length > 0 && (
        <div className="rounded-lg bg-brand-800 px-3 py-2 text-xs text-brand-100">
          Ignored unrecognised {ignoredColumns.length === 1 ? "column" : "columns"}:{" "}
          <span className="font-semibold text-white">{ignoredColumns.join(", ")}</span>. If one of
          those was meant to be a real field, check its spelling against the format above.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {stats.duplicates > 0 && (
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-brand-100">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="h-4 w-4 accent-brand-200 [color-scheme:dark]"
              />
              Skip the {stats.duplicates} duplicate{stats.duplicates === 1 ? "" : "s"}
            </label>
          )}
          {(stats.invalid > 0 || stats.warnings > 0) && (
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-brand-100">
              <input
                type="checkbox"
                checked={showOnlyProblems}
                onChange={(e) => setShowOnlyProblems(e.target.checked)}
                className="h-4 w-4 accent-brand-200 [color-scheme:dark]"
              />
              Show only rows needing attention
            </label>
          )}
        </div>
        <button
          onClick={onImport}
          disabled={importing || stats.importable === 0}
          className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {importing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {importing
            ? `Importing ${progress.done}/${progress.total}…`
            : `Import ${stats.importable} question${stats.importable === 1 ? "" : "s"}`}
        </button>
      </div>

      {setLabel && (
        <div className="rounded-lg bg-brand-800 px-3 py-2 text-xs text-brand-100">
          These will also be grouped into the test set{" "}
          <span className="font-semibold text-white">{setLabel}</span>, in the order shown, so
          students see them as one dated paper.
        </div>
      )}

      {stats.invalid > 0 && (
        <div className="rounded-lg bg-brand-900 px-3 py-2 text-xs font-semibold text-white ring-1 ring-brand-300/60">
          {stats.invalid} row{stats.invalid === 1 ? "" : "s"} {stats.invalid === 1 ? "has" : "have"}{" "}
          an error and won't be imported.
          {onAnswerChange
            ? " Most will be a missing answer — paste a key above, or set the answer on the row itself."
            : " Fix them in your source and paste again — the rows that are ready can be imported now either way."}
        </div>
      )}

      <ul className="divide-y divide-brand-400/30 overflow-hidden rounded-xl border border-brand-400/40">
        {visible.map((p) => (
          <RowPreview
            key={p.row.index}
            row={p.row}
            draft={p.draftIndex != null ? (drafts?.[p.draftIndex] ?? null) : null}
            onAnswerChange={
              onAnswerChange && p.draftIndex != null
                ? (v) => onAnswerChange(p.draftIndex as number, v)
                : undefined
            }
          />
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider " +
        (tone === "good"
          ? "bg-brand-400 text-white"
          : tone === "bad"
            ? "bg-brand-900 text-white ring-1 ring-brand-300/60"
            : "bg-brand-800 text-brand-100")
      }
    >
      {label}
      <span className="tabular-nums text-white">{value}</span>
    </span>
  );
}

function RowPreview({
  row,
  draft,
  onAnswerChange,
}: {
  row: RowResult;
  draft: Draft | null;
  onAnswerChange?: (value: string) => void;
}) {
  const q = row.question;
  const ok = q != null;

  /* Read off the draft rather than the validated question, because a row with an
     error has no `question` at all — and a missing answer is exactly the error
     this selector exists to fix. */
  const choiceIds = draft
    ? ["A", "B", "C", "D", "E", "F", "G", "H"].filter((id) =>
        (draft.rec[`choice_${id}`] ?? "").trim(),
      )
    : [];
  const answer = draft?.rec.correct ?? "";

  return (
    <li className={"px-4 py-3 " + (ok ? "bg-brand-600" : "bg-brand-900/40")}>
      <div className="flex items-start gap-3">
        <span
          className={
            "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full " +
            (ok ? "bg-brand-400" : "bg-brand-900 ring-1 ring-brand-300/60")
          }
        >
          {ok ? <Check className="h-3 w-3 text-white" /> : <X className="h-3 w-3 text-brand-200" />}
        </span>
        <span className="mt-0.5 w-8 shrink-0 text-xs font-bold tabular-nums text-brand-200">
          {row.index}
        </span>
        <div className="min-w-0 flex-1">
          {q ? (
            <>
              <MathText className="line-clamp-2 text-sm font-semibold text-white">
                {q.question_text}
              </MathText>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-brand-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  {SECTION_LABEL[q.section]}
                </span>
                <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                  {q.skill}
                </span>
                <span
                  className={
                    "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
                    difficultyColor(q.difficulty)
                  }
                >
                  {q.difficulty}
                </span>
                <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                  {q.kind === "grid_in" ? "Grid-in" : "Multiple choice"}
                </span>
                {!onAnswerChange && (
                  <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                    Answer{" "}
                    <span className="text-white">
                      {q.kind === "grid_in"
                        ? (q.correct_grid_answers ?? []).join(" / ")
                        : q.correct_choice_id}
                    </span>
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="text-sm font-semibold text-white">
              {draft?.rec.question_text ? (
                <MathText className="line-clamp-2">{draft.rec.question_text}</MathText>
              ) : (
                "Not imported"
              )}
            </div>
          )}

          {onAnswerChange && draft && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-200">
                Answer
              </span>
              {choiceIds.length > 0 ? (
                choiceIds.map((id) => (
                  <button
                    key={id}
                    onClick={() => onAnswerChange(answer.trim().toUpperCase() === id ? "" : id)}
                    title={draft.rec[`choice_${id}`]}
                    className={
                      "tap h-6 w-6 rounded-md text-[11px] font-bold transition-colors " +
                      (answer.trim().toUpperCase() === id
                        ? "bg-brand-400 text-white"
                        : "bg-brand-800 text-brand-100 ring-1 ring-brand-400/40 hover:bg-brand-500 hover:text-white")
                    }
                  >
                    {id}
                  </button>
                ))
              ) : (
                <input
                  value={answer}
                  onChange={(e) => onAnswerChange(e.target.value)}
                  placeholder="3/4, 0.75"
                  className="w-40 rounded-md border border-brand-400/50 bg-brand-800 px-2 py-1 text-xs text-white placeholder:text-brand-200 focus:border-brand-200 focus:outline-none"
                />
              )}
            </div>
          )}

          {row.errors.length > 0 && (
            <ul className="mt-2 space-y-1">
              {row.errors.map((e, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs font-semibold text-white">
                  <X className="mt-0.5 h-3 w-3 shrink-0 text-brand-200" />
                  {e}
                </li>
              ))}
            </ul>
          )}
          {row.warnings.length > 0 && (
            <ul className="mt-2 space-y-1">
              {row.warnings.map((w, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-brand-100">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-brand-200" />
                  {w}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}
