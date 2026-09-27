import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Mode = "list" | "base";

export function SqbTestDeleteDialog({
  testId,
  title,
  mode,
  onClose,
  onDone,
}: {
  testId: string;
  title: string;
  mode: Mode;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState<"archive" | "pack" | "questions" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function archive() {
    setBusy("archive");
    setError(null);
    const { error: upErr } = await supabase
      .from("tests")
      .update({ in_test_base: true, published: false })
      .eq("id", testId)
      .eq("bank_format", "sqb");
    setBusy(null);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    onDone();
  }

  async function deletePack(alsoExclusiveQuestions: boolean) {
    setBusy(alsoExclusiveQuestions ? "questions" : "pack");
    setError(null);
    const exclusive = alsoExclusiveQuestions ? await listExclusiveQuestions(testId) : [];
    if (typeof exclusive === "string") {
      setBusy(null);
      setError(exclusive);
      return;
    }
    const { error: delErr } = await supabase.from("tests").delete().eq("id", testId);
    if (delErr) {
      setBusy(null);
      setError(delErr.message);
      return;
    }
    if (exclusive.length > 0) {
      const { error: qErr } = await supabase.from("questions").delete().in("id", exclusive);
      setBusy(null);
      if (qErr) {
        alert(qErr.message);
      }
    } else {
      setBusy(null);
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-brand-900/50 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sqb-delete-title"
        className="w-full max-w-lg rounded-2xl border border-brand-400/40 bg-white p-6 shadow-float"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="sqb-delete-title" className="text-lg font-black text-slate-900">
              Delete “{title}”
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose what happens to this pack. This is not undone from here.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy != null}
            className="tap grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-2">
          {mode === "list" && (
            <ActionButton
              busy={busy === "archive"}
              disabled={busy != null}
              onClick={() => void archive()}
              title="Remove from the Tests list"
              body="The pack stays in Test Base and is unpublished. Its questions stay."
            />
          )}
          <ActionButton
            busy={busy === "pack"}
            disabled={busy != null}
            onClick={() => void deletePack(false)}
            title="Delete the pack from the database"
            body="Removes this test only. Questions remain in SQB Questions."
            danger
          />
          <ActionButton
            busy={busy === "questions"}
            disabled={busy != null}
            onClick={() => void deletePack(true)}
            title="Delete the pack and its exclusive questions"
            body="Also deletes questions that are not linked to any other test. Shared questions stay."
            danger
          />
        </div>

        {error && <p className="mt-4 text-sm font-semibold text-rose-700">{error}</p>}
      </div>
    </div>
  );
}

function ActionButton({
  title,
  body,
  onClick,
  busy,
  disabled,
  danger,
}: {
  title: string;
  body: string;
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "tap w-full rounded-xl border px-4 py-3 text-left disabled:opacity-50 " +
        (danger
          ? "border-rose-200 bg-rose-50 hover:bg-rose-100"
          : "border-brand-200 bg-brand-50 hover:bg-brand-100")
      }
    >
      <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {title}
      </span>
      <span className="mt-0.5 block text-xs text-slate-600">{body}</span>
    </button>
  );
}

/** Question ids whose only test link is this pack. Returns an error string on failure. */
async function listExclusiveQuestions(testId: string): Promise<string[] | string> {
  const { data: mine, error: mineErr } = await supabase
    .from("test_questions")
    .select("question_id")
    .eq("test_id", testId);
  if (mineErr) return mineErr.message;
  const ids = [...new Set((mine ?? []).map((row) => row.question_id))];
  if (ids.length === 0) return [];

  const { data: links, error: linkErr } = await supabase
    .from("test_questions")
    .select("question_id,test_id")
    .in("question_id", ids);
  if (linkErr) return linkErr.message;

  const shared = new Set(
    (links ?? []).filter((row) => row.test_id !== testId).map((row) => row.question_id),
  );
  return ids.filter((id) => !shared.has(id));
}
