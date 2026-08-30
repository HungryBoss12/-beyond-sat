import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AmbientGlow } from "@/components/ui/reveal-card";
import { PageHead, Panel } from "@/components/ui/panel";
import { DeckTreeList } from "@/components/vocab/DeckTreeList";
import { fetchDeckPickerRows, type DeckPickerRow } from "@/lib/vocab/client";
import { startVocabReminderPoll } from "@/lib/vocab/reminders";

export const Route = createFileRoute("/_authenticated/vocab/decks")({
  component: VocabDecksPage,
  head: () => ({ meta: [{ title: "Decks — BeyondSAT" }] }),
});

function VocabDecksPage() {
  const [rows, setRows] = useState<DeckPickerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchDeckPickerRows();
        setRows(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load decks");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    return startVocabReminderPoll(async () => {
      const fresh = await fetchDeckPickerRows();
      setRows(fresh);
      return fresh.reduce((n, r) => n + r.dueCount, 0);
    }, "Vocab");
  }, []);

  const totalDue = rows.reduce((n, r) => n + r.dueCount, 0);

  return (
    <div className="relative isolate mx-auto max-w-2xl space-y-6 pb-10">
      <AmbientGlow />
      <PageHead
        title="Decks"
        subtitle={
          totalDue > 0
            ? `${totalDue} cards due across your collections.`
            : "Pick a collection to review. Counts show new, learning, and review."
        }
        action={
          <Link
            to="/vocab"
            className="tap inline-flex items-center gap-2 text-sm font-bold text-brand-300 hover:text-brand-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Vocab hub
          </Link>
        }
      />

      <div className="flex justify-end gap-4 text-xs font-semibold text-brand-200/80">
        <span className="text-sky-300">New</span>
        <span className="text-red-300">Learning</span>
        <span className="text-emerald-300">Review</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand-300" />
        </div>
      ) : error ? (
        <Panel className="p-6 text-center text-brand-100">{error}</Panel>
      ) : rows.length === 0 ? (
        <Panel className="p-6 text-center text-white/60">
          No decks yet. Ask an admin to import vocabulary.
        </Panel>
      ) : (
        <DeckTreeList rows={rows} />
      )}
    </div>
  );
}
