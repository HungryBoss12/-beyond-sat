import { useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { MathText } from "@/components/MathText";
import {
  QuestionCard,
  emptyAnswer,
  type QuestionRow,
} from "@/components/QuestionCard";
import {
  LETTER_DIFFICULTIES,
  SECTION_LABEL,
  skillsFor,
  type LetterDifficulty,
  type Section,
} from "@/lib/sat";
import { SQB_DIFFICULTIES } from "@/lib/sqb";
import type { Draft } from "@/lib/import/parse";
import { uploadQuestionImage } from "@/lib/import/upload-question-image";
import { resolveDisplayUrl } from "@/lib/storage-url";
import { CONTROL_CLASS } from "./types";
import { Field } from "./field";
import { AdminSelect } from "@/components/admin/AdminSelect";

const CHOICE_IDS = ["A", "B", "C", "D"] as const;

export type DraftEditorPatch = {
  number?: number;
  rec?: Record<string, string>;
};

function patchRec(
  rec: Record<string, string>,
  patch: Record<string, string>,
): Record<string, string> {
  return { ...rec, ...patch };
}

function draftModuleOf(rec: Record<string, string>): 1 | 2 {
  return rec.module === "2" ? 2 : 1;
}

export function DraftEditor({
  draft,
  disabled,
  showModule,
  numberCollision,
  onChange,
  variant = "ordinary",
}: {
  draft: Draft;
  disabled?: boolean;
  showModule?: boolean;
  /** Another draft already uses this module + number. */
  numberCollision?: boolean;
  onChange: (patch: DraftEditorPatch) => void;
  /** SQB shows Assessment / Domain / Subskill / external_id / image_alt. */
  variant?: "ordinary" | "sqb";
}) {
  const rec = draft.rec;
  const section: Section = rec.section === "math" ? "math" : "reading_writing";
  const skills = skillsFor(section);
  const kind = rec.kind === "grid_in" ? "grid_in" : "multiple_choice";
  const answer = (rec.correct ?? "").trim();
  const imageUrl = (rec.image_url ?? "").trim();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState(imageUrl);

  const studentPreview = useMemo((): QuestionRow | null => {
    if (variant !== "sqb") return null;
    const stem = (rec.question_text ?? "").trim();
    const prompt = (rec.prompt ?? "").trim();
    if (!stem && !prompt) return null;
    return {
      id: "draft-preview",
      section,
      skill: rec.skill || skills[0] || "",
      difficulty: rec.difficulty || "C",
      kind,
      prompt: prompt || null,
      question_text: stem || prompt,
      choices:
        kind === "multiple_choice"
          ? CHOICE_IDS.map((id) => ({
              id,
              text: rec[`choice_${id}`] ?? "",
              image_url: rec[`choice_${id}_image`] || null,
            }))
          : null,
      image_url: imageUrl || null,
      bank_format: "sqb",
      external_id: rec.external_id || null,
      domain: rec.domain || rec.skill || null,
      subskill: rec.subskill || null,
      image_alt: rec.image_alt || null,
    };
  }, [variant, section, skills, kind, rec, imageUrl]);

  useEffect(() => {
    let live = true;
    if (!imageUrl) {
      setImageSrc("");
      return;
    }
    if (/^data:/i.test(imageUrl)) {
      setImageSrc(imageUrl);
      return;
    }
    void resolveDisplayUrl(imageUrl).then((url) => {
      if (live) setImageSrc(url ?? imageUrl);
    });
    return () => {
      live = false;
    };
  }, [imageUrl]);

  function setField(key: string, value: string) {
    onChange({ rec: patchRec(rec, { [key]: value }) });
  }

  function setSection(next: Section) {
    const nextSkills = skillsFor(next);
    const skill = nextSkills.includes(rec.skill) ? rec.skill : nextSkills[0];
    onChange({ rec: patchRec(rec, { section: next, skill }) });
  }

  function setKind(next: "multiple_choice" | "grid_in") {
    onChange({ rec: patchRec(rec, { kind: next }) });
  }

  function setNumber(raw: string) {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) return;
    onChange({ number: n });
  }

  return (
    <div className="space-y-3">
      {variant === "sqb" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Assessment">
            <input
              value={rec.assessment ?? "SAT"}
              disabled={disabled}
              onChange={(e) => setField("assessment", e.target.value)}
              className={CONTROL_CLASS + " disabled:opacity-40"}
              placeholder="SAT"
            />
          </Field>
          <Field label="External ID">
            <input
              value={rec.external_id ?? ""}
              disabled={disabled}
              onChange={(e) => setField("external_id", e.target.value)}
              className={CONTROL_CLASS + " disabled:opacity-40"}
              placeholder="e.g. 858fd1cf"
            />
          </Field>
          <Field label="Domain (skill)">
            <AdminSelect
              value={skills.includes(rec.skill) ? rec.skill : skills[0]}
              disabled={disabled}
              onValueChange={(v) => onChange({ rec: patchRec(rec, { skill: v, domain: v }) })}
              options={skills.map((s) => ({ value: s, label: s }))}
            />
          </Field>
          <Field label="Skill (subskill)">
            <input
              value={rec.subskill ?? ""}
              disabled={disabled}
              onChange={(e) => setField("subskill", e.target.value)}
              className={CONTROL_CLASS + " disabled:opacity-40"}
              placeholder="e.g. Circles"
            />
          </Field>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Question number">
          <input
            type="number"
            min={1}
            step={1}
            value={draft.number > 0 ? draft.number : ""}
            disabled={disabled}
            onChange={(e) => setNumber(e.target.value)}
            className={CONTROL_CLASS + " disabled:opacity-40"}
          />
          {numberCollision && (
            <p className="mt-1 text-xs font-semibold text-brand-200">
              {variant === "sqb"
                ? `Another question already uses number ${draft.number}.`
                : `Another question already uses Module ${draftModuleOf(rec)} · ${draft.number}.`}
            </p>
          )}
        </Field>
        {showModule && variant !== "sqb" && (
          <Field label="Module">
            <AdminSelect
              value={rec.module === "2" ? "2" : "1"}
              disabled={disabled}
              onValueChange={(v) => setField("module", v)}
              options={[
                { value: "1", label: "Module 1" },
                { value: "2", label: "Module 2" },
              ]}
            />
          </Field>
        )}
        <Field label="Section">
          <AdminSelect
            value={section}
            disabled={disabled}
            onValueChange={(v) => setSection(v as Section)}
            options={[
              { value: "reading_writing", label: SECTION_LABEL.reading_writing },
              { value: "math", label: SECTION_LABEL.math },
            ]}
          />
        </Field>
        {variant !== "sqb" && (
          <Field label="Skill">
            <AdminSelect
              value={skills.includes(rec.skill) ? rec.skill : skills[0]}
              disabled={disabled}
              onValueChange={(v) => setField("skill", v)}
              options={skills.map((s) => ({ value: s, label: s }))}
            />
          </Field>
        )}
        <Field label="Type">
          <AdminSelect
            value={kind}
            disabled={disabled}
            onValueChange={(v) => setKind(v as "multiple_choice" | "grid_in")}
            options={[
              { value: "multiple_choice", label: "Multiple choice" },
              { value: "grid_in", label: "Grid-in" },
            ]}
          />
        </Field>
        <Field label="Difficulty">
          <AdminSelect
            value={
              variant === "sqb"
                ? SQB_DIFFICULTIES.includes(rec.difficulty as (typeof SQB_DIFFICULTIES)[number])
                  ? rec.difficulty
                  : "C"
                : LETTER_DIFFICULTIES.includes(rec.difficulty as LetterDifficulty)
                  ? rec.difficulty
                  : "C"
            }
            disabled={disabled}
            onValueChange={(v) => setField("difficulty", v)}
            options={(variant === "sqb" ? [...SQB_DIFFICULTIES] : LETTER_DIFFICULTIES).map((d) => ({
              value: d,
              label:
                variant === "sqb"
                  ? `${d}${d === "C" ? " (easiest)" : d === "S" ? " (hardest)" : ""}`
                  : `${d}${d === "A" ? " (hardest)" : d === "C" ? " (easiest)" : ""}`,
            }))}
          />
        </Field>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-100">Figure</p>
        {imageUrl ? (
          <div className="mb-2 overflow-hidden rounded-lg border border-brand-400/40 bg-white">
            <img src={imageSrc || imageUrl} alt="Question figure" className="max-h-48 w-full object-contain" />
          </div>
        ) : (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-dashed border-brand-400/50 bg-brand-900/40 px-3 py-2 text-xs text-brand-100">
            <ImageIcon className="h-4 w-4 shrink-0 text-brand-200" />
            No figure yet — upload one, crop manually, or use Attach figure with AI.
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setUploadError(null);
              setUploading(true);
              void uploadQuestionImage(file)
                .then((url) => setField("image_url", url))
                .catch((err) =>
                  setUploadError((err as Error)?.message ?? "That image could not be uploaded."),
                )
                .finally(() => setUploading(false));
            }}
          />
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => fileRef.current?.click()}
            className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-400/50 bg-brand-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {imageUrl ? "Replace image" : "Upload image"}
          </button>
          {imageUrl ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setField("image_url", "")}
              className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          ) : null}
        </div>
        {uploadError && <p className="mt-1 text-xs font-semibold text-white">{uploadError}</p>}
        {variant === "sqb" && (
          <div className="mt-2">
            <Field label="Image alt (required to publish when figure is set)">
              <input
                value={rec.image_alt ?? ""}
                disabled={disabled}
                onChange={(e) => setField("image_alt", e.target.value)}
                className={CONTROL_CLASS + " disabled:opacity-40"}
                placeholder="Describe the figure for accessibility"
              />
            </Field>
          </div>
        )}
      </div>

      <Field label="Passage / figure notes (optional)">
        <textarea
          value={rec.prompt ?? ""}
          disabled={disabled}
          onChange={(e) => setField("prompt", e.target.value)}
          rows={3}
          className={CONTROL_CLASS + " min-h-[4.5rem] resize-y disabled:opacity-40"}
          placeholder="Wrap underlined words as <u>surveyed</u>"
        />
      </Field>
      {(rec.prompt ?? "").trim() && (
        <div className="rounded-lg bg-brand-900/50 px-3 py-2 text-sm text-white">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-brand-200">
            Passage preview
          </p>
          <MathText>{rec.prompt}</MathText>
        </div>
      )}

      <Field label="Question">
        <textarea
          value={rec.question_text ?? ""}
          disabled={disabled}
          onChange={(e) => setField("question_text", e.target.value)}
          rows={4}
          className={CONTROL_CLASS + " min-h-[5.5rem] resize-y disabled:opacity-40"}
        />
      </Field>
      {(rec.question_text ?? "").trim() && (
        <div className="rounded-lg bg-brand-900/50 px-3 py-2 text-sm text-white">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-brand-200">
            Preview
          </p>
          <MathText>{rec.question_text}</MathText>
        </div>
      )}

      {kind === "multiple_choice" ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-100">Choices</p>
          {CHOICE_IDS.map((id) => (
            <div key={id} className="space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="mt-2 w-5 shrink-0 text-xs font-bold text-brand-200">{id}</span>
                <textarea
                  value={rec[`choice_${id}`] ?? ""}
                  disabled={disabled}
                  onChange={(e) => setField(`choice_${id}`, e.target.value)}
                  rows={2}
                  className={CONTROL_CLASS + " min-h-[2.5rem] resize-y disabled:opacity-40"}
                  placeholder={`Choice ${id} text — use $…$ for math, e.g. $6\\sqrt{3}$`}
                />
              </div>
              {(rec[`choice_${id}`] ?? "").trim() ? (
                <div className="ml-7 rounded-lg bg-brand-900/50 px-3 py-2 text-sm text-white">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-brand-200">
                    Preview
                  </p>
                  <MathText>{rec[`choice_${id}`]}</MathText>
                </div>
              ) : null}
              <DraftChoiceImage
                choiceId={id}
                imageRef={rec[`choice_${id}_image`] ?? ""}
                disabled={disabled}
                onChange={(path) => setField(`choice_${id}_image`, path ?? "")}
              />
            </div>
          ))}
        </div>
      ) : null}

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-100">
          Correct answer
        </p>
        {kind === "multiple_choice" ? (
          <div className="flex flex-wrap gap-1.5">
            {CHOICE_IDS.filter((id) => (rec[`choice_${id}`] ?? "").trim()).map((id) => (
              <button
                key={id}
                type="button"
                disabled={disabled}
                onClick={() => setField("correct", answer.toUpperCase() === id ? "" : id)}
                className={
                  "tap h-8 w-8 rounded-md text-sm font-bold transition-colors disabled:opacity-40 " +
                  (answer.toUpperCase() === id
                    ? "bg-brand-400 text-white"
                    : "bg-brand-800 text-brand-100 ring-1 ring-brand-400/40 hover:bg-brand-500 hover:text-white")
                }
              >
                {id}
              </button>
            ))}
          </div>
        ) : (
          <input
            value={answer}
            disabled={disabled}
            onChange={(e) => setField("correct", e.target.value)}
            placeholder="3/4, 0.75"
            className={CONTROL_CLASS + " w-48 disabled:opacity-40"}
          />
        )}
      </div>

      <Field label="Explanation (optional)">
        <textarea
          value={rec.explanation ?? ""}
          disabled={disabled}
          onChange={(e) => setField("explanation", e.target.value)}
          rows={2}
          className={CONTROL_CLASS + " min-h-[3rem] resize-y disabled:opacity-40"}
        />
      </Field>

      {variant === "sqb" && studentPreview ? (
        <div className="overflow-hidden rounded-xl border border-test-line bg-test-canvas">
          <p className="border-b border-test-line bg-test-chrome px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-test-muted">
            Student preview
          </p>
          <QuestionCard
            q={studentPreview}
            index={Math.max(0, draft.number - 1)}
            answer={emptyAnswer()}
            onChange={() => {}}
            reveal={Boolean(answer)}
            correctChoiceId={
              kind === "multiple_choice" && /^[A-D]$/i.test(answer) ? answer.toUpperCase() : null
            }
          />
        </div>
      ) : null}
    </div>
  );
}

