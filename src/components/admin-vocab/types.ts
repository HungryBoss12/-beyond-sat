import type { GeneratedVocabItem } from "@/lib/vocab/types";

export type VocabDraft = GeneratedVocabItem & {
  reviewed: boolean;
  fixing?: boolean;
};

export function needsVocabAttention(draft: VocabDraft): boolean {
  if (!draft.word.trim() || !draft.definition.trim()) return true;
  if (/please update to the latest anki version/i.test(draft.word + draft.definition)) return true;
  if (draft.dSatPassage.startsWith('In academic writing, the word "')) return true;
  if (draft.synonyms.length === 0) return true;
  return false;
}

export function mergeGeneratedIntoDraft(
  draft: VocabDraft,
  generated: GeneratedVocabItem,
): VocabDraft {
  return {
    ...draft,
    word: generated.word || draft.word,
    partOfSpeech: generated.partOfSpeech || draft.partOfSpeech,
    definition: generated.definition || draft.definition,
    dSatPassage: generated.dSatPassage || draft.dSatPassage,
    rootsEtymology: generated.rootsEtymology ?? draft.rootsEtymology,
    synonyms: generated.synonyms?.length ? generated.synonyms : draft.synonyms,
    satTraps: generated.satTraps ?? draft.satTraps,
    difficultyTier: generated.difficultyTier ?? draft.difficultyTier,
    exampleSentence: generated.exampleSentence ?? draft.exampleSentence,
    antonym: generated.antonym ?? draft.antonym,
    setLabel: generated.setLabel ?? draft.setLabel,
    quizQuestion: generated.quizQuestion ?? draft.quizQuestion,
  };
}
