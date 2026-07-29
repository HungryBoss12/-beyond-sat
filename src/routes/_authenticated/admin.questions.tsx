import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  RW_SKILLS,
  MATH_SKILLS,
  SECTION_LABEL,
  LETTER_DIFFICULTIES,
  MONTHS,
  formatSourceDate,
  difficultyColor,
  type Section,
  type Difficulty,
} from "@/lib/sat";
import { Plus, Trash2, Edit3, X, ImageIcon, Loader2, Upload } from "lucide-react";
import { MixedMathEditor } from "@/components/MixedMathEditor";

type Choice = { id: string; text: string };
type Question = {
  id: string;
  section: Section;
  skill: string;
  difficulty: Difficulty;
  kind: "multiple_choice" | "grid_in";
  prompt: string | null;
  question_text: string;
  choices: Choice[];
  correct_choice_id: string | null;
  correct_grid_answers: string[] | null;
  explanation: string | null;
  image_url: string | null;
  source_month: number | null;
  source_year: number | null;
  time_limit_seconds: number | null;
};

export const Route = createFileRoute("/_authenticated/admin/questions")({
  component: AdminQuestions,
});

const empty = (): Question => ({
  id: "",
  section: "math",
  skill: "Algebra",
  difficulty: "C",
  kind: "multiple_choice",
  prompt: "",
  question_text: "",
  choices: [
    { id: "A", text: "" },
    { id: "B", text: "" },
    { id: "C", text: "" },
    { id: "D", text: "" },
  ],
  correct_choice_id: "A",
  correct_grid_answers: [],
  explanation: "",
  image_url: null,
  source_month: null,
  source_year: new Date().getFullYear(),
  time_limit_seconds: null,
});

