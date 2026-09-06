import { useEffect, useRef, useState } from "react";
import {
  ImageIcon,
  Loader2,
  Sparkles,
  Undo2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { MixedMathEditor } from "@/components/MixedMathEditor";
import {
  cloneAdminQuestion,
  emptyAdminQuestion,
  type AdminQuestion,
} from "@/lib/admin/question";
import {
  askQuestionWithGemini,
  fixQuestionWithGemini,
} from "@/lib/admin/question-ai";
import { uploadQuestionImage } from "@/lib/import/upload-question-image";
import { supabase } from "@/integrations/supabase/client";
import { resolveDisplayUrl, toPersistableImageRef } from "@/lib/storage-url";
import {
  LETTER_DIFFICULTIES,
  MATH_SKILLS,
  MONTHS,
  RW_SKILLS,
  type Difficulty,
  type Section,
} from "@/lib/sat";

const CONTROL_CLASS =
  "w-full rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2 text-sm text-white [color-scheme:dark] placeholder:text-brand-200 focus:border-brand-200 focus:outline-none";

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

export function QuestionEditModal({
  initial,
  onClose,
  onSaved,
  showAddAnother = false,
}: {
  initial: AdminQuestion;
  onClose: () => void;
  /** Called after a successful DB write with the saved question (may have a new id). */
  onSaved: (saved: AdminQuestion, opts: { addAnother: boolean }) => void;
  showAddAnother?: boolean;
}) {
  const [editing, setEditing] = useState(() => cloneAdminQuestion(initial));
  const [carryOver, setCarryOver] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiBusy, setAiBusy] = useState<"ask" | "fix" | null>(null);
  const [instruction, setInstruction] = useState("");
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<AdminQuestion | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const aiAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    setEditing(cloneAdminQuestion(initial));
    setInstruction("");
    setAiNote(null);
    setAiError(null);
    setUndoSnapshot(null);
  }, [initial]);

  useEffect(() => {
    return () => {
      aiAbort.current?.abort();
    };
  }, []);

  const skills = editing.section === "reading_writing" ? RW_SKILLS : MATH_SKILLS;
  const busy = saving || uploading || aiBusy != null;
  const [imageSrc, setImageSrc] = useState<string | null>(editing.image_url);

  useEffect(() => {
    let live = true;
    const raw = editing.image_url;
    if (!raw) {
      setImageSrc(null);
      return;
    }
    if (/^data:/i.test(raw)) {
      setImageSrc(raw);
      return;
    }
    void resolveDisplayUrl(raw).then((url) => {
      if (live) setImageSrc(url);
    });
    return () => {
      live = false;
    };
  }, [editing.image_url]);

  async function uploadImage(file: File) {
    setUploading(true);
    setAiError(null);
    try {
      const path = await uploadQuestionImage(file);
      setEditing((q) => ({ ...q, image_url: path }));
    } catch (err) {
      setAiError((err as Error)?.message ?? "That image could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  async function runAsk() {
    if (aiBusy) return;
    aiAbort.current?.abort();
    const ac = new AbortController();
    aiAbort.current = ac;
    setAiBusy("ask");
    setAiError(null);
    setAiNote(null);
    try {
      const snap = cloneAdminQuestion(editing);
      const out = await askQuestionWithGemini(editing, instruction, { signal: ac.signal });
      setUndoSnapshot(snap);
      setEditing(out.question);
      setAiNote(
        out.changedKeys.length > 0
          ? `Updated: ${out.changedKeys.join(", ")}${out.fallback ? " (backup model)" : ""}`
          : out.fallback
            ? "No field changes (backup model)."
            : "No field changes.",
      );
      setInstruction("");
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setAiError((err as Error)?.message ?? "Ask Gemini failed.");
    } finally {
      setAiBusy(null);
    }
  }

  async function runFix() {
    if (aiBusy) return;
    aiAbort.current?.abort();
    const ac = new AbortController();
    aiAbort.current = ac;
    setAiBusy("fix");
    setAiError(null);
    setAiNote(null);
    try {
      const snap = cloneAdminQuestion(editing);
      const out = await fixQuestionWithGemini(editing, { signal: ac.signal });
      setUndoSnapshot(snap);
      setEditing(out.question);
      setAiNote(
        out.changedKeys.length > 0
          ? `Fixed: ${out.changedKeys.join(", ")}${out.fallback ? " (backup model)" : ""}`
          : out.fallback
            ? "No field changes (backup model)."
            : "No field changes.",
      );
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setAiError((err as Error)?.message ?? "Fix with AI failed.");
    } finally {
      setAiBusy(null);
    }
  }

  function undoAi() {
    if (!undoSnapshot) return;
    setEditing(cloneAdminQuestion(undoSnapshot));
    setUndoSnapshot(null);
    setAiNote("Undid the last AI change.");
    setAiError(null);
  }

  async function save(opts: { addAnother?: boolean } = {}) {
    if (busy) return;
    setSaving(true);
    setAiError(null);
    try {
      const payload = {
        section: editing.section,
        skill: editing.skill,
        difficulty: editing.difficulty,
        kind: editing.kind,
        prompt: editing.prompt || null,
        question_text: editing.question_text,
        choices: editing.kind === "multiple_choice" ? editing.choices : [],
        correct_choice_id: editing.kind === "multiple_choice" ? editing.correct_choice_id : null,
        correct_grid_answers: editing.kind === "grid_in" ? editing.correct_grid_answers : null,
        explanation: editing.explanation || null,
        image_url: toPersistableImageRef(editing.image_url),
        source_month: editing.source_month,
        source_year: editing.source_year,
        time_limit_seconds: editing.time_limit_seconds,
      };

      let saved = editing;
      if (editing.id) {
        const { error } = await supabase.from("questions").update(payload).eq("id", editing.id);
        if (error) throw new Error(error.message);
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from("questions")
          .insert({ ...payload, created_by: u.user?.id })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        saved = { ...editing, id: data?.id ?? "" };
      }

      if (opts.addAnother) {
        const base = emptyAdminQuestion();
        const next = carryOver
          ? {
              ...base,
              section: editing.section,
              skill: editing.skill,
              difficulty: editing.difficulty,
              kind: editing.kind,
              source_month: editing.source_month,
              source_year: editing.source_year,
              time_limit_seconds: editing.time_limit_seconds,
            }
          : base;
        setEditing(next);
        setUndoSnapshot(null);
        setAiNote(null);
        setInstruction("");
        onSaved(saved, { addAnother: true });
        return;
      }

      onSaved(saved, { addAnother: false });
    } catch (err) {
      setAiError((err as Error)?.message ?? "Could not save the question.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-brand-900/60 p-4 backdrop-blur-sm">
      <div className="pop-in my-8 w-full max-w-2xl rounded-2xl border border-brand-400/40 bg-brand-600 shadow-float">
        <div className="flex items-center justify-between border-b border-brand-400/30 px-6 py-4">
          <h3 className="text-lg font-bold text-white">
            {editing.id ? "Edit question" : "New question"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-800 hover:text-white disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Section">
              <select
                value={editing.section}
                disabled={busy}
                onChange={(e) => {
                  const s = e.target.value as Section;
                  setEditing({
                    ...editing,
                    section: s,
                    skill: s === "math" ? "Algebra" : "Craft and Structure",
                  });
                }}
                className={CONTROL_CLASS + " disabled:opacity-40"}
              >
                <option value="math">Math</option>
                <option value="reading_writing">Reading &amp; Writing</option>
              </select>
            </Field>
            <Field label="Skill">
              <select
                value={editing.skill}
                disabled={busy}
                onChange={(e) => setEditing({ ...editing, skill: e.target.value })}
                className={CONTROL_CLASS + " disabled:opacity-40"}
              >
                {skills.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Difficulty">
              <select
                value={editing.difficulty}
                disabled={busy}
                onChange={(e) =>
                  setEditing({ ...editing, difficulty: e.target.value as Difficulty })
                }
                className={CONTROL_CLASS + " disabled:opacity-40"}
              >
                {LETTER_DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d} {d === "S" ? "(highest)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Kind">
              <select
                value={editing.kind}
                disabled={busy}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    kind: e.target.value as AdminQuestion["kind"],
                  })
                }
                className={CONTROL_CLASS + " disabled:opacity-40"}
              >
                <option value="multiple_choice">Multiple choice</option>
                <option value="grid_in">Grid-in</option>
              </select>
            </Field>
            <Field label="Source month">
              <select
                value={editing.source_month ?? ""}
                disabled={busy}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    source_month: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className={CONTROL_CLASS + " disabled:opacity-40"}
              >
                <option value="">— None —</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Source year">
              <input
                type="number"
                min={2000}
                max={2099}
                disabled={busy}
                value={editing.source_year ?? ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    source_year: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="e.g. 2023"
                className={CONTROL_CLASS + " disabled:opacity-40"}
              />
            </Field>
            <Field label="Time limit (minutes, optional)">
              <input
                type="number"
                min={0}
                step={0.5}
                disabled={busy}
                value={
                  editing.time_limit_seconds != null
                    ? String(Math.round((editing.time_limit_seconds / 60) * 100) / 100)
                    : ""
                }
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    time_limit_seconds: e.target.value
                      ? Math.round(Number(e.target.value) * 60)
                      : null,
                  })
                }
                placeholder="e.g. 1.5"
                className={CONTROL_CLASS + " disabled:opacity-40"}
              />
            </Field>
          </div>

          <Field label="Image (optional)">
            <div className="flex items-center gap-3">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt=""
                  className="h-16 w-16 rounded-lg border border-brand-400/50 object-cover"
                />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-lg border border-brand-400/50 bg-brand-800">
                  <ImageIcon className="h-6 w-6 text-brand-200" />
                </div>
              )}
              <div className="flex flex-1 flex-col gap-1.5">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void uploadImage(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="tap inline-flex items-center gap-1.5 self-start rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-400 disabled:opacity-40"
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {uploading ? "Uploading…" : editing.image_url ? "Replace image" : "Upload image"}
                </button>
                {editing.image_url && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setEditing({ ...editing, image_url: null })}
                    className="self-start text-[11px] font-semibold text-brand-100 hover:text-white hover:underline disabled:opacity-40"
                  >
                    Remove image
                  </button>
                )}
              </div>
            </div>
            {aiError && (
              <p className="mt-1.5 text-[11px] font-semibold text-amber-100">{aiError}</p>
            )}
          </Field>

          <Field label="Passage / prompt (optional)">
            <MixedMathEditor
              value={editing.prompt ?? ""}
              onChange={(v) => setEditing({ ...editing, prompt: v })}
              rows={3}
              placeholder="Type prose here. Click 'Insert math' to add a live equation…"
            />
          </Field>
          <Field label="Question text">
            <MixedMathEditor
              value={editing.question_text}
              onChange={(v) => setEditing({ ...editing, question_text: v })}
              rows={3}
              placeholder="Type the question. Use 'Insert math' for equations that render live (x^2 → x²)."
            />
          </Field>

          {editing.kind === "multiple_choice" ? (
            <Field label="Choices (mark the correct one)">
              <div className="space-y-2">
                {editing.choices.map((c, i) => (
                  <div key={c.id} className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="correct"
                      checked={editing.correct_choice_id === c.id}
                      disabled={busy}
                      onChange={() => setEditing({ ...editing, correct_choice_id: c.id })}
                      className="mt-3 h-4 w-4 accent-brand-200 [color-scheme:dark]"
                    />
                    <span className="w-6 pt-2 text-sm font-bold text-white">{c.id}</span>
                    <div className="flex-1">
                      <MixedMathEditor
                        value={c.text}
                        onChange={(v) => {
                          const next = [...editing.choices];
                          next[i] = { ...c, text: v };
                          setEditing({ ...editing, choices: next });
                        }}
                        rows={1}
                        singleLine
                        placeholder={`Choice ${c.id}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Field>
          ) : (
            <Field label="Accepted answers (comma-separated)">
              <input
                value={(editing.correct_grid_answers ?? []).join(", ")}
                disabled={busy}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    correct_grid_answers: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className={CONTROL_CLASS + " disabled:opacity-40"}
              />
            </Field>
          )}

          <Field label="Explanation">
            <MixedMathEditor
              value={editing.explanation ?? ""}
              onChange={(v) => setEditing({ ...editing, explanation: v })}
              rows={3}
              placeholder="Explain the answer. Insert math where helpful."
            />
          </Field>

          <div className="rounded-xl border border-brand-400/40 bg-brand-800/80 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-100">
                <Sparkles className="h-3.5 w-3.5 text-brand-200" />
                Ask Gemini
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {undoSnapshot && (
                  <button
                    type="button"
                    onClick={undoAi}
                    disabled={busy}
                    className="tap inline-flex items-center gap-1 rounded-lg border border-brand-400/50 px-2.5 py-1 text-[11px] font-semibold text-brand-100 hover:bg-brand-700 hover:text-white disabled:opacity-40"
                  >
                    <Undo2 className="h-3 w-3" /> Undo AI
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void runFix()}
                  disabled={busy}
                  className="tap inline-flex items-center gap-1 rounded-lg border border-brand-300/50 bg-brand-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-brand-400 disabled:opacity-40"
                >
                  {aiBusy === "fix" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Wand2 className="h-3 w-3" />
                  )}
                  Fix with AI
                </button>
              </div>
            </div>
            <textarea
              value={instruction}
              disabled={busy}
              onChange={(e) => setInstruction(e.target.value)}
              rows={2}
              placeholder="e.g. Fix the LaTeX in choice B"
              className={CONTROL_CLASS + " disabled:opacity-40"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void runAsk();
                }
              }}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-brand-200">
                {aiBusy === "ask"
                  ? "Asking Gemini…"
                  : aiBusy === "fix"
                    ? "Fixing with AI…"
                    : "Ctrl/⌘+Enter to send. Changes stay in the form until you Save."}
              </p>
              <button
                type="button"
                onClick={() => void runAsk()}
                disabled={busy || !instruction.trim()}
                className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                {aiBusy === "ask" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Send
              </button>
            </div>
            {aiNote && <p className="mt-2 text-[11px] font-semibold text-brand-100">{aiNote}</p>}
            {aiError && <p className="mt-2 text-[11px] font-semibold text-amber-100">{aiError}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-400/30 px-6 py-4">
          {showAddAnother ? (
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-brand-100">
              <input
                type="checkbox"
                checked={carryOver}
                disabled={busy}
                onChange={(e) => setCarryOver(e.target.checked)}
                className="h-4 w-4 accent-brand-200 [color-scheme:dark]"
              />
              Carry over section, skill, difficulty, source &amp; timer to next question
            </label>
          ) : (
            <span />
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="tap rounded-lg px-4 py-2 text-sm font-semibold text-brand-100 hover:bg-brand-800 hover:text-white disabled:opacity-40"
            >
              Cancel
            </button>
            {showAddAnother && !editing.id && (
              <button
                type="button"
                onClick={() => void save({ addAnother: true })}
                disabled={busy}
                className="tap rounded-lg border border-brand-300/60 bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-40"
              >
                Save &amp; add another
              </button>
            )}
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Load answer fields revoked from the public questions select. */
export async function loadQuestionWithAnswers(
  q: Pick<
    AdminQuestion,
    | "id"
    | "section"
    | "skill"
    | "difficulty"
    | "kind"
    | "prompt"
    | "question_text"
    | "choices"
    | "image_url"
    | "source_month"
    | "source_year"
    | "time_limit_seconds"
  >,
): Promise<AdminQuestion> {
  const { data } = await supabase.rpc("admin_get_question_answers", {
    p_question_id: q.id,
  });
  const ans = data?.[0] ?? {
    correct_choice_id: null as string | null,
    correct_grid_answers: [] as string[],
    explanation: null as string | null,
  };
  return {
    id: q.id,
    section: q.section,
    skill: q.skill,
    difficulty: q.difficulty,
    kind: q.kind,
    prompt: q.prompt,
    question_text: q.question_text,
    choices: ensureFourChoices(q.choices ?? []),
    correct_choice_id: ans.correct_choice_id ?? null,
    correct_grid_answers: ans.correct_grid_answers ?? [],
    explanation: ans.explanation ?? null,
    image_url: q.image_url,
    source_month: q.source_month,
    source_year: q.source_year,
    time_limit_seconds: q.time_limit_seconds ?? null,
  };
}

function ensureFourChoices(
  choices: { id: string; text: string }[],
): AdminQuestion["choices"] {
  return (["A", "B", "C", "D"] as const).map((id) => {
    const existing = choices.find((c) => c.id === id);
    return { id, text: existing?.text ?? "" };
  });
}
