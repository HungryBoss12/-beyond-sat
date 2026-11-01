import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ImageIcon,
  LineChart,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { GraphEditorDialog } from "@/components/admin/GraphEditorDialog";
import { MixedMathEditor } from "@/components/MixedMathEditor";
import { extractGraphText, replaceGraphText } from "@/lib/import/graph-text";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  cloneAdminQuestion,
  type AdminQuestion,
} from "@/lib/admin/question";
import { uploadQuestionImage } from "@/lib/import/upload-question-image";
import { supabase } from "@/integrations/supabase/client";
import { resolveDisplayUrl, toPersistableImageRef } from "@/lib/storage-url";
import {
  MATH_SKILLS,
  MONTHS,
  RW_SKILLS,
  type Section,
} from "@/lib/sat";
import {
  SQB_DIFFICULTIES,
  SQB_DIFFICULTY_HINT,
  resolveDomain,
  sqbPublishBlocked,
  validateSqbPublish,
} from "@/lib/sqb";

const CONTROL =
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

export function SqbQuestionEditor({
  initial,
  onSaved,
}: {
  initial: AdminQuestion;
  onSaved?: (saved: AdminQuestion) => void;
}) {
  const [editing, setEditing] = useState(() => cloneAdminQuestion(initial));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [graphOpen, setGraphOpen] = useState(false);

  useEffect(() => {
    setEditing(cloneAdminQuestion(initial));
    setError(null);
  }, [initial]);

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

  const skills = editing.section === "reading_writing" ? RW_SKILLS : MATH_SKILLS;
  const issues = useMemo(() => validateSqbPublish(editing), [editing]);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const busy = saving || uploading;

  async function uploadImage(file: File) {
    setUploading(true);
    setError(null);
    try {
      const path = await uploadQuestionImage(file);
      setEditing((q) => ({ ...q, image_url: path }));
    } catch (err) {
      setError((err as Error)?.message ?? "Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function patch(partial: Partial<AdminQuestion>) {
    setEditing((q) => {
      const next = { ...q, ...partial };
      if (partial.skill != null && !(partial.domain ?? q.domain)?.trim()) {
        next.domain = partial.skill;
      }
      if (partial.section && partial.section !== q.section) {
        const nextSkills = partial.section === "math" ? MATH_SKILLS : RW_SKILLS;
        if (!nextSkills.includes(next.skill as never)) {
          next.skill = nextSkills[0];
          next.domain = nextSkills[0];
        }
      }
      return next;
    });
  }

  async function persist(opts: { publish: boolean }) {
    if (busy) return;
    if (opts.publish && sqbPublishBlocked(editing)) {
      setError("Fix publish blockers before publishing.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const domain = resolveDomain(editing) || null;
      const payload = {
        section: editing.section,
        skill: editing.skill,
        difficulty: editing.difficulty,
        kind: editing.kind,
        prompt: editing.prompt || null,
        question_text: editing.question_text,
        choices:
          editing.kind === "multiple_choice"
            ? editing.choices.map((c) => ({
                id: c.id,
                text: c.text,
                image_url: toPersistableImageRef(c.image_url) ?? null,
              }))
            : [],
        correct_choice_id: editing.kind === "multiple_choice" ? editing.correct_choice_id : null,
        correct_grid_answers: editing.kind === "grid_in" ? editing.correct_grid_answers : null,
        explanation: editing.explanation || null,
        image_url: toPersistableImageRef(editing.image_url),
        source_month: editing.source_month,
        source_year: editing.source_year,
        time_limit_seconds: editing.time_limit_seconds,
        bank_format: "sqb" as const,
        external_id: (editing.external_id ?? "").trim() || null,
        assessment: (editing.assessment ?? "").trim() || "SAT",
        domain,
        subskill: (editing.subskill ?? "").trim() || null,
        image_alt: (editing.image_alt ?? "").trim() || null,
        published: opts.publish,
      };

      let saved = { ...editing, ...payload, domain, published: opts.publish };
      if (editing.id) {
        const { error: upErr } = await supabase.from("questions").update(payload).eq("id", editing.id);
        if (upErr) throw new Error(upErr.message);
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { data, error: inErr } = await supabase
          .from("questions")
          .insert({ ...payload, created_by: u.user?.id })
          .select("id")
          .single();
        if (inErr) throw new Error(inErr.message);
        saved = { ...saved, id: data?.id ?? "" };
      }
      setEditing(saved);
      onSaved?.(saved);
    } catch (err) {
      setError((err as Error)?.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto my-8 w-full max-w-2xl">
      <div className="rounded-2xl border border-brand-400/40 bg-brand-600 text-white shadow-float">
        <div className="flex items-center justify-between border-b border-brand-400/30 px-6 py-4">
          <h3 className="text-lg font-bold text-white">
            {editing.id ? "Edit question" : "New question"}
          </h3>
          <Link
            to="/admin/sqb"
            className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-800 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Link>
        </div>

        {(errors.length > 0 || warnings.length > 0 || error) && (
          <div className="space-y-1 border-b border-brand-400/30 bg-brand-800 px-6 py-2">
            {error && <p className="text-sm font-semibold text-red-300">{error}</p>}
            {errors.map((issue, idx) => (
              <p key={`e-${idx}`} className="text-xs text-red-200">
                {issue.message}
              </p>
            ))}
            {warnings.map((issue, idx) => (
              <p key={`w-${idx}`} className="text-xs text-amber-200">
                {issue.message}
              </p>
            ))}
          </div>
        )}

        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Question ID">
              <input
                className={CONTROL + " font-mono"}
                value={editing.external_id ?? ""}
                onChange={(e) => patch({ external_id: e.target.value })}
                placeholder="e.g. 84b5125b"
              />
            </Field>
            <Field label="Section">
              <AdminSelect
                value={editing.section}
                onValueChange={(v) => patch({ section: v as Section })}
                options={[
                  { value: "math", label: "Math" },
                  { value: "reading_writing", label: "Reading & Writing" },
                ]}
              />
            </Field>
            <Field label="Difficulty">
              <AdminSelect
                value={String(editing.difficulty)}
                onValueChange={(v) => patch({ difficulty: v as AdminQuestion["difficulty"] })}
                options={SQB_DIFFICULTIES.map((d) => ({
                  value: d,
                  label: SQB_DIFFICULTY_HINT[d] ? `${d} (${SQB_DIFFICULTY_HINT[d]})` : d,
                }))}
              />
            </Field>
            <Field label="Domain (skill family)">
              <AdminSelect
                value={editing.skill}
                onValueChange={(v) => patch({ skill: v, domain: v })}
                options={skills.map((s) => ({ value: s, label: s }))}
              />
            </Field>
            <Field label="Skill (subskill)">
              <input
                className={CONTROL}
                value={editing.subskill ?? ""}
                onChange={(e) => patch({ subskill: e.target.value })}
                placeholder="e.g. Circles"
              />
            </Field>
            <Field label="Kind">
              <AdminSelect
                value={editing.kind}
                onValueChange={(v) =>
                  patch({ kind: v as AdminQuestion["kind"] })
                }
                options={[
                  { value: "multiple_choice", label: "Multiple choice" },
                  { value: "grid_in", label: "Grid-in" },
                ]}
              />
            </Field>
            <Field label="Source year">
              <input
                type="number"
                className={CONTROL}
                value={editing.source_year ?? ""}
                onChange={(e) =>
                  patch({
                    source_year: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </Field>
            <Field label="Source month">
              <AdminSelect
                value={editing.source_month != null ? String(editing.source_month) : "none"}
                onValueChange={(v) =>
                  patch({ source_month: v === "none" ? null : Number(v) })
                }
                options={[
                  { value: "none", label: "—" },
                  ...MONTHS.map((m, i) => ({ value: String(i + 1), label: m })),
                ]}
              />
            </Field>
          </div>

          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-brand-100">
              Figure
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadImage(f);
                e.target.value = "";
              }}
            />
            {imageSrc ? (
              <div className="relative overflow-hidden rounded-xl border border-brand-400/40 bg-brand-800">
                <img src={imageSrc} alt={editing.image_alt ?? ""} className="max-h-56 w-full object-contain" />
                <button
                  type="button"
                  onClick={() => patch({ image_url: null, image_alt: null })}
                  className="tap absolute right-2 top-2 rounded-lg bg-brand-900/80 p-1.5 text-white"
                  aria-label="Remove figure"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="tap flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-brand-400/50 bg-brand-800/40 px-4 py-8 text-brand-100 hover:bg-brand-800"
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <ImageIcon className="h-6 w-6" />
                )}
                <span className="text-sm font-semibold">Drop or upload figure</span>
              </button>
            )}
            <div className="mt-2">
              <Field label="Figure alt text">
                <input
                  className={CONTROL}
                  value={editing.image_alt ?? ""}
                  onChange={(e) => patch({ image_alt: e.target.value })}
                  placeholder="Describe the figure"
                />
              </Field>
            </div>
            {editing.image_url && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="tap mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-100 hover:text-white"
              >
                <Upload className="h-3.5 w-3.5" /> Replace figure
              </button>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setGraphOpen(true)}
                className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-1.5 text-xs font-semibold text-white"
              >
                <LineChart className="h-3.5 w-3.5" />
                {extractGraphText(editing.prompt ?? "") ? "Edit graph" : "Add graph"}
              </button>
              {extractGraphText(editing.prompt ?? "") ? (
                <button
                  type="button"
                  onClick={() => patch({ prompt: replaceGraphText(editing.prompt ?? "", "") })}
                  className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove graph
                </button>
              ) : null}
            </div>
            <GraphEditorDialog
              open={graphOpen}
              graphText={extractGraphText(editing.prompt ?? "")}
              math={editing.section === "math"}
              onOpenChange={setGraphOpen}
              onDone={(graph) => patch({ prompt: replaceGraphText(editing.prompt ?? "", graph) })}
            />
          </div>

          <Field label="Prompt / stimulus (optional)">
            <MixedMathEditor
              math={editing.section === "math"}
              value={replaceGraphText(editing.prompt ?? "", "")}
              onChange={(v) =>
                patch({ prompt: replaceGraphText(v, extractGraphText(editing.prompt ?? "")) })
              }
              rows={3}
              placeholder="Passage / stimulus…"
            />
          </Field>

          <Field label="Stem">
            <MixedMathEditor
              math={editing.section === "math"}
              value={editing.question_text}
              onChange={(v) => patch({ question_text: v })}
              rows={4}
              placeholder="Question stem. Use Insert math for equations."
            />
          </Field>

          {editing.kind === "multiple_choice" ? (
            <Field label="Choices (mark the correct one)">
              <div className="space-y-3">
                {editing.choices.map((c) => (
                  <div key={c.id} className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="sqb-correct"
                      checked={editing.correct_choice_id === c.id}
                      onChange={() => patch({ correct_choice_id: c.id })}
                      className="mt-3 h-4 w-4 accent-brand-200 [color-scheme:dark]"
                    />
                    <span className="w-6 pt-2 text-sm font-bold text-white">{c.id}</span>
                    <div className="min-w-0 flex-1">
                      <MixedMathEditor
                        math={editing.section === "math"}
                        value={c.text}
                        onChange={(v) =>
                          patch({
                            choices: editing.choices.map((x) =>
                              x.id === c.id ? { ...x, text: v } : x,
                            ),
                          })
                        }
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
            <Field label="Acceptable grid-in answers (comma-separated)">
              <input
                className={CONTROL}
                value={(editing.correct_grid_answers ?? []).join(", ")}
                onChange={(e) =>
                  patch({
                    correct_grid_answers: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </Field>
          )}

          <Field label="Explanation">
            <MixedMathEditor
              math={editing.section === "math"}
              value={editing.explanation ?? ""}
              onChange={(v) => patch({ explanation: v })}
              rows={3}
              placeholder="Explain the answer. Insert math where helpful."
            />
          </Field>
        </div>

        <div className="flex items-center justify-between border-t border-brand-400/30 px-6 py-4">
          <Link
            to="/admin/sqb"
            className="tap rounded-lg px-4 py-2 text-sm font-semibold text-brand-100 hover:bg-brand-800 hover:text-white"
          >
            Cancel
          </Link>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void persist({ publish: false })}
              className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-300/60 bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save draft
            </button>
            <button
              type="button"
              disabled={busy || sqbPublishBlocked(editing)}
              onClick={() => void persist({ publish: true })}
              className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Publish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
