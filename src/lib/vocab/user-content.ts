import { supabase } from "@/integrations/supabase/client";
import { parseApkgFile, parsePastedCards } from "@/lib/vocab/parse-apkg";
import type { GeneratedVocabItem, VocabDeck, VocabQuiz, VocabVisibility } from "@/lib/vocab/types";

type Db = {
  from: (table: string) => {
    select: (cols: string) => DbFilter;
    insert: (row: unknown) => DbWrite;
    update: (row: unknown) => DbFilter;
    delete: () => DbFilter;
  };
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  auth: typeof supabase.auth;
};

type DbFilter = {
  eq: (col: string, value: unknown) => DbFilter;
  in: (col: string, values: unknown[]) => DbFilter;
  order: (col: string, opts?: { ascending?: boolean }) => DbFilter;
  limit: (n: number) => DbFilter;
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
  then: Promise<{ data: unknown; error: { message: string } | null }>["then"];
};

type DbWrite = DbFilter & {
  select: (cols: string) => DbFilter;
};

const db = supabase as unknown as Db;

export type OwnedDeck = VocabDeck & {
  visibility: VocabVisibility;
  owner_id: string | null;
  submitted_at: string | null;
};

export type OwnedQuiz = VocabQuiz & {
  visibility: VocabVisibility;
  owner_id: string | null;
  submitted_at: string | null;
};

export type TestQuota = { cap: number; used: number };

export type ReadableDeck = { id: string; title: string; visibility: VocabVisibility };

export type ManualQuestion = {
  passage: string;
  options: string[];
  answer: string;
  explanation: string;
};

function raise(error: { message: string } | null, fallback: string): void {
  if (!error) return;
  if (/daily test limit reached/i.test(error.message)) {
    throw new Error("You have used today's practice-test limit. Try again tomorrow.");
  }
  throw new Error(error.message || fallback);
}

export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user?.id;
  if (!id) throw new Error("Sign in to continue.");
  return id;
}

export async function creatorNameMap(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, string>();
  if (!unique.length) return map;
  const { data, error } = await db.rpc("vocab_creator_names", { p_ids: unique });
  raise(error, "Could not load names");
  for (const row of (data ?? []) as { id: string; username: string | null }[]) {
    if (row.username) map.set(row.id, row.username);
  }
  return map;
}

export async function fetchTestQuota(): Promise<TestQuota> {
  const { data, error } = await db.rpc("vocab_user_test_quota");
  raise(error, "Could not check today's limit");
  const row = Array.isArray(data) ? data[0] : data;
  const quota = row as { cap?: number; used?: number } | null;
  return { cap: quota?.cap ?? 5, used: quota?.used ?? 0 };
}

export async function fetchMyDecks(): Promise<OwnedDeck[]> {
  const uid = await currentUserId();
  const { data, error } = await db
    .from("vocab_decks")
    .select("id,title,description,parent_id,sort_order,is_folder,path,created_at,owner_id,visibility,submitted_at")
    .eq("owner_id", uid)
    .order("created_at", { ascending: false });
  raise(error, "Could not load your decks");
  return ((data ?? []) as OwnedDeck[]).filter((deck) => deck.visibility !== "published");
}

export async function fetchMyTests(): Promise<OwnedQuiz[]> {
  const uid = await currentUserId();
  const { data, error } = await db
    .from("vocab_quizzes")
    .select("id,title,description,time_limit_seconds,created_at,owner_id,visibility,submitted_at")
    .eq("owner_id", uid)
    .order("created_at", { ascending: false });
  raise(error, "Could not load your tests");
  return ((data ?? []) as OwnedQuiz[]).filter((quiz) => quiz.visibility !== "published");
}

export async function fetchReadableDecks(): Promise<ReadableDeck[]> {
  const { data, error } = await db
    .from("vocab_decks")
    .select("id,title,visibility,is_folder")
    .order("title", { ascending: true });
  raise(error, "Could not load decks");
  return ((data ?? []) as (ReadableDeck & { is_folder?: boolean })[])
    .filter((deck) => !deck.is_folder)
    .map((deck) => ({ id: deck.id, title: deck.title, visibility: deck.visibility ?? "published" }));
}

export function cardsFromPaste(text: string): GeneratedVocabItem[] {
  return parsePastedCards(text);
}

export async function cardsFromFile(file: File): Promise<GeneratedVocabItem[]> {
  const result = await parseApkgFile(file);
  return result.items;
}

function cardRow(item: GeneratedVocabItem, deckId: string) {
  return {
    word: item.word.trim().toLowerCase(),
    part_of_speech: item.partOfSpeech || "unknown",
    definition: item.definition,
    dsat_passage: item.dSatPassage,
    roots_etymology: item.rootsEtymology ?? null,
    synonyms: item.synonyms ?? [],
    sat_traps: item.satTraps ?? null,
    difficulty_tier: item.difficultyTier ?? "Medium",
    deck_id: deckId,
    example_sentence: item.exampleSentence ?? null,
    antonym: item.antonym ?? null,
    set_label: item.setLabel ?? null,
  };
}