function AdminQuestions() {
  const [items, setItems] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Question | null>(null);
  const [filter, setFilter] = useState<Section | "all">("all");
  const [uploading, setUploading] = useState(false);
  const [carryOver, setCarryOver] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("questions")
      .select(
        "id,section,skill,difficulty,kind,prompt,question_text,choices,image_url,source_month,source_year,time_limit_seconds,created_at,updated_at,created_by",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (filter !== "all") q = q.eq("section", filter);
    const { data } = await q;
    setItems(
      ((data ?? []) as any[]).map((r) => ({
        ...r,
        correct_choice_id: null,
        correct_grid_answers: [],
        explanation: null,
      })) as unknown as Question[],
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [filter]);

  async function save(opts: { addAnother?: boolean; carryOver?: boolean } = {}) {
    if (!editing) return;
    const payload: any = {
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
      image_url: editing.image_url,
      source_month: editing.source_month,
      source_year: editing.source_year,
      time_limit_seconds: editing.time_limit_seconds,
    };
    if (editing.id) {
      const { error } = await supabase.from("questions").update(payload).eq("id", editing.id);
      if (error) return alert(error.message);
    } else {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("questions").insert({ ...payload, created_by: u.user?.id });
      if (error) return alert(error.message);
    }
    if (opts.addAnother) {
      // Reset to a fresh question, optionally carrying section/skill/difficulty/source date/time limit.
      const base = empty();
      const next = opts.carryOver
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
      load();
      return;
    }
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this question?")) return;
    await supabase.from("questions").delete().eq("id", id);
    load();
  }

  async function uploadImage(file: File) {
    if (!editing) return;
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("question-images").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      setUploading(false);
      return alert(error.message);
    }
    const { data: signed } = await supabase.storage
      .from("question-images")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    setUploading(false);
    if (signed?.signedUrl) {
      setEditing({ ...editing, image_url: signed.signedUrl });
    }
  }

  const skills = editing?.section === "reading_writing" ? RW_SKILLS : MATH_SKILLS;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-2">
          {(["all", "reading_writing", "math"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={
                "rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider " +
                (filter === k ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-600")
              }
            >
              {k === "all" ? "All" : SECTION_LABEL[k]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setEditing(empty())}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New question
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No questions yet.</div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {items.map((q) => (
              <li key={q.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50">
                {q.image_url ? (
                  <img
                    src={q.image_url}
                    alt=""
                    className="h-10 w-10 rounded-md object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-md bg-slate-100 grid place-items-center shrink-0">
                    <ImageIcon className="h-4 w-4 text-slate-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 line-clamp-1">
                    {q.question_text || q.prompt}
                  </div>
                  <div className="mt-1 flex gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                      {SECTION_LABEL[q.section]}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {q.skill}
                    </span>
                    <span
                      className={
                        "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded " +
                        difficultyColor(q.difficulty)
                      }
                    >
                      {q.difficulty}
                    </span>
                    {formatSourceDate(q.source_month, q.source_year) && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {formatSourceDate(q.source_month, q.source_year)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    const { data } = await supabase.rpc(
                      "admin_get_question_answers" as any,
                      { p_question_id: q.id },
                    );
                    const ans = (data as any[])?.[0] ?? {};
                    setEditing({
                      ...q,
                      choices: q.choices || [],
                      correct_choice_id: ans.correct_choice_id ?? null,
                      correct_grid_answers: ans.correct_grid_answers ?? [],
                      explanation: ans.explanation ?? null,
                    });
                  }}
                  className="rounded-lg h-8 w-8 grid place-items-center text-slate-500 hover:bg-slate-100"
                >
                  <Edit3 className="h-4 w-4" />
                </button>

                <button
                  onClick={() => remove(q.id)}
                  className="rounded-lg h-8 w-8 grid place-items-center text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 grid place-items-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">
                {editing.id ? "Edit question" : "New question"}
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg h-8 w-8 grid place-items-center text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Section">
                  <select
                    value={editing.section}
                    onChange={(e) => {
                      const s = e.target.value as Section;
                      setEditing({
                        ...editing,
                        section: s,
                        skill: s === "math" ? "Algebra" : "Craft and Structure",
                      });
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="math">Math</option>
                    <option value="reading_writing">Reading & Writing</option>
                  </select>
                </Field>
                <Field label="Skill">
                  <select
                    value={editing.skill}
                    onChange={(e) => setEditing({ ...editing, skill: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
                    onChange={(e) =>
                      setEditing({ ...editing, difficulty: e.target.value as Difficulty })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
                    onChange={(e) => setEditing({ ...editing, kind: e.target.value as any })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="multiple_choice">Multiple choice</option>
                    <option value="grid_in">Grid-in</option>
                  </select>
                </Field>
                <Field label="Source month">
                  <select
                    value={editing.source_month ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        source_month: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
                    value={editing.source_year ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        source_year: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="e.g. 2023"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Time limit (minutes, optional)">
                  <input
                    type="number"
                    min={0}
                    step={0.5}
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
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <Field label="Image (optional)">
                <div className="flex items-center gap-3">
                  {editing.image_url ? (
                    <img
                      src={editing.image_url}
                      alt=""
                      className="h-16 w-16 rounded-lg object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-slate-100 grid place-items-center border border-slate-200">
                      <ImageIcon className="h-6 w-6 text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1 flex flex-col gap-1.5">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadImage(f);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-600/40 self-start"
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
                        onClick={() => setEditing({ ...editing, image_url: null })}
                        className="text-[11px] text-red-500 hover:underline self-start"
                      >
                        Remove image
                      </button>
                    )}
                  </div>
                </div>
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
                          onChange={() => setEditing({ ...editing, correct_choice_id: c.id })}
                          className="mt-3"
                        />
                        <span className="w-6 pt-2 text-sm font-bold text-slate-600">{c.id}</span>
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
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        correct_grid_answers: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-2 flex-wrap">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={carryOver}
                  onChange={(e) => setCarryOver(e.target.checked)}
                />
                Carry over section, skill, difficulty, source & timer to next question
              </label>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                {!editing.id && (
                  <button
                    onClick={() => save({ addAnother: true, carryOver })}
                    className="rounded-lg border border-blue-600 text-blue-600 bg-white px-4 py-2 text-sm font-semibold hover:bg-blue-50"
                  >
                    Save & add another
                  </button>
                )}
                <button
                  onClick={() => save()}
                  className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
