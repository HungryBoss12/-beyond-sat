import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, ArrowRight, Layers, Loader2 } from "lucide-react";
import { PageHead, Panel } from "@/components/ui/panel";
import { fetchDeckPickerRows, type DeckPickerRow } from "@/lib/vocab/client";
import { startVocabReminderPoll } from "@/lib/vocab/reminders";

export const Route = createFileRoute("/_authenticated/vocab/decks")({
  component: VocabDecksPage,
  head: () => ({ meta: [{ title: "SRS Decks — BeyondSAT" }] }),
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

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <PageHead
        title="SRS Decks"
        subtitle="Pick a deck to review. Each deck tracks its own due cards and progress."
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

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand-300" />
        </div>
      ) : error ? (
        <Panel className="p-6 text-center text-red-300">{error}</Panel>
      ) : rows.length === 0 ? (
        <Panel className="p-6 text-center text-white/60">
          No decks yet. Ask an admin to import vocabulary.
        </Panel>
      ) : (
        <div className="space-y-3">
          {rows.map((deck) => (
            <Link
              key={deck.id}
              to="/vocab/deck/$deckId"
              params={{ deckId: deck.id }}
              className="tap block"
            >
              <Panel className="group p-5 transition hover:border-brand-400/40">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-400/20 text-brand-100 ring-1 ring-brand-300/25">
                      <Layers className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">{deck.title}</h2>
                      {deck.description ? (
                        <p className="mt-0.5 text-sm text-white/60">{deck.description}</p>
                      ) : null}
                      <p className="mt-2 text-sm text-white/50">
                        {deck.cardCount} card{deck.cardCount === 1 ? "" : "s"}
                        {deck.lastStudied
                          ? ` · studied ${formatDistanceToNow(new Date(deck.lastStudied), { addSuffix: true })}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {deck.dueCount > 0 ? (
                      <span className="rounded-full bg-orange-500/20 px-2.5 py-0.5 text-xs font-bold text-orange-200">
                        {deck.dueCount} due
                      </span>
                    ) : (
                      <span className="text-xs text-white/40">Caught up</span>
                    )}
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-brand-300 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                      Study <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </Panel>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
