import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { motion } from "motion/react";
import {
  Plus,
  Trash2,
  Edit3,
  ImageIcon,
  Copy,
  CheckSquare,
  ListChecks,
  X,
  Shapes,
  Calendar,
  Clock,
  Tags,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  SECTION_LABEL,
  formatSourceDate,
  difficultyColor,
  type Section,
} from "@/lib/sat";
import { ListSkeleton } from "@/components/ui/skeletons";
import { loadQuestionWithAnswers } from "@/components/admin/question-edit-modal";
import {
  type AdminChoice,
  type AdminQuestion,
  type BankFormat,
} from "@/lib/admin/question";
import { QUESTION_SELECT_COLS } from "@/lib/sqb";
import { applyResolvedImageUrls } from "@/lib/storage-url";

export const Route = createFileRoute("/_authenticated/admin/sqb/questions/")({
  component: AdminSqbQuestions,
  head: () => ({ meta: [{ title: "SQB Questions — BeyondSAT Admin" }] }),
});

type Row = AdminQuestion & { created_at: string };

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function nextUtcDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

function sourceKey(month: number | null, year: number | null): string | null {
  if (!month || !year) return null;
  return `${year}-${month}`;
}

function AdminSqbQuestions() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Section | "all">("all");
  const [kind, setKind] = useState<"all" | "multiple_choice" | "grid_in">("all");
  const [skill, setSkill] = useState("all");
  const [source, setSource] = useState("all");
  const [added, setAdded] = useState("all");
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [addedOptions, setAddedOptions] = useState<string[]>([]);
  const [skillOptions, setSkillOptions] = useState<string[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const loadOptions = useCallback(async () => {
    const { data } = await supabase
      .from("questions")
      .select("source_month,source_year,created_at,subskill")
      .eq("bank_format", "sqb")
      .limit(2000);
    const sources = new Set<string>();
    const days = new Set<string>();
    const skills = new Set<string>();
    for (const row of data ?? []) {
      const key = sourceKey(row.source_month, row.source_year);
      if (key) sources.add(key);
      if (row.created_at) days.add(dayKey(row.created_at));
      const skillName = (row.subskill ?? "").trim();
      if (skillName) skills.add(skillName);
    }
    setSourceOptions([...sources].sort().reverse());
    setAddedOptions([...days].sort().reverse());
    setSkillOptions([...skills].sort((a, b) => a.localeCompare(b)));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("questions")
      .select(QUESTION_SELECT_COLS)
      .eq("bank_format", "sqb")
      .order("created_at", { ascending: false })
      .limit(500);
    if (filter !== "all") q = q.eq("section", filter);
    if (kind !== "all") q = q.eq("kind", kind);
    if (skill !== "all") q = q.eq("subskill", skill);
    if (source !== "all") {
      const [year, month] = source.split("-");
      q = q.eq("source_year", Number(year)).eq("source_month", Number(month));
    }
    if (added !== "all") {
      q = q.gte("created_at", `${added}T00:00:00.000Z`).lt("created_at", nextUtcDay(added));
    }
    const { data } = await q;
    const mapped = (data ?? []).map((r) => ({
      ...r,
      choices: (r.choices ?? []) as AdminChoice[],
      bank_format: "sqb" as BankFormat,
      external_id: r.external_id ?? null,
      assessment: r.assessment ?? null,
      domain: r.domain ?? null,
      subskill: r.subskill ?? null,
      image_alt: r.image_alt ?? null,
      published: r.published !== false,
      correct_choice_id: null,
      correct_grid_answers: [],
      explanation: null,
      time_limit_seconds: r.time_limit_seconds ?? null,
      created_at: r.created_at,
    }));
    setItems(await applyResolvedImageUrls(mapped));
    setLoading(false);
  }, [filter, kind, skill, source, added]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    void load();
  }, [load]);

  const shownIds = useMemo(() => items.map((q) => q.id), [items]);
  const allShownSelected = shownIds.length > 0 && shownIds.every((id) => selected.has(id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectMode() {
    setSelecting((on) => {
      if (on) setSelected(new Set());
      return !on;
    });
  }

  function selectAllShown() {
    setSelected(allShownSelected ? new Set() : new Set(shownIds));
  }

  async function remove(id: string) {
    if (!confirm("Delete this SQB question?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    void load();
    void loadOptions();
  }

  async function removeSelected() {
    const ids = [...selected];
    if (ids.length === 0 || deleting) return;
    const ok = confirm(
      `Delete ${ids.length} question${ids.length === 1 ? "" : "s"}?\n\nThis cannot be undone. They will also be removed from any SQB pack that includes them.`,
    );
    if (!ok) return;
    setDeleting(true);
    const { error } = await supabase.from("questions").delete().in("id", ids);
    setDeleting(false);
    if (error) {
      alert(error.message);
      return;
    }
    setSelected(new Set());
    setSelecting(false);
    void load();
    void loadOptions();
  }

  async function duplicate(q: AdminQuestion) {
    const full = await loadQuestionWithAnswers(q);
    sessionStorage.setItem(
      "sqb-draft",
      JSON.stringify({ ...full, id: "", published: false, bank_format: "sqb" }),
    );
    void navigate({ to: "/admin/sqb/questions/$id", params: { id: "new" } });
  }

  return (
    <div className={selecting && selected.size > 0 ? "pb-20" : ""}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black tracking-tight text-brand-900">SQB Questions</h1>
          <p className="mt-1 text-sm text-slate-500">
            Question Bank–format items. Publish from the editor before adding to a live test.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleSelectMode}
            className={
              "tap inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider " +
              (selecting
                ? "bg-brand-400 text-white"
                : "bg-brand-600 text-brand-100 hover:bg-brand-500 hover:text-white")
            }
          >
            <motion.span
              key={selecting ? "on" : "off"}
              initial={{ scale: 0.5, rotate: -16 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 18 }}
              className="inline-flex"
            >
              {selecting ? <X className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />}
            </motion.span>
            {selecting ? "Cancel" : "Select"}
          </button>
          <div className="flex gap-2">
            {(["all", "reading_writing", "math"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={
                  "tap rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider " +
                  (filter === k
                    ? "bg-brand-400 text-white"
                    : "bg-brand-600 text-brand-100 hover:bg-brand-500 hover:text-white")
                }
              >
                {k === "all" ? "All" : SECTION_LABEL[k]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem("sqb-draft");
              void navigate({ to: "/admin/sqb/questions/$id", params: { id: "new" } });
            }}
            className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> New SQB question
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <FilterSelect
          label="Type"
          icon={Shapes}
          value={kind}
          onChange={(v) => setKind(v as typeof kind)}
          options={[
            { value: "all", label: "Any type" },
            { value: "multiple_choice", label: "MCQ" },
            { value: "grid_in", label: "Grid-in" },
          ]}
        />
        <FilterSelect
          label="Skill"
          icon={Tags}
          value={skill}
          onChange={setSkill}
          options={[
            { value: "all", label: "Any skill" },
            ...skillOptions.map((name) => ({ value: name, label: name })),
          ]}
        />
        <FilterSelect
          label="Source date"
          icon={Calendar}
          value={source}
          onChange={setSource}
          options={[
            { value: "all", label: "Any source date" },
            ...sourceOptions.map((key) => {
              const [year, month] = key.split("-");
              return {
                value: key,
                label: formatSourceDate(Number(month), Number(year)) ?? key,
              };
            }),
          ]}
        />
        <FilterSelect
          label="Added"
          icon={Clock}
          value={added}
          onChange={setAdded}
          options={[
            { value: "all", label: "Any date added" },
            ...addedOptions.map((day) => ({ value: day, label: day })),
          ]}
        />
        {selecting && (
          <button
            type="button"
            onClick={selectAllShown}
            className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-400/50 bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-500"
          >
            <motion.span
              key={allShownSelected ? "all" : "some"}
              initial={{ scale: 0.4, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 16 }}
              className="inline-flex"
            >
              <ListChecks className="h-3.5 w-3.5" />
            </motion.span>
            {allShownSelected ? "Clear shown" : "Select all shown"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="mt-6">
          <ListSkeleton rows={6} />
        </div>
      ) : (
        <div className="rise-in mt-6 overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 shadow-panel">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-brand-100">No SQB questions yet.</div>
          ) : (
            <ul className="divide-y divide-brand-400/30">
              {items.map((q) => {
                const on = selected.has(q.id);
                return (
                  <li
                    key={q.id}
                    className={
                      "flex items-center gap-4 px-4 py-3 transition-colors hover:bg-brand-500 " +
                      (on ? "bg-brand-500/80" : "")
                    }
                    onClick={selecting ? () => toggle(q.id) : undefined}
                  >
                    {selecting && (
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(q.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${q.external_id || q.id.slice(0, 8)}`}
                        className="h-4 w-4 shrink-0 accent-brand-300"
                      />
                    )}
                    {q.image_url ? (
                      <img
                        src={q.image_url}
                        alt={q.image_alt ?? ""}
                        className="h-10 w-10 shrink-0 rounded-md border border-brand-400/50 object-cover"
                      />
                    ) : (
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-800">
                        <ImageIcon className="h-4 w-4 text-brand-200" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 text-sm font-semibold text-white">
                        {q.question_text || q.prompt}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className="rounded bg-brand-400 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-white">
                          {q.external_id || q.id.slice(0, 8)}
                        </span>
                        <span className="rounded bg-brand-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                          {SECTION_LABEL[q.section]}
                        </span>
                        <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                          {q.skill}
                          {q.subskill ? ` · ${q.subskill}` : ""}
                        </span>
                        <span
                          className={
                            "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
                            difficultyColor(q.difficulty)
                          }
                        >
                          {q.difficulty}
                        </span>
                        <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                          {q.kind === "grid_in" ? "Grid-in" : "MCQ"}
                        </span>
                        <span
                          className={
                            "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
                            (q.published ? "bg-emerald-600 text-white" : "bg-amber-700 text-white")
                          }
                        >
                          {q.published ? "Published" : "Draft"}
                        </span>
                        {formatSourceDate(q.source_month, q.source_year) && (
                          <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                            {formatSourceDate(q.source_month, q.source_year)}
                          </span>
                        )}
                        <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                          Added {dayKey(q.created_at)}
                        </span>
                      </div>
                    </div>
                    {!selecting && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            void navigate({ to: "/admin/sqb/questions/$id", params: { id: q.id } })
                          }
                          className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-800 hover:text-white"
                          aria-label="Edit question"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void duplicate(q)}
                          className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-800 hover:text-white"
                          aria-label="Duplicate question"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(q.id)}
                          className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-900 hover:text-white"
                          aria-label="Delete question"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {selecting && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-400/40 bg-brand-800/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <p className="text-sm font-bold text-white">{selected.size} selected</p>
            <button
              type="button"
              disabled={deleting}
              onClick={() => void removeSelected()}
              className="tap inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  icon: Icon,
  value,
  onChange,
  options,
}: {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
      {Icon ? <Icon className="h-3.5 w-3.5 text-brand-600" /> : null}
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-brand-400/40 bg-brand-600 px-2 py-1.5 text-xs font-semibold normal-case tracking-normal text-white [color-scheme:dark]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
