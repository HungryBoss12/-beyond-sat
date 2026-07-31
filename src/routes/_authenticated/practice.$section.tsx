import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Filter, Play, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SECTION_LABEL, skillsFor, type Section, type Difficulty } from "@/lib/sat";
import { startPracticeSession } from "@/lib/session";
import { format } from "date-fns";
import { Panel, EmptyState } from "@/components/ui/panel";
import { ListSkeleton } from "@/components/ui/skeletons";

export const Route = createFileRoute("/_authenticated/practice/$section")({
  parseParams: (p) => {
    const s = p.section;
    if (s !== "reading_writing" && s !== "math") throw notFound();
    return { section: s as Section };
  },
  component: SectionBrowse,
  head: ({ params }) => ({
    meta: [
      {
        title: `${params.section === "math" ? "Math" : "Reading & Writing"} Practice — BeyondSAT`,
      },
    ],
  }),
});

type Q = {
  id: string;
  question_text: string;
  skill: string;
  difficulty: Difficulty;
  created_at: string;
};

type Sort = "newest" | "oldest";

function SectionBrowse() {
  const { section } = Route.useParams() as { section: Section };
  const navigate = useNavigate();
  const skills = skillsFor(section);
  const [skillFilter, setSkillFilter] = useState<string | "all">("all");
  const [diffFilter, setDiffFilter] = useState<Difficulty | "all">("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [questions, setQuestions] = useState<Q[]>([]);
  const [skillCounts, setSkillCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  async function practiceThisSet() {
    setStarting(true);
    try {
      const sessionId = await startPracticeSession({
        section,
        skill: skillFilter === "all" ? null : skillFilter,
        difficulty: diffFilter === "all" ? null : (diffFilter as Difficulty),
        limit: 20,
      });
      navigate({ to: `/practice/session/${sessionId}` });
    } catch (e: any) {
      alert(e.message ?? "Could not start practice.");
      setStarting(false);
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from("questions")
        .select("id,question_text,skill,difficulty,created_at")
        .eq("section", section);
      if (skillFilter !== "all") q = q.eq("skill", skillFilter);
      if (diffFilter !== "all") q = q.eq("difficulty", diffFilter);
      q = q.order("created_at", { ascending: sort === "oldest" }).limit(200);
      const [{ data }, countsResult] = await Promise.all([
        q,
        supabase.from("questions").select("skill").eq("section", section),
      ]);
      setQuestions((data as Q[]) ?? []);
      const counts: Record<string, number> = {};
      for (const row of (countsResult.data as { skill: string }[]) ?? []) {
        counts[row.skill] = (counts[row.skill] ?? 0) + 1;
      }
      setSkillCounts(counts);
      setLoading(false);
    })();
  }, [section, skillFilter, diffFilter, sort]);

  const total = useMemo(() => questions.length, [questions]);

  return (
    <div className="space-y-5">
      <div className="rise-in flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/practice" })}
          className="tap inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-panel hover:bg-brand-400"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          {/* Sits on the white page background, so this heading stays dark. */}
          <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
            {SECTION_LABEL[section]}
          </h1>
          <p className="text-sm text-slate-500">Filter by skill, difficulty, and date.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
        {/* Filters */}
        <Panel as="section" className="h-fit">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-100">
            <Filter className="h-4 w-4" /> Filters
          </div>

          <div className="space-y-4">
            <div>
              <div className="mb-2 text-xs font-bold text-white">Skill</div>
              <div className="space-y-1">
                <FilterRow
                  label="All skills"
                  count={Object.values(skillCounts).reduce((a, b) => a + b, 0)}
                  active={skillFilter === "all"}
                  onClick={() => setSkillFilter("all")}
                />
                {skills.map((s) => (
                  <FilterRow
                    key={s}
                    label={s}
                    count={skillCounts[s] ?? 0}
                    active={skillFilter === s}
                    onClick={() => setSkillFilter(s)}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-bold text-white">Difficulty</div>
              <div className="grid grid-cols-2 gap-1.5">
                {(["all", "easy", "medium", "hard"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDiffFilter(d as any)}
                    className={
                      "tap rounded-md px-2 py-1.5 text-xs font-semibold capitalize " +
                      (diffFilter === d
                        ? "bg-brand-400 text-white shadow-brand"
                        : "bg-brand-800 text-brand-100 hover:bg-brand-400 hover:text-white")
                    }
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-bold text-white">Sort by date</div>
              <div className="grid grid-cols-2 gap-1.5">
                {(["newest", "oldest"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSort(s)}
                    className={
                      "tap rounded-md px-2 py-1.5 text-xs font-semibold capitalize " +
                      (sort === s
                        ? "bg-brand-400 text-white shadow-brand"
                        : "bg-brand-800 text-brand-100 hover:bg-brand-400 hover:text-white")
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        {/* List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-slate-500">
              <span className="font-black tabular-nums text-slate-900">{total}</span> question
              {total === 1 ? "" : "s"}
              {skillFilter !== "all" ? ` · ${skillFilter}` : ""}
            </div>
            <button
              disabled={total === 0 || starting}
              onClick={practiceThisSet}
              className="btn-brand inline-flex items-center gap-2 rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Practice this set
            </button>
          </div>

          {loading ? (
            <ListSkeleton rows={6} />
          ) : total === 0 ? (
            <EmptyState
              title="No questions yet"
              body="Admins haven't added questions for this filter. Try widening it."
              className="py-14"
              action={
                <button
                  onClick={() => {
                    setSkillFilter("all");
                    setDiffFilter("all");
                  }}
                  className="btn-brand rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold text-white"
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <ul className="stagger-fast overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 shadow-panel divide-y divide-brand-400/40">
              {questions.map((q, i) => (
                <li
                  key={q.id}
                  className="flex cursor-pointer items-start gap-4 p-4 transition hover:bg-brand-800"
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-800 text-xs font-black text-white">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm text-white">{q.question_text}</div>
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-brand-100">
                      <span className="font-semibold">{q.skill}</span>
                      <span>·</span>
                      <span>{format(new Date(q.created_at), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                  <DiffBadge d={q.difficulty} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "tap flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-semibold " +
        (active
          ? "bg-brand-400 text-white shadow-brand"
          : "text-brand-100 hover:bg-brand-800 hover:text-white")
      }
    >
      <span className="truncate">{label}</span>
      <span className="tabular-nums text-brand-200">{count}</span>
    </button>
  );
}

/**
 * Difficulty is ranked through the blue ramp — harder means a lighter, more
 * prominent chip — rather than through green/amber/red, which would be the only
 * non-brand colour on the page.
 */
function DiffBadge({ d }: { d: Difficulty }) {
  const map: Record<string, string> = {
    easy: "bg-brand-800 text-brand-100 border-brand-400/40",
    medium: "bg-brand-500 text-white border-brand-300/50",
    hard: "bg-brand-400 text-white border-brand-200/60",
    C: "bg-brand-800 text-brand-100 border-brand-400/40",
    D: "bg-brand-700 text-white border-brand-400/50",
    B: "bg-brand-500 text-white border-brand-300/50",
    A: "bg-brand-400 text-white border-brand-200/60",
    S: "bg-brand-300 text-white border-brand-100/70",
  };
  return (
    <span
      className={
        "shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
        (map[d] ?? "bg-brand-800 text-brand-100 border-brand-400/40")
      }
    >
      {d}
    </span>
  );
}
