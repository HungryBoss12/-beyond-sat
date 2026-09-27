import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  QuestionCard,
  emptyAnswer,
  type QuestionRow,
} from "@/components/QuestionCard";
import { loadTestPreviewQuestions } from "@/components/admin/AdminTestPreview";
import { loadQuestionWithAnswers } from "@/components/admin/question-edit-modal";
import type { AdminQuestion } from "@/lib/admin/question";
import { validateSqbPublish, findPackExternalIdDupes, type PublishIssue } from "@/lib/sqb";
import { SECTION_LABEL } from "@/lib/sat";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/sqb/review/$testId")({
  component: AdminSqbReviewPage,
  head: () => ({ meta: [{ title: "Review SQB test — BeyondSAT Admin" }] }),
});

type LoadedQ = QuestionRow & {
  correct_choice_id: string | null;
  correct_grid_answers: string[] | null;
};

type ItemStatus = {
  id: string;
  errors: PublishIssue[];
  warnings: PublishIssue[];
  reviewed: boolean;
};

function AdminSqbReviewPage() {
  const { testId } = Route.useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [section, setSection] = useState<"math" | "reading_writing" | null>(null);
  const [published, setPublished] = useState(false);
  const [questions, setQuestions] = useState<LoadedQ[]>([]);
  const [adminQs, setAdminQs] = useState<AdminQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [showAnswers, setShowAnswers] = useState(true);
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const [addedErrors, setAddedErrors] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data: test, error: te } = await supabase
        .from("tests")
        .select("id,title,section,published,bank_format")
        .eq("id", testId)
        .single();
      if (te) throw new Error(te.message);
      if ((test as { bank_format?: string }).bank_format !== "sqb") {
        throw new Error("This test is not an SQB pack.");
      }
      setTitle(test.title);
      setSection(test.section as "math" | "reading_writing");
      setPublished(!!test.published);

      const { data: links, error: le } = await supabase
        .from("test_questions")
        .select("question_id,position")
        .eq("test_id", testId)
        .order("position", { ascending: true });
      if (le) throw new Error(le.message);
      const ids = ((links ?? []) as { question_id: string }[]).map((l) => l.question_id);
      if (ids.length === 0) {
        setQuestions([]);
        setAdminQs([]);
        setErr("This SQB test has no questions linked.");
        return;
      }

      const [preview, rawQs] = await Promise.all([
        loadTestPreviewQuestions(ids),
        supabase
          .from("questions")
          .select(
            "id,section,skill,difficulty,kind,prompt,question_text,choices,image_url,source_month,source_year,time_limit_seconds,bank_format,external_id,assessment,domain,subskill,image_alt,published",
          )
          .in("id", ids),
      ]);
      if (rawQs.error) throw new Error(rawQs.error.message);
      const byId = new Map((rawQs.data ?? []).map((r) => [r.id, r]));
      const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as Parameters<
        typeof loadQuestionWithAnswers
      >[0][];
      const admins = await Promise.all(ordered.map((q) => loadQuestionWithAnswers(q)));
      setQuestions(preview);
      setAdminQs(admins);
      setIdx(0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load review.");
      setQuestions([]);
      setAdminQs([]);
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    void load();
  }, [load]);

  const statuses: ItemStatus[] = useMemo(() => {
    return adminQs.map((q) => {
      const issues = validateSqbPublish(q);
      return {
        id: q.id,
        errors: issues.filter((i) => i.level === "error"),
        warnings: issues.filter((i) => i.level === "warning"),
        reviewed: !!reviewed[q.id],
      };
    });
  }, [adminQs, reviewed]);

  // Duplicate external_id within pack
  const dupExternals = useMemo(() => findPackExternalIdDupes(adminQs), [adminQs]);

  const kept = useMemo(
    () => adminQs.filter((q) => !skipped[q.id]),
    [adminQs, skipped],
  );

  const packErrors = useMemo(() => {
    let n = 0;
    for (let i = 0; i < adminQs.length; i++) {
      const q = adminQs[i]!;
      if (skipped[q.id] || addedErrors[q.id]) continue;
      n += statuses[i]?.errors.length ?? 0;
      const eid = (q.external_id ?? "").trim();
      if (eid && dupExternals.has(eid)) n += 1;
    }
    return n;
  }, [statuses, adminQs, dupExternals, skipped, addedErrors]);

  const packWarnings = useMemo(() => {
    let n = 0;
    for (let i = 0; i < adminQs.length; i++) {
      if (skipped[adminQs[i]!.id]) continue;
      n += statuses[i]?.warnings.length ?? 0;
    }
    return n;
  }, [statuses, adminQs, skipped]);

  const skippedCount = adminQs.filter((q) => skipped[q.id]).length;
  const allReviewed = kept.length > 0 && kept.every((q) => reviewed[q.id]);
  const canPublish = kept.length > 0 && packErrors === 0 && allReviewed && !published;

  const q = questions[idx];
  const adminQ = adminQs[idx];
  const status = statuses[idx];

  function markReviewed(id: string, value = true) {
    setReviewed((r) => ({ ...r, [id]: value }));
  }

  function markAllReviewed() {
    const next: Record<string, boolean> = {};
    for (const q of adminQs) next[q.id] = true;
    setReviewed(next);
  }

  function itemIsHardError(i: number): boolean {
    const q = adminQs[i];
    const s = statuses[i];
    if (!q || !s) return false;
    const eid = (q.external_id ?? "").trim();
    return s.errors.length > 0 || (!!eid && dupExternals.has(eid));
  }

  function skipItem(id: string) {
    setSkipped((s) => ({ ...s, [id]: true }));
    setAddedErrors((a) => ({ ...a, [id]: false }));
    setIdx((i) => Math.min(questions.length - 1, i + 1));
  }

  function skipHardErrors() {
    const next = { ...skipped };
    const added = { ...addedErrors };
    adminQs.forEach((q, i) => {
      if (itemIsHardError(i)) {
        next[q.id] = true;
        added[q.id] = false;
      }
    });
    setSkipped(next);
    setAddedErrors(added);
  }

  function addHardErrors() {
    const nextSkip = { ...skipped };
    const added = { ...addedErrors };
    adminQs.forEach((q, i) => {
      if (itemIsHardError(i)) {
        nextSkip[q.id] = false;
        added[q.id] = true;
      }
    });
    setSkipped(nextSkip);
    setAddedErrors(added);
  }

  async function setPublishedState(next: boolean) {
    if (busy) return;
    if (next && kept.length === 0) {
      alert("Every item is skipped. Keep at least one question to publish.");
      return;
    }
    if (next && !canPublish) {
      alert(
        packErrors > 0
          ? `Fix or skip ${packErrors} hard error(s) before publishing.`
          : "Mark every kept item as reviewed before publishing.",
      );
      return;
    }
    if (next) {
      const ok = confirm(
        `Publish “${title}”?\n\nKeeping ${kept.length} question${kept.length === 1 ? "" : "s"}.\nSkipping ${skippedCount} (removed from this pack).\nHard errors: ${packErrors}\nSoft warnings: ${packWarnings}`,
      );
      if (!ok) return;
    }
    setBusy(true);
    setConfirmPublish(false);
    try {
      const skipIds = adminQs.filter((item) => skipped[item.id]).map((item) => item.id);
      const keepIds = adminQs.filter((item) => !skipped[item.id]).map((item) => item.id);
      if (next && skipIds.length > 0) {
        const { error: unlinkErr } = await supabase
          .from("test_questions")
          .delete()
          .eq("test_id", testId)
          .in("question_id", skipIds);
        if (unlinkErr) throw new Error(unlinkErr.message);
      }
      const ids = next ? keepIds : adminQs.map((item) => item.id);
      if (ids.length > 0) {
        const { error: qe } = await supabase
          .from("questions")
          .update({ published: next })
          .in("id", ids)
          .eq("bank_format", "sqb");
        if (qe) throw new Error(qe.message);
      }
      const { error: te } = await supabase
        .from("tests")
        .update(next ? { published: true, in_test_base: false } : { published: false })
        .eq("id", testId)
        .eq("bank_format", "sqb");
      if (te) throw new Error(te.message);
      if (next && skipIds.length > 0) {
        const drop = new Set(skipIds);
        setAdminQs((prev) => prev.filter((item) => !drop.has(item.id)));
        setQuestions((prev) => prev.filter((item) => !drop.has(item.id)));
        setSkipped({});
        setIdx(0);
      }
      setPublished(next);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Publish failed.");
    } finally {
      setBusy(false);
    }
  }

  const externalDupNote =
    adminQ &&
    (adminQ.external_id ?? "").trim() &&
    dupExternals.has((adminQ.external_id ?? "").trim())
      ? "Duplicate external_id in this pack."
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Link
            to="/admin/sqb"
            className="tap inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white shadow-panel hover:bg-brand-400"
            aria-label="Back to SQB hub"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black tracking-tight text-brand-900">
              Review · {title || "SQB test"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {section ? SECTION_LABEL[section] : "SQB"} · walk items like students will see them,
              then publish when hard errors are clear.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              void navigate({
                to: "/admin/sqb/import",
                search: { testId } as never,
              })
            }
            className="tap rounded-lg border border-brand-400/50 bg-white px-3 py-2 text-sm font-semibold text-brand-700"
          >
            Back to editor
          </button>
          <button
            type="button"
            onClick={markAllReviewed}
            disabled={adminQs.length === 0}
            className="tap rounded-lg border border-brand-400/50 bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Mark all reviewed
          </button>
          {packErrors > 0 && !published && (
            <button
              type="button"
              onClick={skipHardErrors}
              className="tap rounded-lg border border-rose-400/60 bg-rose-700 px-3 py-2 text-sm font-semibold text-white"
            >
              Skip hard errors
            </button>
          )}
          {!published && adminQs.some((_, i) => itemIsHardError(i) && !addedErrors[adminQs[i]!.id]) && (
            <button
              type="button"
              onClick={addHardErrors}
              className="tap rounded-lg border border-emerald-400/60 bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"
            >
              Add hard errors
            </button>
          )}
          {published ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void setPublishedState(false)}
              className="tap rounded-lg border border-amber-500/50 bg-amber-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Unpublish
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || !canPublish}
              onClick={() => setConfirmPublish(true)}
              title={
                kept.length === 0
                  ? "Keep at least one question"
                  : canPublish
                    ? "Publish to Practice → SQB"
                    : packErrors > 0
                      ? "Fix or skip hard errors first"
                      : "Review every kept item first"
              }
              className="btn-brand rounded-lg bg-brand-400 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Publish
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-brand-400/40 bg-brand-600 px-4 py-3 text-sm text-white shadow-panel">
        <span>
          <strong className="tabular-nums">{adminQs.length}</strong> items
        </span>
        <span className="text-brand-200">·</span>
        <span className={packErrors ? "text-amber-100" : "text-emerald-200"}>
          <strong className="tabular-nums">{packErrors}</strong> hard errors
        </span>
        <span className="text-brand-200">·</span>
        <span>
          <strong className="tabular-nums">{packWarnings}</strong> warnings
        </span>
        <span className="text-brand-200">·</span>
        <span>
          <strong className="tabular-nums">
            {kept.filter((item) => reviewed[item.id]).length}/{kept.length}
          </strong>{" "}
          reviewed
        </span>
        {skippedCount > 0 && (
          <>
            <span className="text-brand-200">·</span>
            <span>
              <strong className="tabular-nums">{skippedCount}</strong> skipped
            </span>
          </>
        )}
        {!published && packErrors > 0 && (
          <span className="text-amber-100">
            Publish stays off until those hard errors are fixed, skipped, or added.
          </span>
        )}
        <span className="text-brand-200">·</span>
        <span
          className={
            published
              ? "rounded bg-emerald-600 px-2 py-0.5 text-xs font-bold uppercase"
              : "rounded bg-amber-700 px-2 py-0.5 text-xs font-bold uppercase"
          }
        >
          {published ? "Published" : "Draft"}
        </span>
      </div>

      {confirmPublish && (
        <div className="rounded-xl border border-brand-400/50 bg-white p-4 shadow-panel">
          <p className="text-sm font-semibold text-slate-800">
            Publish this SQB pack to Practice?
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Keeping {kept.length}. Skipping {skippedCount} (removed from this pack). Hard errors:{" "}
            {packErrors} · Warnings: {packWarnings}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void setPublishedState(true)}
              className="btn-brand rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm publish"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmPublish(false)}
              className="tap rounded-lg border px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
        </div>
      ) : err && questions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-300 bg-white p-10 text-center">
          <p className="font-semibold text-slate-800">{err}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              to="/admin/sqb/import"
              search={{ testId }}
              className="text-sm font-bold text-brand-600"
            >
              Attach questions
            </Link>
            <Link to="/admin/sqb" className="text-sm font-bold text-slate-500">
              Back to hub
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="overflow-hidden rounded-2xl border border-test-line bg-test-canvas shadow-panel">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-test-line bg-test-chrome px-4 py-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-test-muted">
                <Eye className="h-3.5 w-3.5" />
                Student chrome
              </span>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-test-muted">
                <input
                  type="checkbox"
                  checked={showAnswers}
                  onChange={(e) => setShowAnswers(e.target.checked)}
                  className="h-3.5 w-3.5 accent-test-accent"
                />
                Preview answers
              </label>
            </div>
            {q ? (
              <QuestionCard
                q={q}
                index={idx}
                answer={emptyAnswer()}
                onChange={() => {}}
                reveal={showAnswers}
                correctChoiceId={showAnswers ? (q.correct_choice_id ?? null) : null}
                correctGridAnswers={showAnswers ? (q.correct_grid_answers ?? null) : null}
              />
            ) : null}
            <div className="flex h-14 items-center justify-between border-t border-test-line bg-test-chrome px-4">
              <button
                type="button"
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                disabled={idx === 0}
                className="tap inline-flex items-center gap-1 rounded-full border border-test-accent bg-white px-4 py-1.5 text-sm font-bold text-test-accent disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <span className="text-xs font-bold tabular-nums text-test-muted">
                {idx + 1} / {questions.length}
              </span>
              <div className="flex items-center gap-2">
                {adminQ && !published && (
                  <button
                    type="button"
                    onClick={() =>
                      skipped[adminQ.id]
                        ? setSkipped((s) => ({ ...s, [adminQ.id]: false }))
                        : skipItem(adminQ.id)
                    }
                    className="tap rounded-full border border-test-edge bg-white px-3 py-1.5 text-sm font-bold text-test-muted hover:text-test-ink"
                  >
                    {skipped[adminQ.id] ? "Keep" : "Skip"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIdx((i) => Math.min(questions.length - 1, i + 1))}
                  disabled={idx >= questions.length - 1}
                  className="tap inline-flex items-center gap-1 rounded-full bg-test-accent px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <aside className="space-y-3">
            <div className="rounded-2xl border border-brand-400/40 bg-white p-3 shadow-panel">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Navigator
              </p>
              <ol className="flex flex-wrap gap-1.5">
                {statuses.map((s, i) => {
                  const isSkipped = !!skipped[s.id];
                  const tone = isSkipped
                    ? "bg-slate-300 text-slate-500 line-through"
                    : s.errors.length > 0 ||
                        (adminQs[i] &&
                          (adminQs[i].external_id ?? "").trim() &&
                          dupExternals.has((adminQs[i].external_id ?? "").trim()))
                      ? "bg-rose-500 text-white"
                      : s.warnings.length > 0
                        ? "bg-amber-500 text-white"
                        : s.reviewed
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-200 text-slate-700";
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setIdx(i)}
                        className={cn(
                          "tap h-8 min-w-8 rounded-md px-2 text-[11px] font-bold tabular-nums",
                          tone,
                          i === idx && "ring-2 ring-brand-400 ring-offset-1",
                        )}
                      >
                        {i + 1}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="rounded-2xl border border-brand-400/40 bg-white p-4 shadow-panel">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                QA · Question {idx + 1}
              </p>
              {adminQ && (
                <dl className="mt-2 space-y-1 text-xs text-slate-600">
                  <div>
                    <dt className="inline font-semibold text-slate-800">ID: </dt>
                    <dd className="inline">{adminQ.external_id || "—"}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-slate-800">Domain: </dt>
                    <dd className="inline">{adminQ.domain || adminQ.skill || "—"}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-slate-800">Skill: </dt>
                    <dd className="inline">{adminQ.subskill || "—"}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-slate-800">Diff: </dt>
                    <dd className="inline">{adminQ.difficulty}</dd>
                  </div>
                </dl>
              )}

              <ul className="mt-3 space-y-1.5">
                {status?.errors.map((e, i) => (
                  <li key={`e-${i}`} className="flex gap-2 text-xs font-semibold text-rose-700">
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {e.message}
                  </li>
                ))}
                {externalDupNote && (
                  <li className="flex gap-2 text-xs font-semibold text-rose-700">
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {externalDupNote}
                  </li>
                )}
                {status?.warnings.map((w, i) => (
                  <li key={`w-${i}`} className="flex gap-2 text-xs text-amber-700">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {w.message}
                  </li>
                ))}
                {status &&
                  status.errors.length === 0 &&
                  !externalDupNote &&
                  status.warnings.length === 0 && (
                    <li className="flex gap-2 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      No issues on this item
                    </li>
                  )}
              </ul>

              {adminQ && skipped[adminQ.id] && (
                <p className="mt-3 text-xs font-semibold text-slate-500">
                  Skipped. It will be removed from this pack when you publish.
                </p>
              )}

              {adminQ && (
                <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!reviewed[adminQ.id]}
                    onChange={(e) => markReviewed(adminQ.id, e.target.checked)}
                    className="h-4 w-4 accent-brand-400"
                  />
                  Reviewed
                </label>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