function DraftChoiceImage({
  choiceId,
  imageRef,
  disabled,
  onChange,
}: {
  choiceId: string;
  imageRef: string;
  disabled?: boolean;
  onChange: (path: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState<string | null>(null);
  const raw = imageRef.trim();

  useEffect(() => {
    let live = true;
    if (!raw) {
      setPreview("");
      return;
    }
    if (/^data:/i.test(raw)) {
      setPreview(raw);
      return;
    }
    void resolveDisplayUrl(raw).then((url) => {
      if (live) setPreview(url ?? raw);
    });
    return () => {
      live = false;
    };
  }, [raw]);

  return (
    <div className="ml-7 flex flex-wrap items-center gap-2">
      {preview ? (
        <img
          src={preview}
          alt=""
          className="h-12 w-12 rounded-md border border-brand-400/50 object-cover"
        />
      ) : null}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setUploading(true);
          setError(null);
          void uploadQuestionImage(f)
            .then((path) => onChange(path))
            .catch((err) => setError(err instanceof Error ? err.message : "Upload failed"))
            .finally(() => setUploading(false));
        }}
      />
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => fileRef.current?.click()}
        className="tap inline-flex items-center gap-1 rounded-md border border-brand-400/50 bg-brand-900 px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-400 disabled:opacity-40"
      >
        {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
        {uploading ? "Uploading…" : preview ? `Replace ${choiceId} image` : `Upload ${choiceId} image`}
      </button>
      {preview ? (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => onChange(null)}
          className="text-[11px] font-semibold text-brand-100 hover:text-white hover:underline disabled:opacity-40"
        >
          Remove
        </button>
      ) : null}
      {error ? <p className="w-full text-[11px] font-semibold text-amber-100">{error}</p> : null}
    </div>
  );
}