export async function saveOwnedDeck(input: {
  deckId?: string;
  title: string;
  items: GeneratedVocabItem[];
}): Promise<string> {
  const title = input.title.trim();
  if (!title) throw new Error("Name the deck first.");
  const uid = await currentUserId();
  let deckId = input.deckId;
  if (!deckId) {
    if (!input.items.length) throw new Error("Add at least one card.");
    const { data, error } = await db
      .from("vocab_decks")
      .insert({
        title,
        description: null,
        owner_id: uid,
        visibility: "private",
        is_folder: false,
        parent_id: null,
        sort_order: 0,
      })
      .select("id")
      .maybeSingle();
    raise(error, "Could not create the deck");
    deckId = (data as { id: string } | null)?.id;
    if (!deckId) throw new Error("Could not create the deck");
  } else {
    const { error } = await db.from("vocab_decks").update({ title }).eq("id", deckId);
    raise(error, "Could not rename the deck");
  }

  for (const item of input.items) {
    const { error } = await db.from("vocab_cards").insert(cardRow(item, deckId));
    if (error && !/duplicate|23505/i.test(error.message)) raise(error, "Could not save a card");
  }
  return deckId;
}

export async function deleteOwnedDeck(deckId: string): Promise<void> {
  const { error: cardError } = await db.from("vocab_cards").delete().eq("deck_id", deckId);
  raise(cardError, "Could not delete the cards");
  const { error } = await db.from("vocab_decks").delete().eq("id", deckId);
  raise(error, "Could not delete the deck");
}

export async function submitForReview(kind: "deck" | "test", id: string): Promise<void> {
  const table = kind === "deck" ? "vocab_decks" : "vocab_quizzes";
  const { error } = await db
    .from(table)
    .update({ visibility: "pending", submitted_at: new Date().toISOString() })
    .eq("id", id);
  raise(error, "Could not send that for checking");
}

export async function deleteOwnedTest(quizId: string): Promise<void> {
  const { error } = await db.from("vocab_quizzes").delete().eq("id", quizId);
  raise(error, "Could not delete the test");
}

export async function createOwnedTest(input: {
  title: string;
  questions: ManualQuestion[];
  publish?: boolean;
}): Promise<string> {
  const title = input.title.trim();
  if (!title) throw new Error("Name the test first.");
  const questions = input.questions.filter(
    (q) => q.passage.trim() && q.options.filter((o) => o.trim()).length >= 2 && q.answer.trim(),
  );
  if (!questions.length) throw new Error("Add at least one complete question.");
  const uid = await currentUserId();
  const { data, error } = await db
    .from("vocab_quizzes")
    .insert({
      title,
      description: input.publish ? "Staff practice test" : "Student practice test",
      owner_id: uid,
      visibility: input.publish ? "published" : "private",
      time_limit_seconds: null,
    })
    .select("id")
    .maybeSingle();
  raise(error, "Could not create the test");
  const quizId = (data as { id: string } | null)?.id;
  if (!quizId) throw new Error("Could not create the test");

  let position = 0;
  for (const question of questions) {
    const options = question.options.map((o) => o.trim()).filter(Boolean);
    const { error: qError } = await db
      .from("vocab_quiz_questions")
      .insert({
        quiz_id: quizId,
        vocab_card_id: null,
        passage_text: question.passage.trim(),
        correct_answer: question.answer.trim(),
        options,
        explanation: question.explanation.trim() || "Review the word in context.",
        position: position++,
      })
      .select("id");
    if (qError) {
      await db.from("vocab_quizzes").delete().eq("id", quizId);
      raise(qError, "Could not save a question");
    }
  }
  return quizId;
}

export async function generateTestQuestions(input: {
  deckId: string;
  count: number;
  difficulty: string;
  prompt: "word" | "definition";
}): Promise<ManualQuestion[]> {
  const { data: cards, error } = await db
    .from("vocab_cards")
    .select("word,definition")
    .eq("deck_id", input.deckId)
    .limit(80);
  raise(error, "Could not read that deck");
  const rows = (cards ?? []) as { word: string; definition: string }[];
  if (!rows.length) throw new Error("That deck has no cards yet.");
  const list = rows
    .slice(0, 60)
    .map((row) => `${row.word} — ${row.definition}`)
    .join("\n");
  const count = Math.min(8, Math.max(1, input.count));
  const prompt =
    input.prompt === "definition"
      ? "The passage should give a definition or a blank, and the options should be words from the deck."
      : "The passage should use the target word in context, and the options should be definitions.";
  const text = await askQuick(
    [
      "Write Digital SAT Words-in-Context questions as JSON.",
      `Create exactly ${count} questions.`,
      `Difficulty: ${input.difficulty}.`,
      prompt,
      "Use only the deck below. Each question needs a short passage, four options, one answer that matches an option exactly, and a one-sentence explanation.",
      'Return only a JSON array of objects with keys "passage", "options", "answer", and "explanation".',
      "",
      list,
    ].join("\n"),
  );
  return parseGeneratedQuestions(text, count);
}

