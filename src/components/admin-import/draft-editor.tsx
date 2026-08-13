import { MathText } from "@/components/MathText";
import {
  LETTER_DIFFICULTIES,
  SECTION_LABEL,
  skillsFor,
  type LetterDifficulty,
  type Section,
} from "@/lib/sat";
import type { Draft } from "@/lib/import/parse";
import { CONTROL_CLASS } from "./types";
import { Field } from "./field";

const CHOICE_IDS = ["A", "B", "C", "D"] as const;

function patchRec(
  rec: Record<string, string>,
  patch: Record<string, string>,
): Record<string, string> {
  return { ...rec, ...patch };
}

export function DraftEditor({
  draft,
  disabled,
  onChange,
}: {
  draft: Draft;
  disabled?: boolean;
  onChange: (rec: Record<string, string>) => void;
}) {
  const rec = draft.rec;
  const section: Section = rec.section === "math" ? "math" : "reading_writing";
  const skills = skillsFor(section);
  const kind = rec.kind === "grid_in" ? "grid_in" : "multiple_choice";
  const answer = (rec.correct ?? "").trim();

  function setField(key: string, value: string) {
    onChange(patchRec(rec, { [key]: value }));
  }

  function setSection(next: Section) {
    const nextSkills = skillsFor(next);
    const skill = nextSkills.includes(rec.skill) ? rec.skill : nextSkills[0];
    onChange(patchRec(rec, { section: next, skill }));
  }

  function setKind(next: "multiple_choice" | "grid_in") {
    onChange(patchRec(rec, { kind: next }));
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
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

      <Field label="Passage / figure notes (optional)">
        <textarea
          value={rec.prompt ?? ""}
          disabled={disabled}
          onChange={(e) => setField("prompt", e.target.value)}
          rows={3}
          className={CONTROL_CLASS + " min-h-[4.5rem] resize-y disabled:opacity-40"}
        />
      </Field>

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
