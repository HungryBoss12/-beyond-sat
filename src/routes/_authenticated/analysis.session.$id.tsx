import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { applyResolvedImageUrls } from "@/lib/storage-url";
import {
  QuestionCard,
  emptyAnswer,
  type AnswerState,
  type QuestionRow,
} from "@/components/QuestionCard";
import {
  REVIEW_MODULES,
  REVIEW_SECTIONS,
  knownParts,
  orderByIds,
  readSessionReviewMeta,
  sectionChoiceLabel,
  tagInOrder,
  type ReviewModule,
  type ReviewPart,
} from "@/lib/analysis/review-parts";
import type { Section } from "@/lib/sat";

type ReviewSearch = { section?: Section; module?: ReviewModule };

export const Route = createFileRoute("/_authenticated/analysis/session/$id")({
  validateSearch: (search: Record<string, unknown>): ReviewSearch => {
    const section =
      search.section === "math" || search.section === "reading_writing"
        ? search.section
        : undefined;
    const module =
      search.module === 2 || search.module === "2"
        ? 2
        : search.module === 1 || search.module === "1"
          ? 1
          : undefined;
    return { section, module };
  },
  component: SessionReview,
  head: () => ({ meta: [{ title: "Session review — BeyondSAT" }] }),
});

type AttemptRow = {
  id: string;
  question_id: string | null;
  is_correct: boolean | null;
  selected_choice_id: string | null;
  grid_answer: string | null;
  marked_for_review: boolean | null;
  eliminated_choice_ids: string[] | null;
};

type QuestionFull = QuestionRow & {
  correct_choice_id: string | null;
  correct_grid_answers: string[] | null;
  part: ReviewPart;
};

