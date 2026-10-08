import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { PageHead, Panel } from "@/components/ui/panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NewTestDialog } from "@/components/vocab/YourTests";
import {
  decideSubmission,
  fetchPendingSubmissions,
  fetchSubmissionDetail,
  fetchTestQuota,
  saveDailyTestCap,
  type PendingSubmission,
} from "@/lib/vocab/user-content";

export const Route = createFileRoute("/_authenticated/admin/vocab/applies")({
  component: AdminAppliesPage,
  head: () => ({ meta: [{ title: "Applies — Admin" }] }),
});

function AdminAppliesPage() {
  const { staffRole } = useRouteContext({ from: "/_authenticated/admin" });
  const [rows, setRows] = useState<PendingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cap, setCap] = useState("5");
  const [openTest, setOpenTest] = useState(false);
  const [review, setReview] = useState<PendingSubmission | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pending, quota] = await Promise.all([fetchPendingSubmissions(), fetchTestQuota()]);
      setRows(pending);
      setCap(String(quota.cap));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load applies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <PageHead
        title="Applies"
        subtitle="Decks and tests students sent for checking."
        action={
          <button
            type="button"
            onClick={() => setOpenTest(true)}
            className="tap rounded-xl bg-brand-600 px-3 py-2 text-sm font-bold text-white"
          >
            New test
          </button>
        }
      />

      {staffRole === "admin" ? (
        <Panel className="flex flex-wrap items-end gap-3 p-4">
          <label className="text-sm font-semibold text-white">
            Tests a student can create per day
            <input
              type="number"
              min={0}
              max={50}
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              className="mt-1 block w-28 rounded-xl border border-white/20 bg-brand-800 px-3 py-2 text-white"
            />
          </label>
          <button
            type="button"
            onClick={() =>
              void saveDailyTestCap(Number(cap))
                .then(() => load())
                .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not save"))
            }
            className="tap rounded-xl bg-white px-3 py-2 text-sm font-bold text-brand-700"
          >
            Save limit
          </button>
        </Panel>
      ) : null}

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-brand-200" />
        </div>
      ) : rows.length === 0 ? (
        <Panel className="p-5 text-sm text-brand-100">Nothing is waiting.</Panel>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <button
              key={`${row.kind}-${row.id}`}
              type="button"
              onClick={() => setReview(row)}
              className="tap flex w-full items-center justify-between gap-3 rounded-2xl border border-brand-400/40 bg-brand-600 px-4 py-3 text-left text-white"
            >
              <span className="min-w-0">
                <span className="block truncate font-bold">
                  {row.title}
                  <span className="ml-2 text-xs font-semibold text-brand-100">
                    {row.kind === "deck" ? "Deck" : "Test"}
                  </span>
                </span>
                <span className="text-xs text-brand-100">
                  @{row.username ?? "student"}
                  {row.submitted_at
                    ? ` · ${new Date(row.submitted_at).toLocaleDateString()}`
                    : ""}
                </span>
              </span>
              <span className="text-sm font-bold text-brand-100">Review</span>
            </button>
          ))}
        </div>
      )}

      <ReviewDialog
        row={review}
        onClose={() => setReview(null)}
        onDone={() => {
          setReview(null);
          void load();
        }}
      />
      <NewTestDialog
        open={openTest}
        publishNow
        onOpenChange={setOpenTest}
        onCreated={() => setOpenTest(false)}
      />
    </div>
  );
}

function ReviewDialog({
  row,
  onClose,
  onDone,
}: {
  row: PendingSubmission | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [cards, setCards] = useState<{ word: string; definition: string }[]>([]);
  const [questions, setQuestions] = useState<{ passage_text: string; options: string[] }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!row) return;
    setError(null);
    void fetchSubmissionDetail(row.kind, row.id)
      .then((detail) => {
        setCards(detail.cards);
        setQuestions(detail.questions);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not open that"));
  }, [row]);

  async function decide(approve: boolean) {
    if (!row) return;
    setBusy(true);
    setError(null);
    try {
      await decideSubmission(row.kind, row.id, approve);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update that");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle>{row?.title}</DialogTitle>
          <DialogDescription>
            @{row?.username ?? "student"} · {row?.kind === "deck" ? "Deck" : "Test"}
          </DialogDescription>
        </DialogHeader>
        {row?.kind === "deck" ? (
          <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
            {cards.map((card) => (
              <li key={card.word}>
                <span className="font-semibold">{card.word}</span>
                <span className="text-slate-500"> — {card.definition}</span>
              </li>
            ))}
            {cards.length === 0 ? <li className="text-slate-500">No cards.</li> : null}
          </ul>
        ) : (
          <ol className="max-h-72 list-decimal space-y-3 overflow-y-auto pl-5 text-sm">
            {questions.map((question, index) => (
              <li key={index}>
                <p>{question.passage_text}</p>
                <p className="mt-1 text-slate-500">{question.options.join(" · ")}</p>
              </li>
            ))}
            {questions.length === 0 ? <li className="text-slate-500">No questions.</li> : null}
          </ol>
        )}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void decide(true)}
            className="tap rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void decide(false)}
            className="tap rounded-xl px-4 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200 disabled:opacity-50"
          >
            Send back
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
