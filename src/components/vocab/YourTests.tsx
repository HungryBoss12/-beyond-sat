import { useCallback, useEffect, useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createOwnedTest,
  deleteOwnedTest,
  fetchMyTests,
  fetchReadableDecks,
  fetchTestQuota,
  generateTestQuestions,
  submitForReview,
  type ManualQuestion,
  type OwnedQuiz,
  type ReadableDeck,
  type TestQuota,
} from "@/lib/vocab/user-content";

const field =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-400";

const emptyQuestion = (): ManualQuestion => ({
  passage: "",
  options: ["", "", "", ""],
  answer: "",
  explanation: "",
});

export function YourTests({ onChanged }: { onChanged?: () => void }) {
  const [tests, setTests] = useState<OwnedQuiz[]>([]);
  const [quota, setQuota] = useState<TestQuota>({ cap: 5, used: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, nextQuota] = await Promise.all([fetchMyTests(), fetchTestQuota()]);
      setTests(rows);
      setQuota(nextQuota);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your tests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remaining = Math.max(0, quota.cap - quota.used);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">Your tests</h2>
          <p className="mt-1 text-sm text-slate-600">
            {remaining} of {quota.cap} left today. Private until you apply.
          </p>
        </div>
        <button
          type="button"
          disabled={remaining <= 0}
          onClick={() => setOpen(true)}
          className="tap shrink-0 rounded-xl bg-brand-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          New test
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
        </div>
      ) : tests.length === 0 ? (
        <Panel className="p-4 text-sm text-brand-100">No private tests yet.</Panel>
      ) : (
        <div className="space-y-3">
          {tests.map((quiz) => (
            <Panel key={quiz.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <h3 className="font-bold text-white">{quiz.title}</h3>
                <p className="mt-1 text-xs text-white/60">
                  {quiz.visibility === "pending" ? "Waiting for review" : "Private"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm(`Delete "${quiz.title}"?`)) return;
                    void deleteOwnedTest(quiz.id)
                      .then(() => {
                        void load();
                        onChanged?.();
                      })
                      .catch((e: unknown) =>
                        setError(e instanceof Error ? e.message : "Could not delete the test"),
                      );
                  }}
                  className="tap rounded-lg px-2.5 py-1.5 text-xs font-bold text-white ring-1 ring-white/30 hover:bg-white/10"
                >
                  Delete
                </button>
                <button
                  type="button"
                  disabled={quiz.visibility === "pending"}
                  onClick={() =>
                    void submitForReview("test", quiz.id)
                      .then(() => load())
                      .catch((e: unknown) =>
                        setError(e instanceof Error ? e.message : "Could not send the test"),
                      )
                  }
                  className="tap rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-brand-700 disabled:opacity-50"
                >
                  {quiz.visibility === "pending" ? "Sent" : "Apply test"}
                </button>
              </div>
            </Panel>
          ))}
        </div>
      )}
      <NewTestDialog
        open={open}
        publishNow={false}
        onOpenChange={setOpen}
        onCreated={() => {
          setOpen(false);
          void load();
          onChanged?.();
        }}
      />
    </div>
  );
}

export function NewTestDialog({
  open,
  publishNow,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  publishNow: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<ManualQuestion[]>([emptyQuestion()]);
  const [decks, setDecks] = useState<ReadableDeck[]>([]);
  const [deckId, setDeckId] = useState("");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("Medium");
  const [prompt, setPrompt] = useState<"word" | "definition">("word");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setQuestions([emptyQuestion()]);
    setMode("manual");
    setError(null);
    setCount(5);
    setDifficulty("Medium");
    setPrompt("word");
    void fetchReadableDecks()
      .then((rows) => {
        setDecks(rows);
        setDeckId(rows[0]?.id ?? "");
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load decks"));
  }, [open]);

  function patchQuestion(index: number, patch: Partial<ManualQuestion>) {
    setQuestions((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function generate() {
    if (!deckId) {
      setError("Pick a deck first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const generated = await generateTestQuestions({ deckId, count, difficulty, prompt });
      setQuestions(generated);
      setMode("manual");
      if (!title.trim()) {
        const deck = decks.find((row) => row.id === deckId);
        setTitle(deck ? `${deck.title} practice` : "Practice test");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate the test");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await createOwnedTest({ title, questions, publish: publishNow });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the test");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle>{publishNow ? "New published test" : "New test"}</DialogTitle>
          <DialogDescription>
            {publishNow
              ? "This test goes on the main list right away."
              : "Write the questions yourself, or generate them from a deck you can read."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={
              "tap rounded-lg px-3 py-1.5 text-sm font-bold " +
              (mode === "manual" ? "bg-brand-600 text-white" : "text-slate-600 ring-1 ring-slate-200")
            }
          >
            Write it
          </button>
          <button
            type="button"
            onClick={() => setMode("ai")}
            className={
              "tap rounded-lg px-3 py-1.5 text-sm font-bold " +
              (mode === "ai" ? "bg-brand-600 text-white" : "text-slate-600 ring-1 ring-slate-200")
            }
          >
            Generate
          </button>
        </div>
        <label className="block text-sm font-semibold text-slate-700">
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={field + " mt-1"} />
        </label>
        {mode === "ai" ? (
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700">
              Deck
              <select value={deckId} onChange={(e) => setDeckId(e.target.value)} className={field + " mt-1"}>
                {decks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.title}
                    {deck.visibility !== "published" ? " (yours)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-sm font-semibold text-slate-700">
                Questions
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className={field + " mt-1"}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Difficulty
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className={field + " mt-1"}
                >
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Prompt
                <select
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value as "word" | "definition")}
                  className={field + " mt-1"}
                >
                  <option value="word">Show the word</option>
                  <option value="definition">Show the definition</option>
                </select>
              </label>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void generate()}
              className="tap inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
              Generate questions
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((question, index) => (
              <div key={index} className="space-y-2 rounded-xl border border-slate-200 p-3">
                <label className="block text-sm font-semibold text-slate-700">
                  Passage
                  <textarea
                    value={question.passage}
                    rows={3}
                    onChange={(e) => patchQuestion(index, { passage: e.target.value })}
                    className={field + " mt-1"}
                  />
                </label>
                {question.options.map((option, optionIndex) => (
                  <label key={optionIndex} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name={`correct-${index}`}
                      checked={question.answer === option && option.trim().length > 0}
                      onChange={() => patchQuestion(index, { answer: option })}
                    />
                    <input
                      value={option}
                      placeholder={`Option ${optionIndex + 1}`}
                      onChange={(e) => {
                        const options = [...question.options];
                        const previous = options[optionIndex];
                        options[optionIndex] = e.target.value;
                        patchQuestion(index, {
                          options,
                          answer: question.answer === previous ? e.target.value : question.answer,
                        });
                      }}
                      className={field}
                    />
                  </label>
                ))}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
              className="text-sm font-bold text-brand-700"
            >
              Add a question
            </button>
          </div>
        )}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="tap inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {publishNow ? "Publish test" : "Save test"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
