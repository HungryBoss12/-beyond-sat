import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { VocabCardPlayer } from "@/components/vocab/VocabCardPlayer";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/vocab/deck/$deckId")({
  component: VocabDeckByIdPage,
  head: () => ({ meta: [{ title: "Vocab Deck — BeyondSAT" }] }),
});

function VocabDeckByIdPage() {
  const { deckId } = Route.useParams();
  const [deckTitle, setDeckTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error: err } = await supabase
        .from("vocab_decks")
        .select("title")
        .eq("id", deckId)
        .maybeSingle();
      if (err) {
        setError(err.message);
        return;
      }
      setDeckTitle(data?.title ?? "Deck");
    })();
  }, [deckId]);

  if (error) {
    return (
      <div className="vocab-surface flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#0b0761] p-6 text-center">
        <p className="text-brand-100">{error}</p>
        <Link to="/vocab/decks" className="btn-brand tap rounded-xl px-4 py-2 text-sm font-bold">
          Back to decks
        </Link>
      </div>
    );
  }

  if (!deckTitle) {
    return (
      <div className="vocab-surface flex min-h-[100dvh] items-center justify-center bg-[#0b0761]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-300" />
      </div>
    );
  }

  return <VocabCardPlayer deckId={deckId} deckTitle={deckTitle} />;
}
