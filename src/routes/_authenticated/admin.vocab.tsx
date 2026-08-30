import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Loader2, Sparkles, Save, Trash2, Upload, FileUp } from "lucide-react";
import { generateVocabContent, saveVocabContent } from "@/lib/vocab/client";
import type { DifficultyTier, GeneratedVocabItem } from "@/lib/vocab/types";
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

export const Route = createFileRoute("/_authenticated/admin/vocab")({
  component: AdminVocabPage,
  head: () => ({ meta: [{ title: "Vocab — Admin" }] }),
});

type InputMode = "topic" | "words" | "anki";

function AdminVocabPage() {
  const [words, setWords] = useState("");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [quizTitle, setQuizTitle] = useState("");
  const [generating, setGenerating] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importMeta, setImportMeta] = useState<{ deckName: string; noteCount: number } | null>(
    null,
  );
  const [items, setItems] = useState<GeneratedVocabItem[]>([]);
  const [mode, setMode] = useState<InputMode>("anki");
  const [cardsOnly, setCardsOnly] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setWarnings([]);
    setImportMeta(null);
    try {
      const result = await generateVocabContent(
        mode === "words" ? { words } : { topic, count: 10 },
      );
      setItems(result);
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
    setItems([]);
    try {
      const { parseApkgFile } = await import("@/lib/vocab/parse-apkg");
      const result = await parseApkgFile(file);
      setItems(result.items);
      setImportMeta({ deckName: result.deckName, noteCount: result.noteCount });
      setWarnings(result.warnings);
      setQuizTitle(result.deckName);
      setCardsOnly(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not parse Anki deck");
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!items.length) return;
    setSaving(true);
    setError(null);
    try {
      const importCardsOnly = mode === "anki" && cardsOnly;
      const { quizId, count } = await saveVocabContent({
        items,
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

  function updateItem(i: number, patch: Partial<GeneratedVocabItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  const showQuizFields = mode !== "anki" || !cardsOnly;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <PageHead
        title="Vocabulary"
        subtitle="Import an Anki .apkg deck for SRS review, or generate SAT-specific cards with AI."
      />

      {/* Tab bar — Anki import first and default */}
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
                Export from Anki as <strong className="text-white">.apkg</strong> (File → Export).
                Basic Front/Back note types map automatically.
              </p>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".apkg,.colpkg"
              className="sr-only"
              disabled={parsing}
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
                Drop your .apkg file here
              </p>
              <p className="mt-1 text-xs text-brand-100">
                or click below to browse · max 80 MB
              </p>
              <button
                type="button"
                disabled={parsing}
                onClick={() => fileRef.current?.click()}
                className="btn-brand mt-5 inline-flex items-center gap-2 rounded-lg bg-grad-brand px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {parsing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Parsing deck…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Choose .apkg file
                  </>
                )}
              </button>
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
                Parsed <strong>{items.length}</strong> cards from &ldquo;{importMeta.deckName}
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
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className={inputCls}
              >
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

      {items.length > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Preview ({items.length})</h2>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {mode === "anki" && cardsOnly ? "Import to SRS deck" : "Save to database"}
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, i) => (
              <Panel key={i} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <input
                    value={item.word}
                    onChange={(e) => updateItem(i, { word: e.target.value })}
                    className="w-full bg-transparent text-xl font-black text-white border-b border-brand-400/30 focus:border-brand-200 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="text-brand-200 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Part of speech"
                    value={item.partOfSpeech}
                    onChange={(v) => updateItem(i, { partOfSpeech: v })}
                  />
                  <Field
                    label="Difficulty"
                    value={item.difficultyTier ?? "Medium"}
                    onChange={(v) => updateItem(i, { difficultyTier: v as DifficultyTier })}
                  />
                </div>
                <Field
                  label="Definition"
                  value={item.definition}
                  onChange={(v) => updateItem(i, { definition: v })}
                  multiline
                />
                <Field
                  label="dSAT passage"
                  value={item.dSatPassage}
                  onChange={(v) => updateItem(i, { dSatPassage: v })}
                  multiline
                />
                <Field
                  label="Roots / etymology"
                  value={item.rootsEtymology ?? ""}
                  onChange={(v) => updateItem(i, { rootsEtymology: v })}
                />
                <Field
                  label="Synonyms (comma-separated)"
                  value={item.synonyms.join(", ")}
                  onChange={(v) =>
                    updateItem(i, {
                      synonyms: v
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
                <Field
                  label="SAT traps"
                  value={item.satTraps ?? ""}
                  onChange={(v) => updateItem(i, { satTraps: v })}
                  multiline
                />
                {showQuizFields ? (
                  <div className="rounded-lg border border-brand-400/30 bg-brand-800/40 p-3 space-y-2">
                    <div className="text-xs font-bold uppercase text-brand-200">Quiz question</div>
                    <Field
                      label="Passage"
                      value={item.quizQuestion.passageText}
                      onChange={(v) =>
                        updateItem(i, {
                          quizQuestion: { ...item.quizQuestion, passageText: v },
                        })
                      }
                      multiline
                    />
                    <Field
                      label="Options (comma-separated, 4)"
                      value={item.quizQuestion.options.join(", ")}
                      onChange={(v) =>
                        updateItem(i, {
                          quizQuestion: {
                            ...item.quizQuestion,
                            options: v
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          },
                        })
                      }
                    />
                    <Field
                      label="Correct answer"
                      value={item.quizQuestion.correctAnswer}
                      onChange={(v) =>
                        updateItem(i, {
                          quizQuestion: { ...item.quizQuestion, correctAnswer: v },
                        })
                      }
                    />
                    <Field
                      label="Explanation"
                      value={item.quizQuestion.explanation}
                      onChange={(v) =>
                        updateItem(i, {
                          quizQuestion: { ...item.quizQuestion, explanation: v },
                        })
                      }
                      multiline
                    />
                  </div>
                ) : null}
              </Panel>
            ))}
          </div>
        </>
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

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-brand-200">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className={inputCls}
        />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      )}
    </div>
  );
}
