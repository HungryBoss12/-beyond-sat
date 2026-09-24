import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  parseJson,
  validateRecord,
  flagDuplicates,
  dedupeKey,
  forceBankFormat,
  JSON_TEMPLATE,
  type RowResult,
} from "@/lib/question-import";
import type { Draft } from "@/lib/import/parse";
import { skillsFor, MONTHS, type Section } from "@/lib/sat";
import {
  CHUNK,
  CONTROL_CLASS,
  CopyBox,
  DraftReviewer,
  Field,
  SQB_WIZARD_STEPS,
  WizardSteps,
  type ImportWizardStep,
  type PreviewRow,
} from "@/components/admin-import";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { existingIdFromDraft, loadTestAsDrafts } from "@/lib/import/load-existing";
import { blankSqbDraft, stampSqbDrafts, validateSqbDraft, type SqbParseDefaults } from "@/lib/sqb/draft";
import {
  applySqbAnswers,
  describeSqbAnswerApply,
  parseSqbAnswersJson,
  SQB_ANSWERS_JSON_TEMPLATE,
} from "@/lib/sqb/answer-pdf";
import {
  SQB_DIFFICULTIES,
  SQB_DIFFICULTY_HINT,
  type SqbDifficulty,
} from "@/lib/sqb";
import { uploadQuestionImage } from "@/lib/import/upload-question-image";
import { toPersistableImageRef } from "@/lib/storage-url";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/sqb/import")({
  validateSearch: (s: Record<string, unknown>) => ({
    testId: typeof s.testId === "string" && s.testId.trim() ? s.testId.trim() : undefined,
  }),
  component: AdminSqbImportWizard,
  head: () => ({ meta: [{ title: "New SQB test — BeyondSAT Admin" }] }),
});

const WRITE_TIMEOUT_MS = 20_000;

