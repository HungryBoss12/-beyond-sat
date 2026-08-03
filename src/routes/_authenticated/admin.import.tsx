import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  parseDelimited,
  parseJson,
  flagDuplicates,
  dedupeKey,
  JSON_TEMPLATE,
  TSV_TEMPLATE,
  TSV_COLUMNS,
  type ParseResult,
  type RowResult,
} from "@/lib/question-import";
import { SECTION_LABEL, difficultyColor, RW_SKILLS, MATH_SKILLS } from "@/lib/sat";
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
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/import")({
  component: AdminImport,
  head: () => ({ meta: [{ title: "Import questions — BeyondSAT" }] }),
});

type Mode = "sheet" | "json";

const CONTROL_CLASS =
  "w-full rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2 text-sm text-white [color-scheme:dark] placeholder:text-brand-200 focus:border-brand-200 focus:outline-none";

/** Rows per insert request. Keeps the payload well under any body limit. */
const CHUNK = 100;

function AdminImport() {
  const [mode, setMode] = useState<Mode>("sheet");
  const [text, setText] = useState("");
  const [checking, setChecking] = useState(false);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{ inserted: number; failed: number; errors: string[] } | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);

  /* Parsing is synchronous, but the existing-question fetch for duplicate
     detection isn't — so "Check" is async and the button shows a spinner. */
  async function check() {
    setChecking(true);
    setResult(null);
    const base = mode === "sheet" ? parseDelimited(text) : parseJson(text);
    if (base.fatal) {
      setParsed(base);
      setChecking(false);
      return;
    }
    /* Only the columns needed for the dedupe key. `select("*")` would 403 here:
       the answer-key columns are revoked at column level. */
    const existing = new Set<string>();
    const { data, error } = await supabase
      .from("questions")
      .select("section,question_text")
      .limit(5000);
    if (!error) {
      for (const r of (data ?? []) as { section: string; question_text: string }[]) {
        existing.add(dedupeKey(r.section, r.question_text));
      }
    }
    setParsed({ ...base, rows: flagDuplicates(base.rows, existing) });
    setChecking(false);
  }

  const stats = useMemo(() => {
    const rows = parsed?.rows ?? [];
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
  }, [parsed, skipDuplicates]);

  async function runImport() {
    if (!parsed) return;
    const rows = parsed.rows.filter(
      (r) => r.question && (!skipDuplicates || !r.duplicate),
    ) as (RowResult & { question: NonNullable<RowResult["question"]> })[];
    if (rows.length === 0) return;

    setImporting(true);
    setResult(null);
    setProgress({ done: 0, total: rows.length });

    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id ?? null;

    let inserted = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const payload = slice.map((r) => ({ ...r.question, created_by: uid }));
      const { error } = await supabase.from("questions").insert(payload);
      if (error) {
        /* One bad row rejects its whole chunk, so fall back to row-by-row for
           this chunk to salvage the good ones and name the ones that failed. */
        for (const r of slice) {
          const { error: e2 } = await supabase
            .from("questions")
            .insert({ ...r.question, created_by: uid });
          if (e2) {
            failed++;
            if (errors.length < 10) errors.push(`Row ${r.index}: ${e2.message}`);
          } else {
            inserted++;
          }
          setProgress((p) => ({ ...p, done: p.done + 1 }));
        }
      } else {
        inserted += slice.length;
        setProgress((p) => ({ ...p, done: p.done + slice.length }));
      }
    }

    setImporting(false);
    setResult({ inserted, failed, errors });
    if (failed === 0) {
      /* A clean run has nothing left to act on — clear the box so the same
         batch can't be imported twice by pressing the button again. */
      setText("");
      setParsed(null);
    }
  }

  function loadFile(f: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      setText(content);
      setParsed(null);
      setResult(null);
      /* Switch tab to match what was dropped, so a .json file doesn't get
         handed to the spreadsheet parser. */
      if (/\.json$/i.test(f.name)) setMode("json");
      else if (/\.(tsv|csv|txt)$/i.test(f.name)) setMode("sheet");
    };
    reader.readAsText(f);
  }

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

      {/* Mode tabs */}
      <div className="rise-in overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 shadow-panel">
        <div className="flex border-b border-brand-400/30">
          <TabButton
            active={mode === "sheet"}
            onClick={() => {
              setMode("sheet");
              setParsed(null);
            }}
            icon={<Table2 className="h-4 w-4" />}
            label="Spreadsheet"
          />
          <TabButton
            active={mode === "json"}
            onClick={() => {
              setMode("json");
              setParsed(null);
            }}
            icon={<Braces className="h-4 w-4" />}
            label="JSON"
          />
        </div>

        <div className="space-y-4 p-5 md:p-6">
          {mode === "sheet" ? (
            <p className="text-sm text-brand-100">
              Select your rows in Google Sheets or Excel — <strong className="text-white">including
              the header row</strong> — and paste them below. Tabs separate columns, so commas inside
              a question are fine. Comma-separated text works too.
            </p>
          ) : (
            <p className="text-sm text-brand-100">
              Paste a JSON array of question objects. Best for output from an AI model, since
              passages, commas and LaTeX backslashes survive without escaping problems.
            </p>
          )}

          <details className="rounded-xl border border-brand-400/40 bg-brand-800/60 px-4 py-3">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-brand-100">
              Format &amp; example
            </summary>
            <div className="mt-3 space-y-3">
              {mode === "sheet" && (
                <div className="text-xs text-brand-100">
                  <div className="font-bold uppercase tracking-wider text-brand-200">Columns</div>
                  <p className="mt-1 leading-relaxed">
                    {TSV_COLUMNS.join(" · ")}
                  </p>
                  <p className="mt-2 leading-relaxed">
                    Only <strong className="text-white">section</strong>,{" "}
                    <strong className="text-white">skill</strong>,{" "}
                    <strong className="text-white">question_text</strong> and{" "}
                    <strong className="text-white">correct</strong> are required. Column order
                    doesn't matter — the header row is read. Unknown columns are ignored, and{" "}
                    <code className="text-white">kind</code> is inferred from whether you filled in
                    choices.
                  </p>
                </div>
              )}
              <CopyBox text={mode === "sheet" ? TSV_TEMPLATE : JSON_TEMPLATE} />
              <div className="text-xs text-brand-100">
                <div className="font-bold uppercase tracking-wider text-brand-200">Valid values</div>
                <ul className="mt-1 space-y-0.5 leading-relaxed">
                  <li>
                    <code className="text-white">section</code>: math · reading_writing
                  </li>
                  <li>
                    <code className="text-white">difficulty</code>: C · B · D · A · S (S hardest),
                    or easy/medium/hard
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
                    <code className="text-white">correct</code>: a letter (B), a number (2), or the
                    exact choice text. For grid-ins, comma-separate every accepted form.
                  </li>
                </ul>
                <p className="mt-2 leading-relaxed">
                  Math goes in as LaTeX between dollar signs — <code className="text-white">$3x + 5 = 20$</code>{" "}
                  inline, <code className="text-white">$$…$$</code> on its own line. Images can't be
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
              setParsed(null);
              setResult(null);
            }}
            rows={12}
            spellCheck={false}
            placeholder={
              mode === "sheet"
                ? "section\tskill\tdifficulty\tquestion_text\tA\tB\tC\tD\tcorrect\nmath\tAlgebra\tB\tIf $3x + 5 = 20$…\t3\t5\t15\t25\tB"
                : '[\n  { "section": "math", "skill": "Algebra", "question_text": "…", "choices": ["3","5","15","25"], "correct": "B" }\n]'
            }
            className={CONTROL_CLASS + " min-h-[220px] resize-y font-mono text-xs leading-relaxed"}
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
                  setParsed(null);
                  setResult(null);
                }}
                className="tap rounded-lg px-3 py-2 text-sm font-semibold text-brand-100 hover:bg-brand-800 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {parsed?.fatal && (
        <div className="pop-in rounded-2xl border border-brand-300/60 bg-brand-900 p-5 text-sm font-semibold text-white">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-200" />
            <span>{parsed.fatal}</span>
          </div>
        </div>
      )}

      {parsed && !parsed.fatal && (
        <PreviewPanel
          parsed={parsed}
          stats={stats}
          skipDuplicates={skipDuplicates}
          setSkipDuplicates={setSkipDuplicates}
          importing={importing}
          progress={progress}
          onImport={runImport}
        />
      )}

      {result && (
        <div className="pop-in rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-panel">
          <div className="flex items-center gap-2.5">
            {result.failed === 0 ? (
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
      {active && (
        <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand-200" />
      )}
    </button>
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
  parsed,
  stats,
  skipDuplicates,
  setSkipDuplicates,
  importing,
  progress,
  onImport,
}: {
  parsed: ParseResult;
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
}) {
  const [showOnlyProblems, setShowOnlyProblems] = useState(false);
  const rows = showOnlyProblems
    ? parsed.rows.filter((r) => !r.question || r.warnings.length > 0)
    : parsed.rows;

  return (
    <div className="rise-in space-y-4 rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-panel md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Stat label="Parsed" value={stats.total} />
        <Stat label="Ready" value={stats.valid} tone="good" />
        {stats.invalid > 0 && <Stat label="Errors" value={stats.invalid} tone="bad" />}
        {stats.warnings > 0 && <Stat label="Warnings" value={stats.warnings} />}
        {stats.duplicates > 0 && <Stat label="Duplicates" value={stats.duplicates} />}
      </div>

      {parsed.ignoredColumns.length > 0 && (
        <div className="rounded-lg bg-brand-800 px-3 py-2 text-xs text-brand-100">
          Ignored unrecognised {parsed.ignoredColumns.length === 1 ? "column" : "columns"}:{" "}
          <span className="font-semibold text-white">{parsed.ignoredColumns.join(", ")}</span>. If
          one of those was meant to be a real field, check its spelling against the format above.
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
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {importing
            ? `Importing ${progress.done}/${progress.total}…`
            : `Import ${stats.importable} question${stats.importable === 1 ? "" : "s"}`}
        </button>
      </div>

      {stats.invalid > 0 && (
        <div className="rounded-lg bg-brand-900 px-3 py-2 text-xs font-semibold text-white ring-1 ring-brand-300/60">
          {stats.invalid} row{stats.invalid === 1 ? "" : "s"} {stats.invalid === 1 ? "has" : "have"} an
          error and won't be imported. Fix them in your source and paste again — the rows that are
          ready can be imported now either way.
        </div>
      )}

      <ul className="divide-y divide-brand-400/30 overflow-hidden rounded-xl border border-brand-400/40">
        {rows.map((r) => (
          <RowPreview key={r.index} row={r} />
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

function RowPreview({ row }: { row: RowResult }) {
  const q = row.question;
  const ok = q != null;
  return (
    <li className={"px-4 py-3 " + (ok ? "bg-brand-600" : "bg-brand-900/40")}>
      <div className="flex items-start gap-3">
        <span
          className={
            "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full " +
            (ok ? "bg-brand-400" : "bg-brand-900 ring-1 ring-brand-300/60")
          }
        >
          {ok ? (
            <Check className="h-3 w-3 text-white" />
          ) : (
            <X className="h-3 w-3 text-brand-200" />
          )}
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
                <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                  Answer{" "}
                  <span className="text-white">
                    {q.kind === "grid_in"
                      ? (q.correct_grid_answers ?? []).join(" / ")
                      : q.correct_choice_id}
                  </span>
                </span>
              </div>
            </>
          ) : (
            <div className="text-sm font-semibold text-white">Not imported</div>
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
