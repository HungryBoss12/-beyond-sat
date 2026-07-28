import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Filter, Play, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SECTION_LABEL, skillsFor, type Section, type Difficulty } from "@/lib/sat";
import { startPracticeSession } from "@/lib/session";
import { format } from "date-fns";

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
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/practice" })}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-slate-600 hover:text-primary hover:border-primary/40 transition"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            {SECTION_LABEL[section]}
          </h1>
          <p className="text-sm text-slate-600">Filter by skill, difficulty, and date.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        {/* Filters */}
        <aside className="rounded-2xl border border-border bg-white p-5 soft-shadow h-fit">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            <Filter className="h-4 w-4" /> Filters
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-xs font-bold text-slate-700 mb-2">Skill</div>
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
              <div className="text-xs font-bold text-slate-700 mb-2">Difficulty</div>
              <div className="grid grid-cols-2 gap-1.5">
                {(["all", "easy", "medium", "hard"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDiffFilter(d as any)}
                    className={
                      "rounded-md px-2 py-1.5 text-xs font-semibold capitalize transition " +
                      (diffFilter === d
                        ? "bg-primary text-white"
                        : "bg-slate-50 text-slate-700 hover:bg-slate-100")
                    }
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-slate-700 mb-2">Sort by date</div>
              <div className="grid grid-cols-2 gap-1.5">
                {(["newest", "oldest"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSort(s)}
                    className={
                      "rounded-md px-2 py-1.5 text-xs font-semibold capitalize transition " +
                      (sort === s
                        ? "bg-primary text-white"
                        : "bg-slate-50 text-slate-700 hover:bg-slate-100")
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">
              <span className="font-black text-slate-900 tabular-nums">{total}</span> question
              {total === 1 ? "" : "s"}
              {skillFilter !== "all" ? ` · ${skillFilter}` : ""}
            </div>
            <button
              disabled={total === 0 || starting}
              onClick={practiceThisSet}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-40 hover:bg-[#002a56] transition"
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Practice this set
            </button>
          </div>

          {loading ? (
            <div className="grid place-items-center h-48 rounded-2xl border border-border bg-white">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : total === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center">
              <div className="text-lg font-bold text-slate-800">No questions yet</div>
              <p className="text-sm text-slate-500 mt-1">
                Admins haven't added questions for this filter. Try widening it.
              </p>
              <Link
                to="/practice"
                className="mt-4 inline-block text-sm font-bold text-primary hover:underline"
              >
                Back to practice
              </Link>
            </div>
          ) : (
            <ul className="rounded-2xl border border-border bg-white divide-y divide-border overflow-hidden soft-shadow">
              {questions.map((q, i) => (
                <li
                  key={q.id}
                  className="flex items-start gap-4 p-4 hover:bg-slate-50 transition cursor-pointer"
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-primary text-xs font-black">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-800 line-clamp-2">{q.question_text}</div>
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500">
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
        "w-full flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-semibold transition " +
        (active ? "bg-accent text-primary" : "text-slate-600 hover:bg-slate-50")
      }
    >
      <span className="truncate">{label}</span>
      <span className="tabular-nums text-slate-400">{count}</span>
    </button>
  );
}

function DiffBadge({ d }: { d: Difficulty }) {
  const map: Record<string, string> = {
    easy: "bg-emerald-50 text-emerald-700 border-emerald-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    hard: "bg-red-50 text-red-700 border-red-200",
    C: "bg-emerald-50 text-emerald-700 border-emerald-200",
    B: "bg-amber-50 text-amber-700 border-amber-200",
    D: "bg-sky-50 text-sky-700 border-sky-200",
    A: "bg-red-50 text-red-700 border-red-200",
    S: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  };
  return (
    <span
      className={
        "shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider " + (map[d] ?? "bg-slate-50 text-slate-700 border-slate-200")
      }
    >
      {d}
    </span>
  );
}