function SessionReview() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionFull[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      const { data: sess } = await supabase
        .from("test_sessions")
        .select("metadata")
        .eq("id", id)
        .eq("user_id", uid)
        .maybeSingle();
      const meta = readSessionReviewMeta(sess?.metadata);
      let test: { section: string; module: number } | null = null;
      if (meta.testId && !meta.modules?.length) {
        const { data: row } = await supabase
          .from("tests")
          .select("section,module")
          .eq("id", meta.testId)
          .maybeSingle();
        if (row) test = { section: row.section, module: row.module };
      }
      const { data: att, error: aErr } = await supabase
        .from("attempts")
        .select(
          "id,question_id,is_correct,selected_choice_id,grid_answer,marked_for_review,eliminated_choice_ids,created_at",
        )
        .eq("session_id", id)
        .eq("user_id", uid)
        .order("created_at", { ascending: true });
      if (aErr) {
        setErr(aErr.message);
        setLoading(false);
        return;
      }
      const ids = (att ?? []).map((a) => a.question_id).filter((x): x is string => !!x);
      const known = knownParts({
        modules: meta.modules,
        test,
        questionIds: meta.questionIds ?? ids,
      });
      if (ids.length === 0) {
        setErr("No answers found for this session.");
        setLoading(false);
        return;
      }
      const qs: QuestionRow[] = [];
      const chunkSize = 40;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const { data, error: qErr } = await supabase
          .from("questions")
          .select(
            "id,section,skill,difficulty,kind,prompt,question_text,choices,image_url,bank_format,external_id,domain,subskill,image_alt",
          )
          .in("id", chunk);
        if (qErr) {
          setErr(qErr.message);
          setLoading(false);
          return;
        }
        qs.push(...((data ?? []) as QuestionRow[]));
      }
      const { data: ans } = await supabase.rpc("get_answers_for_review", {
        p_question_ids: ids,
      });
      const ansById = new Map((ans ?? []).map((r) => [r.question_id, r]));
      const merged = (qs ?? []).map((q) => {
        const a = ansById.get(q.id);
        return {
          ...q,
          correct_choice_id: a?.correct_choice_id ?? null,
          correct_grid_answers: a?.correct_grid_answers ?? null,
          explanation: a?.explanation ?? null,
        };
      });
      const byId = new Map(merged.map((q) => [q.id, q]));
      const inExamOrder = orderByIds(att ?? [], meta.questionIds, (a) => a.question_id ?? "");
      const ordered = inExamOrder
        .map((a) => (a.question_id ? byId.get(a.question_id) : undefined))
        .filter((q): q is (typeof merged)[number] => !!q);

      setQuestions(await applyResolvedImageUrls(tagInOrder(ordered, known)));
      setAttempts(inExamOrder as AttemptRow[]);
      setLoading(false);
    })();
  }, [id]);

  const visible = useMemo(() => {
    if (!search.section || !search.module) return [];
    return questions.filter(
      (q) => q.part.section === search.section && q.part.module === search.module,
    );
  }, [questions, search.section, search.module]);
  const safeIdx = Math.min(idx, Math.max(visible.length - 1, 0));
  const currentAttempt = attempts.find((a) => a.question_id === visible[safeIdx]?.id) ?? null;

  function openPart(section: Section, module: ReviewModule) {
    setIdx(0);
    void navigate({
      to: "/analysis/session/$id",
      params: { id },
      search: { section, module },
      replace: true,
    });
  }

  function correctIn(section: Section, module: ReviewModule) {
    const ids = new Set(
      questions
        .filter((q) => q.part.section === section && q.part.module === module)
        .map((q) => q.id),
    );
    const rows = attempts.filter((a) => a.question_id && ids.has(a.question_id));
    return {
      total: rows.length,
      correct: rows.filter((a) => a.is_correct === true).length,
    };
  }

  const answerState: AnswerState = useMemo(() => {
    if (!currentAttempt) return emptyAnswer();
    return {
      selectedChoiceId: currentAttempt.selected_choice_id,
      gridAnswer: currentAttempt.grid_answer ?? "",
      eliminated: currentAttempt.eliminated_choice_ids ?? [],
      markedForReview: !!currentAttempt.marked_for_review,
      highlights: [],
    };
  }, [currentAttempt]);

  useEffect(() => {
    if (loading || err || (search.section && search.module)) return;
    const filled = REVIEW_SECTIONS.flatMap((section) =>
      REVIEW_MODULES.map((module) => ({ section, module })).filter((part) =>
        questions.some((q) => q.part.section === part.section && q.part.module === part.module),
      ),
    );
    if (filled.length !== 1) return;
    void navigate({
      to: "/analysis/session/$id",
      params: { id },
      search: { section: filled[0].section, module: filled[0].module },
      replace: true,
    });
  }, [loading, err, search.section, search.module, questions, id, navigate]);

  /* This route is a full-screen overlay, so the skeleton has to reproduce the
     overlay's own chrome — top bar, question body, footer — on the white page
     rather than sitting inside the app shell. */
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-test-canvas">
        <div className="h-16 w-full shrink-0 border-b border-dashed border-test-edge bg-test-chrome" />
        <div className="flex min-h-0 flex-1 gap-0 overflow-hidden">
          <div className="hidden flex-1 border-r border-test-line p-6 md:block">
            <div className="skeleton-light h-full rounded" />
          </div>
          <div className="flex-1 space-y-4 p-6">
            <div className="skeleton-light h-4 w-40 rounded" />
            <div className="skeleton-light h-24 rounded" />
            <div className="skeleton-light h-14 rounded-lg" />
            <div className="skeleton-light h-14 rounded-lg" />
            <div className="skeleton-light h-14 rounded-lg" />
          </div>
        </div>
        <div className="flex h-16 items-center justify-between border-t border-test-line bg-test-chrome px-4 sm:px-6">
          <div className="skeleton-light h-10 w-28 rounded-full" />
          <div className="skeleton-light h-10 w-24 rounded-full" />
        </div>
      </div>
    );
  }
  if (err) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-test-chrome px-4 py-6 sm:px-6">
        <div className="w-full max-w-md rounded-lg border border-test-line bg-white p-8 text-center shadow-panel">
          <h1 className="text-xl font-black tracking-tight text-test-ink">{err}</h1>
          <p className="mt-2 text-sm text-test-muted">
            Answers are only kept for sessions you finished on this account.
          </p>
          <button
            onClick={() => navigate({ to: "/analysis" })}
            className="btn-test mt-6 rounded-full bg-test-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-test-accent-deep"
          >
            Back to analysis
          </button>
        </div>
      </div>
    );
  }

  const q = visible[safeIdx];
  const isCorrect = currentAttempt?.is_correct;

  if (!search.section || !search.module) {
    const chooser = (
      <div className="fixed inset-0 z-[80] flex h-[100dvh] flex-col bg-test-canvas">
        <header className="flex shrink-0 items-center gap-2 bg-test-chrome px-4 py-3 sm:px-6">
          <button
            onClick={() => navigate({ to: "/analysis" })}
            className="tap grid h-7 w-7 shrink-0 place-items-center rounded text-test-muted hover:bg-test-well hover:text-test-ink"
            aria-label="Exit"
          >
            <X className="h-4 w-4" />
          </button>
          <span className="text-[15px] font-bold text-test-ink">Review mode</span>
        </header>
        <div className="mx-auto grid w-full max-w-3xl flex-1 content-start gap-4 overflow-y-auto p-4 sm:grid-cols-2 sm:p-8">
          {REVIEW_SECTIONS.map((section) => (
            <section
              key={section}
              className="rounded-2xl border border-test-line bg-white p-5 shadow-panel"
            >
              <h2 className="text-lg font-black text-test-ink">{sectionChoiceLabel(section)}</h2>
              <div className="mt-4 space-y-2">
                {REVIEW_MODULES.map((module) => {
                  const tally = correctIn(section, module);
                  return (
                    <button
                      key={module}
                      type="button"
                      disabled={tally.total === 0}
                      onClick={() => openPart(section, module)}
                      className="tap flex w-full items-center justify-between rounded-xl border border-test-line px-3 py-3 text-left hover:bg-test-tint disabled:pointer-events-none disabled:opacity-40"
                    >
                      <span>
                        <span className="block text-sm font-bold text-test-ink">
                          Module {module}
                        </span>
                        <span className="text-xs text-test-muted">
                          {tally.total === 0
                            ? "No questions"
                            : `${tally.correct} / ${tally.total} correct`}
                        </span>
                      </span>
                      <span className="text-xs font-bold text-test-accent">Review</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
    if (typeof document === "undefined") return chooser;
    return createPortal(chooser, document.body);
  }

  const review = (
    /* Portaled so route-enter's transform does not collapse this fixed overlay. */
    <div className="fixed inset-0 z-[80] flex h-[100dvh] flex-col bg-test-canvas">
      <header className="shrink-0 bg-test-chrome">
        <div className="grid grid-cols-3 items-center gap-2 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => navigate({ to: "/analysis" })}
              className="tap grid h-7 w-7 shrink-0 place-items-center rounded text-test-muted hover:bg-test-well hover:text-test-ink"
              aria-label="Exit"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="truncate text-[15px] font-bold text-test-ink">
              Review · {sectionChoiceLabel(search.section)} · Module {search.module}
            </span>
          </div>
          <div className="flex justify-center">
            {/* Still no green/red: correct is the accent fill, incorrect is a
                neutral outline, and the icon carries the rest. */}
            {isCorrect === true ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-test-accent px-3 py-1 text-sm font-bold text-white">
                <CheckCircle2 className="h-4 w-4" /> Correct
              </span>
            ) : isCorrect === false ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-test-edge bg-white px-3 py-1 text-sm font-bold text-test-ink">
                <XCircle className="h-4 w-4" /> Incorrect
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-test-line bg-white px-3 py-1 text-sm font-bold text-test-muted">
                Unanswered
              </span>
            )}
          </div>
          <div className="flex justify-end text-sm font-semibold tabular-nums text-test-ink">
            {visible.length === 0 ? "0 / 0" : `${safeIdx + 1} / ${visible.length}`}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 px-4 pb-3">
          {REVIEW_SECTIONS.map((section) => (
            <button
              key={section}
              type="button"
              aria-pressed={section === search.section}
              onClick={() => openPart(section, search.module)}
              className={
                "tap rounded-full px-3 py-1 text-xs font-bold " +
                (section === search.section
                  ? "bg-test-accent text-white"
                  : "border border-test-line bg-white text-test-ink hover:bg-test-tint")
              }
            >
              {sectionChoiceLabel(section)}
            </button>
          ))}
          <span className="mx-1 hidden h-4 w-px bg-test-line sm:block" aria-hidden />
          {REVIEW_MODULES.map((module) => (
            <button
              key={module}
              type="button"
              aria-pressed={module === search.module}
              onClick={() => openPart(search.section, module)}
              className={
                "tap rounded-full px-3 py-1 text-xs font-bold " +
                (module === search.module
                  ? "bg-test-ink text-white"
                  : "border border-test-line bg-white text-test-ink hover:bg-test-tint")
              }
            >
              Module {module}
            </button>
          ))}
        </div>
        <div className="border-b border-dashed border-test-edge" />
      </header>

      {visible.length === 0 ? (
        <div className="grid flex-1 place-items-center px-6 text-center">
          <p className="text-sm font-semibold text-test-ink">
            No questions in {sectionChoiceLabel(search.section)} Module {search.module}.
          </p>
        </div>
      ) : (
        q && (
          <QuestionCard
            q={q}
            index={safeIdx}
            answer={answerState}
            onChange={() => {}}
            reveal
            correctChoiceId={q.correct_choice_id ?? null}
            correctGridAnswers={q.correct_grid_answers ?? null}
          />
        )
      )}

      <div className="flex h-16 shrink-0 items-center justify-between border-t border-test-line bg-test-chrome px-4 sm:px-6">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={safeIdx === 0 || visible.length === 0}
          className="group tap inline-flex items-center gap-1.5 rounded-full border border-test-accent bg-white px-5 py-2 text-sm font-bold text-test-accent hover:bg-test-tint disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
          Previous
        </button>
        <button
          onClick={() => {
            if (visible.length === 0 || safeIdx >= visible.length - 1)
              navigate({ to: "/analysis" });
            else setIdx((i) => i + 1);
          }}
          className="btn-test group inline-flex items-center gap-1.5 rounded-full bg-test-accent px-5 py-2 text-sm font-bold text-white hover:bg-test-accent-deep"
        >
          {visible.length === 0 || safeIdx >= visible.length - 1 ? "Finish" : "Next"}{" "}
          <ChevronRight className="arrow-slide h-4 w-4" />
        </button>
      </div>
    </div>
  );
  if (typeof document === "undefined") return review;
  return createPortal(review, document.body);
}
