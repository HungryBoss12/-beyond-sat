import { useRef, useState } from "react";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { MathText } from "@/components/MathText";
import {
  LETTER_DIFFICULTIES,
  SECTION_LABEL,
  skillsFor,
  type LetterDifficulty,
  type Section,
} from "@/lib/sat";
import type { Draft } from "@/lib/import/parse";
import { uploadQuestionImage } from "@/lib/import/upload-question-image";
import { CONTROL_CLASS } from "./types";
import { Field } from "./field";

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
}: {
  draft: Draft;
  disabled?: boolean;
  showModule?: boolean;
  /** Another draft already uses this module + number. */
  numberCollision?: boolean;
  onChange: (patch: DraftEditorPatch) => void;
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
              Another question already uses Module {draftModuleOf(rec)} · {draft.number}.
            </p>
          )}
        </Field>
        {showModule && (
          <Field label="Module">
            <select
              value={rec.module === "2" ? "2" : "1"}
              disabled={disabled}
              onChange={(e) => setField("module", e.target.value)}
              className={CONTROL_CLASS + " disabled:opacity-40"}
            >
              <option value="1">Module 1</option>
              <option value="2">Module 2</option>
            </select>
          </Field>
        )}
        <Field label="Section">
          <select
            value={section}
            disabled={disabled}
            onChange={(e) => setSection(e.target.value as Section)}
            className={CONTROL_CLASS + " disabled:opacity-40"}
          >
            <option value="reading_writing">{SECTION_LABEL.reading_writing}</option>
            <option value="math">{SECTION_LABEL.math}</option>
          </select>
        </Field>
        <Field label="Skill">
          <select
            value={skills.includes(rec.skill) ? rec.skill : skills[0]}
            disabled={disabled}
            onChange={(e) => setField("skill", e.target.value)}
            className={CONTROL_CLASS + " disabled:opacity-40"}
          >
            {skills.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <select
            value={kind}
            disabled={disabled}
            onChange={(e) => setKind(e.target.value as "multiple_choice" | "grid_in")}
            className={CONTROL_CLASS + " disabled:opacity-40"}
          >
            <option value="multiple_choice">Multiple choice</option>
            <option value="grid_in">Grid-in</option>
          </select>
        </Field>
        <Field label="Difficulty">
          <select
            value={
              LETTER_DIFFICULTIES.includes(rec.difficulty as LetterDifficulty)
                ? rec.difficulty
                : "C"
            }
            disabled={disabled}
            onChange={(e) => setField("difficulty", e.target.value)}
            className={CONTROL_CLASS + " disabled:opacity-40"}
          >
            {LETTER_DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-100">Figure</p>
        {imageUrl ? (
          <div className="mb-2 overflow-hidden rounded-lg border border-brand-400/40 bg-white">
            <img src={imageUrl} alt="Question figure" className="max-h-48 w-full object-contain" />
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
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-100">Choices</p>
          {CHOICE_IDS.map((id) => (
            <div key={id} className="flex items-start gap-2">
              <span className="mt-2 w-5 shrink-0 text-xs font-bold text-brand-200">{id}</span>
              <textarea
                value={rec[`choice_${id}`] ?? ""}
                disabled={disabled}
                onChange={(e) => setField(`choice_${id}`, e.target.value)}
                rows={2}
                className={CONTROL_CLASS + " min-h-[2.5rem] resize-y disabled:opacity-40"}
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
    </div>
  );
}
