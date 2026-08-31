import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Loader2, Sparkles, Upload, FileUp, FolderTree } from "lucide-react";
import { ExampleDeckButton, VocabPreviewPanel } from "@/components/admin-vocab/vocab-preview-panel";
import {
  mergeGeneratedIntoDraft,
  needsVocabAttention,
  type VocabDraft,
} from "@/components/admin-vocab/types";
import { fixVocabWords, generateVocabContent, saveVocabContent } from "@/lib/vocab/client";
import type { AnkiDeckNode, GeneratedVocabItem } from "@/lib/vocab/types";
import { PageHead, Panel } from "@/components/ui/panel";

const TOPICS = [
  "20 High-Yield Humanities SAT Words",
  "15 Science & Research Vocabulary",
  "10 Tricky Dual-Meaning SAT Words",
];

const TABS = [
  { id: "anki" as const, label: "Import Anki deck", icon: Upload },
  { id: "topic" as const, label: "AI · Topic", icon: Sparkles },
  { id: "words" as const, label: "AI · Word list", icon: Sparkles },
];

const EXAMPLE_DECK_URL = "/fixtures/vocab/def-word.colpkg";

export const Route = createFileRoute("/_authenticated/admin/vocab/")({
  component: AdminVocabImportPage,
  head: () => ({ meta: [{ title: "Vocab — Admin" }] }),
});

type InputMode = "topic" | "words" | "anki";

function toDrafts(items: GeneratedVocabItem[]): VocabDraft[] {
  return items.map((item) => ({ ...item, reviewed: false }));
}

