import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { VocabReviewer } from "@/components/admin-vocab/vocab-reviewer";
import { mergeGeneratedIntoDraft, type VocabDraft } from "@/components/admin-vocab/types";
import { PageHead, Panel } from "@/components/ui/panel";
import {
  deleteVocabCard,
  fetchAdminDeckCards,
  fixVocabWords,
  patchVocabCard,
  type AdminVocabCard,
} from "@/lib/vocab/client";
import { supabase } from "@/integrations/supabase/client";
import type { DifficultyTier } from "@/lib/vocab/types";

export const Route = createFileRoute("/_authenticated/admin/vocab/deck/$deckId")({
  component: AdminVocabDeckWordsPage,
  head: () => ({ meta: [{ title: "Deck words — Admin" }] }),
});

function cardToDraft(card: AdminVocabCard): VocabDraft {
  return {
    word: card.word,
    partOfSpeech: card.part_of_speech,
    definition: card.definition,
    dSatPassage: card.dsat_passage,
    rootsEtymology: card.roots_etymology ?? undefined,
    synonyms: card.synonyms ?? [],
    satTraps: card.sat_traps ?? undefined,
    difficultyTier: (card.difficulty_tier as DifficultyTier) ?? "Medium",
    exampleSentence: card.example_sentence ?? undefined,
    antonym: card.antonym ?? undefined,
    setLabel: card.set_label ?? undefined,
    quizQuestion: {
      passageText: card.dsat_passage,
      options: [],
      correctAnswer: card.word,
      explanation: "",
    },
    reviewed: false,
  };
}

function AdminVocabDeckWordsPage() {
  const { deckId } = Route.useParams();
  const [deckTitle, setDeckTitle] = useState("");
  const [cards, setCards] = useState<AdminVocabCard[]>([]);
  const [drafts, setDrafts] = useState<VocabDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [fixingIndex, setFixingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: deck }, rows] = await Promise.all([
        supabase.from("vocab_decks").select("title").eq("id", deckId).maybeSingle(),
        fetchAdminDeckCards(deckId),
      ]);
      setDeckTitle(deck?.title ?? "Deck");
      setCards(rows);
      setDrafts(rows.map(cardToDraft));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load deck");
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function persistDraft(index: number, draft: VocabDraft) {
    const card = cards[index];
    if (!card) return;
    await patchVocabCard(card.id, {
      word: draft.word,
      part_of_speech: draft.partOfSpeech,
      definition: draft.definition,
      dsat_passage: draft.dSatPassage,
      roots_etymology: draft.rootsEtymology ?? null,
      synonyms: draft.synonyms,
      sat_traps: draft.satTraps ?? null,
      difficulty_tier: draft.difficultyTier ?? "Medium",
      example_sentence: draft.exampleSentence ?? null,
      antonym: draft.antonym ?? null,
      set_label: draft.setLabel ?? null,
    });
  }

  function updateDraft(i: number, patch: Partial<VocabDraft>) {
    setDrafts((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  async function saveDraftAt(i: number) {
    const draft = drafts[i];
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      await persistDraft(i, draft);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeDraft(i: number) {
    const card = cards[i];
    if (!card) return;
    if (!confirm(`Delete "${card.word}" from this deck?`)) return;
    setSaving(true);
    setError(null);
    try {
      await deleteVocabCard(card.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  async function fixDraftAt(index: number) {
    const draft = drafts[index];
    if (!draft?.word.trim()) return;
    setFixing(true);
    setFixingIndex(index);
    setError(null);
    try {
      const [generated] = await fixVocabWords([draft.word.trim()]);
      if (generated) {
        const merged = mergeGeneratedIntoDraft(draft, generated);
        updateDraft(index, merged);
        await persistDraft(index, merged);
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fix with AI failed");
    } finally {
      setFixing(false);
      setFixingIndex(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-brand-300" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <PageHead
        title={deckTitle}
        subtitle={`${cards.length} word${cards.length === 1 ? "" : "s"} in this deck.`}
        action={
          <Link
            to="/admin/vocab/decks"
            className="tap inline-flex items-center gap-2 text-sm font-semibold text-brand-200 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            All decks
          </Link>
        }
      />

      {error ? (
        <Panel className="p-4 text-sm text-red-200 ring-1 ring-red-400/30">{error}</Panel>
      ) : null}

      {drafts.length === 0 ? (
        <Panel className="p-6 text-center text-brand-100">This deck has no cards.</Panel>
      ) : (
        <Panel className="space-y-4 p-4">
          <VocabReviewer
            drafts={drafts}
            disabled={saving || fixing}
            fixingIndex={fixingIndex}
            showQuizFields={false}
            onChange={(i, patch) => {
              updateDraft(i, patch);
            }}
            onSetReviewed={(i, reviewed) => {
              updateDraft(i, { reviewed });
              if (reviewed) void saveDraftAt(i);
            }}
            onFixOne={(i) => void fixDraftAt(i)}
            onRemove={(i) => void removeDraft(i)}
          />
          <p className="text-xs text-brand-200">
            Changes save when you mark a word as reviewed. Fix with AI saves immediately.
          </p>
        </Panel>
      )}
    </div>
  );
}
