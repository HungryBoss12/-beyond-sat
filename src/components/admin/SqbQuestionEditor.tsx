import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ImageIcon,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { MixedMathEditor } from "@/components/MixedMathEditor";
import {
  QuestionCard,
  emptyAnswer,
  type AnswerState,
} from "@/components/QuestionCard";
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
  SECTION_LABEL,
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
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [previewAnswer, setPreviewAnswer] = useState<AnswerState>(() => emptyAnswer());
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    setEditing(cloneAdminQuestion(initial));
    setPreviewAnswer(emptyAnswer());
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

  const previewQ = useMemo(
    () => ({
      id: editing.id || "preview",
      section: editing.section,
      skill: editing.skill,
      difficulty: editing.difficulty as "easy" | "medium" | "hard",
      kind: editing.kind,
      prompt: editing.prompt,
      question_text: editing.question_text,
      choices: editing.choices,
      image_url: imageSrc,
      bank_format: "sqb" as const,
      external_id: editing.external_id,
      domain: resolveDomain(editing),
      subskill: editing.subskill,
      image_alt: editing.image_alt,
    }),
    [editing, imageSrc],
  );

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
    <div className="-mx-4 -mt-2 flex min-h-[calc(100vh-5rem)] flex-col lg:-mx-8">
      <div className="sticky top-14 z-10 flex flex-wrap items-center gap-3 border-b border-brand-400/30 bg-brand-600 px-4 py-3 text-white lg:px-8">
        <Link
          to="/admin/sqb"
          className="tap inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-brand-100 hover:bg-brand-500 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> SQB
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">SQB question editor</div>
          <div className="truncate font-mono text-[11px] text-brand-100">
            {editing.external_id || editing.id || "new draft"}
            {editing.published ? " · published" : " · draft"}
          </div>
        </div>
        <div className="flex gap-1 rounded-full bg-brand-800/60 p-1 lg:hidden">
          {(["edit", "preview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setMobileTab(t)}
              className={
                "tap rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider " +
                (mobileTab === t ? "bg-brand-400 text-white" : "text-brand-100")
              }
            >
              {t}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void persist({ publish: false })}
          className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save draft
        </button>
        <button
          type="button"
          disabled={busy || sqbPublishBlocked(editing)}
          onClick={() => void persist({ publish: true })}
          className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Publish
        </button>
      </div>

      {(errors.length > 0 || warnings.length > 0 || error) && (
        <div className="space-y-1 border-b border-brand-400/30 bg-brand-800 px-4 py-2 lg:px-8">
          {error && <p className="text-sm font-semibold text-red-300">{error}</p>}
          {errors.map((i, idx) => (
            <p key={`e-${idx}`} className="text-xs text-red-200">
              {i.message}
            </p>
          ))}
          {warnings.map((i, idx) => (
            <p key={`w-${idx}`} className="text-xs text-amber-200">
              {i.message}
            </p>
          ))}
        </div>
      )}

      <div className="grid min-h-0 flex-1 lg:grid-cols-2">
        <div
          className={
            "space-y-4 overflow-y-auto bg-brand-600 p-4 text-white lg:border-r lg:border-brand-400/30 lg:p-6 " +
            (mobileTab === "preview" ? "hidden lg:block" : "")
          }
        >
          <div className="flex flex-wrap gap-2 rounded-xl border border-brand-400/40 bg-brand-800/40 p-3 text-[11px] font-semibold uppercase tracking-wider text-brand-100">
            <span>{SECTION_LABEL[editing.section]}</span>
            <span>·</span>
            <span>{resolveDomain(editing) || "Domain"}</span>
            <span>·</span>
            <span>{editing.subskill || "Skill"}</span>
            <span>·</span>
            <span>{editing.difficulty}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
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
                  { value: "multiple_choice", label: "MCQ" },
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
                value={editing.source_month != null ? String(editing.source_month) : ""}
                onValueChange={(v) =>
                  patch({ source_month: v ? Number(v) : null })
                }
                options={[
                  { value: "", label: "—" },
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
          </div>

          <Field label="Prompt / stimulus (optional)">
            <MixedMathEditor
              value={editing.prompt ?? ""}
              onChange={(v) => patch({ prompt: v })}
              rows={3}
              placeholder="Passage / stimulus…"
            />
          </Field>

          <Field label="Stem">
            <MixedMathEditor
              value={editing.question_text}
              onChange={(v) => patch({ question_text: v })}
              rows={4}
              placeholder="Question stem. Use Insert math for equations."
            />
          </Field>

          {editing.kind === "multiple_choice" ? (
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-100">
                Choices
              </span>
              {editing.choices.map((c) => (
                <div key={c.id} className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => patch({ correct_choice_id: c.id })}
                    className={
                      "tap mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold " +
                      (editing.correct_choice_id === c.id
                        ? "bg-brand-400 text-white"
                        : "bg-brand-800 text-brand-100")
                    }
                    title="Mark correct"
                  >
                    {c.id}
                  </button>
                  <div className="min-w-0 flex-1">
                    <MixedMathEditor
                      value={c.text}
                      onChange={(v) =>
                        patch({
                          choices: editing.choices.map((x) =>
                            x.id === c.id ? { ...x, text: v } : x,
                          ),
                        })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
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
              value={editing.explanation ?? ""}
              onChange={(v) => patch({ explanation: v })}
              rows={3}
              placeholder="Explain the answer…"
            />
          </Field>
        </div>

        <div
          className={
            "min-h-0 overflow-hidden bg-test-canvas " +
            (mobileTab === "edit" ? "hidden lg:block" : "")
          }
        >
          <div className="border-b border-test-line bg-test-chrome px-4 py-2 text-xs font-bold uppercase tracking-wider text-test-muted">
            Live student chrome
          </div>
          <div className="flex h-[min(70vh,720px)] flex-col">
            <QuestionCard
              q={previewQ}
              index={0}
              answer={previewAnswer}
              onChange={setPreviewAnswer}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