function AdminVocabImportPage() {
  const [words, setWords] = useState("");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [quizTitle, setQuizTitle] = useState("");
  const [generating, setGenerating] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [loadingExample, setLoadingExample] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [fixingIndex, setFixingIndex] = useState<number | null>(null);
  const fixStopRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importMeta, setImportMeta] = useState<{ deckName: string; noteCount: number } | null>(
    null,
  );
  const [deckTree, setDeckTree] = useState<AnkiDeckNode[]>([]);
  const [drafts, setDrafts] = useState<VocabDraft[]>([]);
  const [mode, setMode] = useState<InputMode>("anki");
  const [cardsOnly, setCardsOnly] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  async function applyParseResult(
    result: Awaited<ReturnType<typeof import("@/lib/vocab/parse-apkg").parseApkgFile>>,
  ) {
    setDrafts(toDrafts(result.items));
    setDeckTree(result.deckTree ?? []);
    setImportMeta({ deckName: result.deckName, noteCount: result.noteCount });
    setWarnings(result.warnings);
    setQuizTitle(result.deckName);
    setCardsOnly(true);
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setWarnings([]);
    setImportMeta(null);
    try {
      const result = await generateVocabContent(
        mode === "words" ? { words } : { topic, count: 10 },
      );
      setDrafts(toDrafts(result));
      setCardsOnly(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleApkgUpload(file: File) {
    setParsing(true);
    setError(null);
    setWarnings([]);
    setImportMeta(null);
    setDrafts([]);
    try {
      const { parseApkgFile } = await import("@/lib/vocab/parse-apkg");
      const result = await parseApkgFile(file);
      await applyParseResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not parse Anki deck");
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleLoadExample() {
    setLoadingExample(true);
    setError(null);
    setWarnings([]);
    setImportMeta(null);
    setDrafts([]);
    try {
      const res = await fetch(EXAMPLE_DECK_URL);
      if (!res.ok) throw new Error("Example deck file not found");
      const blob = await res.blob();
      const file = new File([blob], "def-word.colpkg", { type: "application/octet-stream" });
      const { parseApkgFile } = await import("@/lib/vocab/parse-apkg");
      const result = await parseApkgFile(file);
      await applyParseResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load example deck");
    } finally {
      setLoadingExample(false);
    }
  }

  async function handleSave() {
    if (!drafts.length) return;
    setSaving(true);
    setError(null);
    try {
      const items = drafts.map(({ reviewed: _r, fixing: _f, ...item }) => item);
      const importCardsOnly = mode === "anki" && cardsOnly;
      const { quizId, count } = await saveVocabContent({
        items,
        deckTree: mode === "anki" && deckTree.length ? deckTree : undefined,
        quizTitle: quizTitle.trim() || undefined,
        deckName: mode === "anki" && importMeta ? importMeta.deckName : undefined,
        cardsOnly: importCardsOnly,
      });
      if (importCardsOnly) {
        alert(`Imported ${count} cards into the SRS deck.`);
      } else {
        alert(`Saved ${count} cards${quizId ? ` to quiz ${quizId}` : ""}.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function updateDraft(i: number, patch: Partial<VocabDraft>) {
    setDrafts((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function setDraftReviewed(i: number, reviewed: boolean) {
    updateDraft(i, { reviewed });
  }

  function removeDraft(i: number) {
    setDrafts((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function fixDraftAt(index: number) {
    const draft = drafts[index];
    if (!draft?.word.trim()) return;
    setFixing(true);
    setFixingIndex(index);
    setError(null);
    try {
      const [generated] = await fixVocabWords([draft.word.trim()]);
      if (generated) {
        updateDraft(index, mergeGeneratedIntoDraft(draft, generated));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fix with AI failed");
    } finally {
      setFixing(false);
      setFixingIndex(null);
    }
  }

  async function fixManyDrafts() {
    const targets = drafts
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => needsVocabAttention(d) && !d.reviewed);
    if (!targets.length) return;

    setFixing(true);
    fixStopRef.current = false;
    setError(null);
    try {
      for (const { d, i } of targets) {
        if (fixStopRef.current) break;
        setFixingIndex(i);
        try {
          const [generated] = await fixVocabWords([d.word.trim()]);
          if (generated) {
            setDrafts((prev) =>
              prev.map((row, idx) => (idx === i ? mergeGeneratedIntoDraft(row, generated) : row)),
            );
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Fix with AI failed");
          break;
        }
      }
    } finally {
      setFixing(false);
      setFixingIndex(null);
    }
  }

  const showQuizFields = mode !== "anki" || !cardsOnly;
  const saveLabel = mode === "anki" && cardsOnly ? "Import to SRS deck" : "Save to database";

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <PageHead
        title="Vocabulary"
        subtitle="Import a modern Anki .colpkg or .apkg deck for SRS review, or generate SAT-specific cards with AI."
        action={
          <Link
            to="/admin/vocab/decks"
            className="tap inline-flex items-center gap-2 rounded-lg border border-brand-300/50 bg-brand-800 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <FolderTree className="h-4 w-4" />
            Manage decks
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setMode(tab.id);
                setError(null);
              }}
              className={
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition " +
                (active
                  ? "bg-brand-600 text-white shadow-brand ring-1 ring-brand-400/50"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")
              }
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <Panel className="space-y-4">
        {mode === "anki" ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-black text-white">Upload Anki deck</h2>
              <p className="mt-1 text-sm text-brand-100">
                Export from Anki as <strong className="text-white">.apkg</strong> or{" "}
                <strong className="text-white">.colpkg</strong>. Modern Anki exports (including
                zstd-compressed collections) are supported. Basic and VOCABOOK-style note types map
                automatically.
              </p>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".apkg,.colpkg"
              className="sr-only"
              disabled={parsing || loadingExample}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleApkgUpload(file);
              }}
            />

            <div
              className="rounded-xl border-2 border-dashed border-brand-300/50 bg-brand-800/50 px-6 py-10 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) void handleApkgUpload(file);
              }}
            >
              <FileUp className="mx-auto h-10 w-10 text-brand-200" />
              <p className="mt-3 text-sm font-semibold text-white">
                Drop your .apkg or .colpkg file here
              </p>
              <p className="mt-1 text-xs text-brand-100">or click below to browse · max 80 MB</p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={parsing || loadingExample}
                  onClick={() => fileRef.current?.click()}
                  className="btn-brand inline-flex items-center gap-2 rounded-lg bg-grad-brand px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {parsing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Parsing deck…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Choose deck file
                    </>
                  )}
                </button>
                <ExampleDeckButton
                  loading={loadingExample}
                  onClick={() => void handleLoadExample()}
                />
              </div>
            </div>

            <label className="flex items-start gap-3 text-sm text-brand-100">
              <input
                type="checkbox"
                checked={cardsOnly}
                onChange={(e) => setCardsOnly(e.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="font-semibold text-white">SRS deck only</span> — import cards for
                spaced repetition without creating a practice quiz. Uncheck to also generate
                placeholder Words-in-Context questions.
              </span>
            </label>

            {importMeta ? (
              <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-400/30">
                Parsed <strong>{drafts.length}</strong> cards from &ldquo;{importMeta.deckName}
                &rdquo; ({importMeta.noteCount} notes in file).
              </p>
            ) : null}
          </div>
        ) : mode === "topic" ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-black text-white">AI topic preset</h2>
              <p className="mt-1 text-sm text-brand-100">
                Generates ~10 SAT-ready cards with passages and quiz questions.
              </p>
            </div>
            <AdminField label="Topic">
              <select value={topic} onChange={(e) => setTopic(e.target.value)} className={inputCls}>
                {TOPICS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Quiz title (optional)">
              <input
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                placeholder="Defaults to today's date"
                className={inputCls}
              />
            </AdminField>
            <button
              type="button"
              disabled={generating}
              onClick={() => void handleGenerate()}
              className="inline-flex items-center gap-2 rounded-lg bg-grad-brand px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generate with AI
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-black text-white">AI word list</h2>
              <p className="mt-1 text-sm text-brand-100">
                Paste words and AI fills in definitions, passages, and quiz items.
              </p>
            </div>
            <AdminField label="Words (comma or newline separated)">
              <textarea
                value={words}
                onChange={(e) => setWords(e.target.value)}
                rows={4}
                placeholder="plastic, malleable, ephemeral..."
                className={inputCls + " font-mono"}
              />
            </AdminField>
            <AdminField label="Quiz title (optional)">
              <input
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                placeholder="Defaults to today's date"
                className={inputCls}
              />
            </AdminField>
            <button
              type="button"
              disabled={generating}
              onClick={() => void handleGenerate()}
              className="inline-flex items-center gap-2 rounded-lg bg-grad-brand px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generate with AI
            </button>
          </div>
        )}

        {error ? (
          <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200 ring-1 ring-red-400/30">
            {error}
          </p>
        ) : null}
        {warnings.length > 0 ? (
          <ul className="space-y-1 text-sm text-amber-200">
            {warnings.map((w) => (
              <li key={w}>· {w}</li>
            ))}
          </ul>
        ) : null}
      </Panel>

      {drafts.length > 0 ? (
        <VocabPreviewPanel
          drafts={drafts}
          saving={saving}
          fixing={fixing}
          fixingIndex={fixingIndex}
          showQuizFields={showQuizFields}
          saveLabel={saveLabel}
          onSave={() => void handleSave()}
          onChange={updateDraft}
          onSetReviewed={setDraftReviewed}
          onFixOne={(i) => void fixDraftAt(i)}
          onFixMany={() => void fixManyDrafts()}
          onStopFix={() => {
            fixStopRef.current = true;
          }}
          onRemove={removeDraft}
        />
      ) : null}
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-brand-400/40 bg-brand-800 px-3 py-2 text-sm text-white placeholder:text-brand-200/60";

function AdminField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-semibold text-brand-100">{label}</label>
      {children}
    </div>
  );
}