function withWriteTimeout<T>(work: PromiseLike<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    Promise.resolve(work).finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise<T>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} timed out after 20s`)),
        WRITE_TIMEOUT_MS,
      );
    }),
  ]);
}

async function persistQuestionImage(
  url: string | null | undefined,
  rowLabel: string,
): Promise<{ path: string | null; error?: string }> {
  const value = (url ?? "").trim();
  if (!value) return { path: null };
  if (/^data:/i.test(value)) {
    try {
      const res = await fetch(value);
      const blob = await res.blob();
      const path = await uploadQuestionImage(blob, `sqb-import-${rowLabel}.png`);
      return { path };
    } catch (err) {
      return { path: null, error: `${rowLabel}: ${(err as Error).message}` };
    }
  }
  return { path: toPersistableImageRef(value) ?? null };
}

function AdminSqbImportWizard() {
  const navigate = useNavigate();
  const { testId: searchTestId } = Route.useSearch();
  const autoLoadedRef = useRef<string | null>(null);

  const [step, setStep] = useState<ImportWizardStep>("source");
  const [makeSet, setMakeSet] = useState(true);
  const [title, setTitle] = useState("");
  const [section, setSection] = useState<Section>("math");
  const [difficulty, setDifficulty] = useState<SqbDifficulty>("C");
  const [month, setMonth] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(new Date().getFullYear());
  const [defaultDomain, setDefaultDomain] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);

  const [text, setText] = useState("");
  const [answersText, setAnswersText] = useState("");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [readError, setReadError] = useState<string | null>(null);
  const [answersError, setAnswersError] = useState<string | null>(null);
  const [keySummary, setKeySummary] = useState<string | null>(null);
  const [jsonDragOver, setJsonDragOver] = useState(false);
  const [answersDragOver, setAnswersDragOver] = useState(false);

  const [existingKeys, setExistingKeys] = useState<Set<string>>(new Set());
  const [existingTestId, setExistingTestId] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{
    inserted: number;
    failed: number;
    errors: string[];
    testId?: string;
    setTitle?: string;
  } | null>(null);

  const unlocked = useMemo(() => {
    const s = new Set<ImportWizardStep>(["source"]);
    if (drafts && drafts.length > 0) {
      s.add("editor");
      s.add("extract");
    }
    return s;
  }, [drafts]);

  const domainOptions = skillsFor(section);

  function defaults(): SqbParseDefaults {
    const skills = skillsFor(section);
    const skill = defaultDomain.trim() || skills[0] || "Algebra";
    return {
      section,
      skill,
      difficulty,
      source_month: month != null ? String(month) : "",
      source_year: year != null ? String(year) : "",
      module: "1",
      assessment: "SAT",
      domain: skill,
      subskill: "",
    };
  }

  async function fetchExisting() {
    const { data } = await supabase.from("questions").select("section,question_text").limit(5000);
    const keys = new Set<string>();
    for (const r of (data ?? []) as { section: string; question_text: string }[]) {
      keys.add(dedupeKey(r.section, r.question_text));
    }
    setExistingKeys(keys);
  }

  function commitDrafts(list: Draft[], extraNotes: string[] = []) {
    const stamped = stampSqbDrafts(list, defaults());
    setDrafts(stamped);
    setNotes(extraNotes);
    if (stamped.length > 0) {
      void fetchExisting();
      setStep("editor");
    }
  }

  function runParse() {
    setReadError(null);
    setResult(null);
    if (!rightsConfirmed) {
      setReadError("Confirm rights before importing JSON (no College Board stems).");
      return;
    }
    const parsed = parseJson(text);
    if (parsed.fatal) {
      setReadError(parsed.fatal);
      return;
    }
    const forced = forceBankFormat(parsed.rows, "sqb");
    const list: Draft[] = forced
      .filter((r) => r.question)
      .map((r, i) => ({
        number: i + 1,
        warnings: [...r.warnings, ...(r.errors.length ? r.errors : [])],
        rec: {
          section: r.question!.section,
          skill: r.question!.skill,
          difficulty: r.question!.difficulty,
          kind: r.question!.kind,
          prompt: r.question!.prompt ?? "",
          question_text: r.question!.question_text,
          correct:
            r.question!.kind === "grid_in"
              ? (r.question!.correct_grid_answers ?? []).join(", ")
              : r.question!.correct_choice_id ?? "",
          explanation: r.question!.explanation ?? "",
          source_month: r.question!.source_month != null ? String(r.question!.source_month) : "",
          source_year: r.question!.source_year != null ? String(r.question!.source_year) : "",
          module: "1",
          choice_A: r.question!.choices.find((c) => c.id === "A")?.text ?? "",
          choice_B: r.question!.choices.find((c) => c.id === "B")?.text ?? "",
          choice_C: r.question!.choices.find((c) => c.id === "C")?.text ?? "",
          choice_D: r.question!.choices.find((c) => c.id === "D")?.text ?? "",
          image_url: r.question!.image_url ?? "",
          bank_format: "sqb",
          assessment: r.question!.assessment || "SAT",
          domain: r.question!.domain || r.question!.skill,
          subskill: r.question!.subskill ?? "",
          external_id: r.question!.external_id ?? "",
          image_alt: r.question!.image_alt ?? "",
          published: "false",
        },
      }));
    if (list.length === 0) {
      setReadError("No valid rows to import.");
      return;
    }
    if (!title.trim()) {
      setTitle("SQB Pack");
    }
    commitDrafts(list, [`Parsed ${list.length} SQB row(s) from JSON.`]);
  }

  async function loadJsonFile(f: File) {
    try {
      const raw = await f.text();
      setText(raw);
      setReadError(null);
    } catch (err) {
      setReadError((err as Error).message);
    }
  }

  async function loadAnswersJsonFile(f: File) {
    try {
      const raw = await f.text();
      setAnswersText(raw);
      setAnswersError(null);
    } catch (err) {
      setAnswersError((err as Error).message);
    }
  }

  function applyAnswersJson() {
    if (!drafts?.length) {
      setAnswersError("Parse questions first.");
      return;
    }
    const { parsed, error } = parseSqbAnswersJson(answersText);
    if (error) {
      setAnswersError(error);
      setKeySummary(null);
      return;
    }
    const applied = applySqbAnswers(drafts, parsed);
    setDrafts(applied.drafts);
    setAnswersError(null);
    const summary = describeSqbAnswerApply(applied, parsed.ordered.length);
    setKeySummary(summary);
    setNotes((n) => [...n.filter((x) => !x.startsWith("Matched ")), summary]);
  }

  async function loadByTestId(id: string) {
    setReadError(null);
    try {
      const list = await loadTestAsDrafts(id);
      setExistingTestId(id);
      setTitle(list.test.title);
      setSection(list.test.section);
      setMakeSet(true);
      setRightsConfirmed(true);
      commitDrafts(
        stampSqbDrafts(list.drafts, defaults()),
        [`Restored SQB set “${list.test.title}” from Review.`],
      );
    } catch (e) {
      setReadError((e as Error).message);
      setStep("source");
    }
  }

  useEffect(() => {
    if (!searchTestId || autoLoadedRef.current === searchTestId) return;
    autoLoadedRef.current = searchTestId;
    void loadByTestId(searchTestId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTestId]);

  const previewRows: PreviewRow[] = useMemo(() => {
    if (!drafts) return [];
    const rows: RowResult[] = drafts.map((d, i) => {
      const vr = validateRecord(d.rec, i + 1);
      const sqb = validateSqbDraft(d);
      const errors = [...vr.errors];
      const warnings = [
        ...vr.warnings,
        ...d.warnings,
        ...sqb.errors.map((e) => `Publish: ${e.message}`),
        ...sqb.warnings.map((w) => w.message),
      ];
      const flagged = flagDuplicates(
        [
          {
            ...vr,
            errors,
            warnings,
            question: vr.question
              ? { ...vr.question, bank_format: "sqb" as const, published: false }
              : null,
          },
        ],
        existingKeys,
      )[0];
      return flagged;
    });
    return rows.map((row, i) => ({ row, draftIndex: i }));
  }, [drafts, existingKeys]);

  const hardPublishCount = useMemo(() => {
    if (!drafts) return 0;
    return drafts.reduce((n, d) => n + validateSqbDraft(d).errors.length, 0);
  }, [drafts]);

  function updateDraft(index: number, patch: { number?: number; rec?: Record<string, string> }) {
    setDrafts((current) => {
      if (!current) return current;
      return current.map((d, i) => {
        if (i !== index) return d;
        return {
          ...d,
          number: patch.number ?? d.number,
          rec: patch.rec ? { ...d.rec, ...patch.rec, bank_format: "sqb", published: "false" } : d.rec,
        };
      });
    });
  }

  async function runImport() {
    if (!drafts?.length) return;
    if (!rightsConfirmed) {
      alert("Confirm you have rights to import this content. Do not upload College Board stems.");
      return;
    }

    const tagged = previewRows
      .filter((p) => p.row.question)
      .map((p) => ({
        row: p.row,
        draft: p.draftIndex != null ? drafts[p.draftIndex] : null,
      }));
    if (tagged.length === 0) return;

    setImporting(true);
    setResult(null);
    setProgress({ done: 0, total: tagged.length });

    let inserted = 0;
    let failed = 0;
    const errors: string[] = [];
    const insertedIds: string[] = [];
    let createdTestId: string | undefined;
    let createdSet: string | undefined;

    try {
      const { data: sessionWrap } = await supabase.auth.getSession();
      const uid = sessionWrap.session?.user?.id ?? null;

      const ready: {
        row: (typeof tagged)[number]["row"];
        existingId: string | null;
        payload: Record<string, unknown>;
      }[] = [];

      for (const t of tagged) {
        const rowLabel = `Q${t.row.index}`;
        const img = await persistQuestionImage(t.row.question!.image_url, rowLabel);
        if (img.error) {
          failed++;
          if (errors.length < 10) errors.push(img.error);
          setProgress((p) => ({ ...p, done: p.done + 1 }));
          continue;
        }
        const q = t.row.question!;
        ready.push({
          row: t.row,
          existingId: t.draft ? existingIdFromDraft(t.draft) : null,
          payload: {
            ...q,
            image_url: img.path,
            source_month: q.source_month ?? month ?? null,
            source_year: q.source_year ?? year ?? null,
            bank_format: "sqb",
            published: false,
            domain: q.domain || q.skill,
            assessment: q.assessment || "SAT",
            created_by: uid,
          },
        });
      }

      for (let i = 0; i < ready.length; i += CHUNK) {
        const slice = ready.slice(i, i + CHUNK);
        for (const t of slice) {
          try {
            if (t.existingId) {
              const { error: e2 } = await withWriteTimeout(
                supabase.from("questions").update(t.payload as never).eq("id", t.existingId),
                `Update ${t.existingId}`,
              );
              if (e2) {
                failed++;
                if (errors.length < 10) errors.push(`Q${t.row.index}: ${e2.message}`);
              } else {
                inserted++;
                insertedIds.push(t.existingId);
              }
            } else {
              const { data: one, error: e2 } = await withWriteTimeout(
                supabase.from("questions").insert(t.payload as never).select("id").single(),
                `Insert Q${t.row.index}`,
              );
              if (e2) {
                failed++;
                if (errors.length < 10) errors.push(`Q${t.row.index}: ${e2.message}`);
              } else {
                inserted++;
                if (one?.id) insertedIds.push(one.id as string);
              }
            }
          } catch (err) {
            failed++;
            if (errors.length < 10) errors.push(`Q${t.row.index}: ${(err as Error).message}`);
          }
          setProgress((p) => ({ ...p, done: p.done + 1 }));
        }
      }

      if (makeSet && title.trim() && insertedIds.length > 0) {
        const label = title.trim();
        if (existingTestId) {
          const { error: ue } = await supabase
            .from("tests")
            .update({
              title: label,
              section,
              module: 1,
              difficulty,
              source_month: month,
              source_year: year,
              bank_format: "sqb",
              published: false,
            })
            .eq("id", existingTestId);
          if (ue) {
            errors.push(`Could not update set: ${ue.message}`);
          } else {
            await supabase.from("test_questions").delete().eq("test_id", existingTestId);
            const { error: le } = await supabase.from("test_questions").insert(
              insertedIds.map((qid, i) => ({
                test_id: existingTestId,
                question_id: qid,
                position: i + 1,
              })),
            );
            if (le) errors.push(`Link failed: ${le.message}`);
            else {
              createdTestId = existingTestId;
              createdSet = label;
            }
          }
        } else {
          const { data: t, error: te } = await supabase
            .from("tests")
            .insert({
              title: label,
              section,
              module: 1,
              difficulty,
              source_month: month,
              source_year: year,
              created_by: uid,
              bank_format: "sqb",
              published: false,
            })
            .select("id")
            .single();
          if (te) {
            errors.push(`Questions saved, but set failed: ${te.message}`);
          } else {
            const tid = t.id as string;
            const { error: le } = await supabase.from("test_questions").insert(
              insertedIds.map((qid, i) => ({
                test_id: tid,
                question_id: qid,
                position: i + 1,
              })),
            );
            if (le) errors.push(`Set created but links failed: ${le.message}`);
            else {
              createdTestId = tid;
              createdSet = label;
            }
          }
        }
      }

      setResult({
        inserted,
        failed,
        errors,
        testId: createdTestId,
        setTitle: createdSet,
      });
    } catch (err) {
      errors.push((err as Error)?.message ?? "Save failed.");
      setResult({ inserted, failed: failed + 1, errors });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/admin/sqb"
            className="group inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-400"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
            Back to SQB
          </Link>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-brand-900">Import SQB JSON</h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-600">
            Three stages — questions JSON, review, answers JSON — then save unpublished. Publish from
            the Review page.
          </p>
        </div>
        {result?.testId && (
          <Link
            to="/admin/sqb/review/$testId"
            params={{ testId: result.testId }}
            className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Review test <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      <WizardSteps
        step={step}
        unlocked={unlocked}
        onStepClick={setStep}
        steps={SQB_WIZARD_STEPS}
      />

      {step === "source" && (
        <div className="rise-in space-y-4">
          <div className="rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-panel md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white">1 · JSON</h2>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-brand-100">
                  Paste a JSON array of SQB questions. Name the pack below when creating a test
                  set. Always saves unpublished.
                </p>
                <p className="mt-2 rounded-lg bg-brand-800 px-3 py-2 text-xs font-semibold text-amber-100 ring-1 ring-brand-400/40">
                  Do not upload College Board copyrighted stems — format reference only.
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
              <Field label="Name">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Circles"
                  disabled={!makeSet}
                  className={CONTROL_CLASS + " disabled:opacity-40"}
                />
              </Field>
              <Field label="Section">
                <AdminSelect
                  value={section}
                  onValueChange={(v) => setSection(v as Section)}
                  options={[
                    { value: "reading_writing", label: "Reading & Writing" },
                    { value: "math", label: "Math" },
                  ]}
                />
              </Field>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Field label="Difficulty default">
                <AdminSelect
                  value={difficulty}
                  onValueChange={(v) => setDifficulty(v as SqbDifficulty)}
                  options={SQB_DIFFICULTIES.map((d) => ({
                    value: d,
                    label: `${d}${SQB_DIFFICULTY_HINT[d] ? ` (${SQB_DIFFICULTY_HINT[d]})` : ""}`,
                  }))}
                />
              </Field>
              <Field label="Source month">
                <AdminSelect
                  value={month != null ? String(month) : ""}
                  onValueChange={(v) => setMonth(v ? Number(v) : null)}
                  placeholder="Month"
                  options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
                />
              </Field>
              <Field label="Source year">
                <input
                  type="number"
                  min={2000}
                  max={2099}
                  value={year ?? ""}
                  onChange={(e) => setYear(e.target.value ? Number(e.target.value) : null)}
                  placeholder="Year"
                  className={CONTROL_CLASS}
                />
              </Field>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label="Default Domain (optional)">
                <AdminSelect
                  value={defaultDomain}
                  onValueChange={setDefaultDomain}
                  placeholder="Use section default"
                  options={[
                    { value: "", label: "Section default" },
                    ...domainOptions.map((s) => ({ value: s, label: s })),
                  ]}
                />
              </Field>
            </div>

            <label className="mt-4 flex items-start gap-2 text-xs font-semibold text-brand-100">
              <input
                type="checkbox"
                checked={rightsConfirmed}
                onChange={(e) => setRightsConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-brand-200 [color-scheme:dark]"
              />
              <span>
                I confirm I have rights to import this content and will not paste College Board
                copyrighted question stems.
              </span>
            </label>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setJsonDragOver(true);
              }}
              onDragLeave={() => setJsonDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setJsonDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void loadJsonFile(f);
              }}
              className={
                "mt-4 rounded-xl border-2 border-dashed px-4 py-4 transition-colors " +
                (jsonDragOver
                  ? "border-brand-200 bg-brand-500/40"
                  : "border-brand-400/50 bg-brand-800/50")
              }
            >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={14}
                className={CONTROL_CLASS + " min-h-[14rem] font-mono text-xs"}
                placeholder="Paste JSON array, or drop a .json file…"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  type="file"
                  accept=".json,application/json"
                  className="text-xs text-brand-100 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-400 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void loadJsonFile(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setText(JSON_TEMPLATE)}
                  className="tap rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Load template
                </button>
                <button
                  type="button"
                  onClick={runParse}
                  disabled={!text.trim() || !rightsConfirmed}
                  className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Parse & review <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3">
                <CopyBox text={JSON_TEMPLATE} />
              </div>
            </div>

            {readError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-brand-900 px-3 py-2 text-xs font-semibold text-white ring-1 ring-brand-300/60">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-200" />
                {readError}
              </div>
            )}

            {notes.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-brand-100">
                {notes.map((n, i) => (
                  <li key={i}>· {n}</li>
                ))}
              </ul>
            )}

            {drafts && drafts.length > 0 && (
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep("editor")}
                  className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white"
                >
                  Continue to review <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {step === "editor" && drafts && (
        <div className="rise-in space-y-4">
          <div className="rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-panel md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white">2 · Review</h2>
                <p className="mt-1 text-xs text-brand-100">
                  Check stems and SQB metadata. Next step applies answers JSON, then you save.
                </p>
                {hardPublishCount > 0 && (
                  <p className="mt-2 text-xs font-semibold text-amber-100">
                    {hardPublishCount} publish issue{hardPublishCount === 1 ? "" : "s"} remain — you
                    can still continue; Publish stays blocked on the Review page.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  setDrafts((d) =>
                    d ? [...d, blankSqbDraft(defaults(), (d[d.length - 1]?.number ?? 0) + 1)] : d,
                  )
                }
                className="tap rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-1.5 text-xs font-semibold text-white"
              >
                + Add question
              </button>
            </div>

            <div className="mt-4">
              <DraftReviewer
                rows={previewRows}
                drafts={drafts}
                sourcePdf={null}
                showModule={false}
                variant="sqb"
                onChangeDraft={updateDraft}
                onSetReviewed={(index, reviewed) =>
                  setDrafts((cur) =>
                    cur ? cur.map((d, i) => (i === index ? { ...d, reviewed } : d)) : cur,
                  )
                }
                onAddAfter={(index) =>
                  setDrafts((cur) => {
                    if (!cur) return cur;
                    const next = [...cur];
                    next.splice(index + 1, 0, blankSqbDraft(defaults(), cur[index].number + 1));
                    return next.map((d, i) => ({ ...d, number: i + 1 }));
                  })
                }
                onDelete={(index) =>
                  setDrafts((cur) => {
                    if (!cur || cur.length <= 1) return cur;
                    return cur.filter((_, i) => i !== index).map((d, i) => ({ ...d, number: i + 1 }));
                  })
                }
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep("source")}
                className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-400/50 bg-brand-800 px-4 py-2 text-sm font-semibold text-white"
              >
                <ArrowLeft className="h-4 w-4" /> Back to JSON
              </button>
              <button
                type="button"
                onClick={() => setStep("extract")}
                className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white"
              >
                Continue to answers <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "extract" && drafts && (
        <div className="rise-in space-y-4">
          <div className="rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-panel md:p-6">
            <div>
              <h2 className="text-sm font-bold text-white">3 · Answers</h2>
              <p className="mt-1 text-xs text-brand-100">
                Paste answers JSON matched by <code className="text-white">external_id</code> (or
                pack order). Optional — you can save without applying. Then save unpublished drafts
                {makeSet ? " and a test set" : ""}.
              </p>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setAnswersDragOver(true);
              }}
              onDragLeave={() => setAnswersDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setAnswersDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void loadAnswersJsonFile(f);
              }}
              className={
                "mt-4 rounded-xl border-2 border-dashed px-4 py-4 transition-colors " +
                (answersDragOver
                  ? "border-brand-200 bg-brand-500/40"
                  : "border-brand-400/50 bg-brand-800/50")
              }
            >
              <textarea
                value={answersText}
                onChange={(e) => setAnswersText(e.target.value)}
                rows={12}
                className={CONTROL_CLASS + " min-h-[12rem] font-mono text-xs"}
                placeholder='[{"external_id":"…","correct":"C"}, …]'
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  type="file"
                  accept=".json,application/json"
                  className="text-xs text-brand-100 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-400 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void loadAnswersJsonFile(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setAnswersText(SQB_ANSWERS_JSON_TEMPLATE)}
                  className="tap rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Load template
                </button>
                <button
                  type="button"
                  onClick={applyAnswersJson}
                  disabled={!answersText.trim()}
                  className="tap rounded-lg border border-brand-400/50 bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Apply answers
                </button>
              </div>
              <div className="mt-3">
                <CopyBox text={SQB_ANSWERS_JSON_TEMPLATE} />
              </div>
            </div>

            {answersError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-brand-900 px-3 py-2 text-xs font-semibold text-white ring-1 ring-brand-300/60">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-200" />
                {answersError}
              </div>
            )}
            {keySummary && (
              <p className="mt-3 text-xs font-semibold text-brand-100">{keySummary}</p>
            )}
            {!keySummary && !answersText.trim() && (
              <p className="mt-3 text-xs text-brand-200">
                No answers applied yet — Save will keep whatever correct values are already on the
                drafts.
              </p>
            )}

            {result && (
              <div className="mt-4 rounded-xl bg-brand-800 px-4 py-3 text-sm text-white ring-1 ring-brand-400/40">
                <p className="font-semibold">
                  <Check className="mr-1 inline h-4 w-4 text-brand-200" />
                  Saved {result.inserted} question{result.inserted === 1 ? "" : "s"}
                  {result.failed ? ` · ${result.failed} failed` : ""}
                  {result.setTitle ? ` · set “${result.setTitle}”` : ""}
                </p>
                {result.errors.slice(0, 5).map((e, i) => (
                  <p key={i} className="mt-1 text-xs text-brand-100">
                    {e}
                  </p>
                ))}
                {result.testId && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void navigate({
                          to: "/admin/sqb/review/$testId",
                          params: { testId: result.testId! },
                        })
                      }
                      className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Review test <ArrowRight className="h-4 w-4" />
                    </button>
                    <Link
                      to="/admin/sqb"
                      className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-400/50 bg-brand-900 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Back to hub
                    </Link>
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep("editor")}
                className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-400/50 bg-brand-800 px-4 py-2 text-sm font-semibold text-white"
              >
                <ArrowLeft className="h-4 w-4" /> Back to review
              </button>
              <button
                type="button"
                disabled={
                  importing ||
                  previewRows.every((p) => !p.row.question) ||
                  (makeSet && !title.trim())
                }
                onClick={() => void runImport()}
                className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving {progress.done}/{progress.total}…
                  </>
                ) : (
                  <>
                    Save drafts{makeSet ? " + test set" : ""} <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