async function askQuick(prompt: string): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in to generate a test.");
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      task: "quick",
      model: "beyonder-2-0-flashy",
      surface: "page",
      stream: false,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const body = (await response.json()) as { content?: string; error?: string };
  if (!response.ok) throw new Error(body.error ?? "Beyond AI is unavailable.");
  return body.content ?? "";
}

function parseGeneratedQuestions(raw: string, count: number): ManualQuestion[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) {
    throw new Error("The model did not return questions. Try a smaller number.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new Error("The model did not return questions. Try a smaller number.");
  }
  if (!Array.isArray(parsed)) throw new Error("The model did not return questions.");
  const questions: ManualQuestion[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const item = row as { passage?: unknown; options?: unknown; answer?: unknown; explanation?: unknown };
    const passage = typeof item.passage === "string" ? item.passage.trim() : "";
    const options = Array.isArray(item.options)
      ? item.options.filter((o): o is string => typeof o === "string" && o.trim().length > 0).map((o) => o.trim())
      : [];
    const answer = typeof item.answer === "string" ? item.answer.trim() : "";
    if (!passage || options.length < 2 || !options.includes(answer)) continue;
    questions.push({
      passage,
      options: options.slice(0, 4),
      answer,
      explanation: typeof item.explanation === "string" ? item.explanation.trim() : "",
    });
    if (questions.length >= count) break;
  }
  if (!questions.length) throw new Error("The model did not return usable questions. Try again.");
  return questions;
}

export type PendingSubmission = {
  id: string;
  kind: "deck" | "test";
  title: string;
  owner_id: string | null;
  username: string | null;
  submitted_at: string | null;
};

export async function fetchPendingSubmissions(): Promise<PendingSubmission[]> {
  const [decks, tests] = await Promise.all([
    db
      .from("vocab_decks")
      .select("id,title,owner_id,submitted_at")
      .eq("visibility", "pending")
      .order("submitted_at", { ascending: true }),
    db
      .from("vocab_quizzes")
      .select("id,title,owner_id,submitted_at")
      .eq("visibility", "pending")
      .order("submitted_at", { ascending: true }),
  ]);
  raise(decks.error, "Could not load decks");
  raise(tests.error, "Could not load tests");
  const deckRows = (decks.data ?? []) as { id: string; title: string; owner_id: string | null; submitted_at: string | null }[];
  const testRows = (tests.data ?? []) as { id: string; title: string; owner_id: string | null; submitted_at: string | null }[];
  const names = await creatorNameMap([...deckRows, ...testRows].map((row) => row.id));
  return [
    ...deckRows.map((row) => ({
      id: row.id,
      kind: "deck" as const,
      title: row.title,
      owner_id: row.owner_id,
      username: names.get(row.id) ?? null,
      submitted_at: row.submitted_at,
    })),
    ...testRows.map((row) => ({
      id: row.id,
      kind: "test" as const,
      title: row.title,
      owner_id: row.owner_id,
      username: names.get(row.id) ?? null,
      submitted_at: row.submitted_at,
    })),
  ].sort((a, b) => (a.submitted_at ?? "").localeCompare(b.submitted_at ?? ""));
}

export async function fetchSubmissionDetail(kind: "deck" | "test", id: string): Promise<{
  cards: { word: string; definition: string }[];
  questions: { passage_text: string; options: string[] }[];
}> {
  if (kind === "deck") {
    const { data, error } = await db
      .from("vocab_cards")
      .select("word,definition")
      .eq("deck_id", id)
      .order("word", { ascending: true });
    raise(error, "Could not load cards");
    return { cards: (data ?? []) as { word: string; definition: string }[], questions: [] };
  }
  const { data, error } = await db
    .from("vocab_quiz_questions")
    .select("passage_text,options,position")
    .eq("quiz_id", id)
    .order("position", { ascending: true });
  raise(error, "Could not load questions");
  return {
    cards: [],
    questions: (data ?? []) as { passage_text: string; options: string[] }[],
  };
}

export async function decideSubmission(kind: "deck" | "test", id: string, approve: boolean): Promise<void> {
  const { error } = await db.rpc("staff_decide_vocab_submission", {
    p_kind: kind,
    p_id: id,
    p_approve: approve,
  });
  raise(error, approve ? "Could not approve that" : "Could not send that back");
}

export async function saveDailyTestCap(cap: number): Promise<void> {
  const next = Math.max(0, Math.min(50, Math.round(cap)));
  const { error } = await db
    .from("app_settings")
    .update({ value: String(next) })
    .eq("key", "vocab_user_test_daily_cap");
  raise(error, "Could not save the daily limit");
}
