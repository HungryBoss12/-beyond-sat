import { enqueueMissedWords } from "../missed-words";
import { jsonResponse, requireUser } from "../rest";
import type { VocabQuizQuestion } from "../types";

type AnswerPayload = {
  questionId: string;
  selected: string;
};

export async function handleVocabQuizSubmit(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const auth = await requireUser(request, env);
  if (!auth.ok) return auth.response;

  let body: { quizId?: unknown; answers?: unknown };
  try {
    body = (await request.json()) as { quizId?: unknown; answers?: unknown };
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const quizId = typeof body.quizId === "string" ? body.quizId : "";
  if (!quizId) return jsonResponse({ error: "quizId required" }, 400);

  const answers = Array.isArray(body.answers) ? (body.answers as AnswerPayload[]) : [];
  if (answers.length === 0) return jsonResponse({ error: "answers required" }, 400);

  const { restFetch } = await import("../rest");

  const { data: questions, error: qErr } = await restFetch<VocabQuizQuestion[]>(
    auth.config,
    auth.token,
    `vocab_quiz_questions?quiz_id=eq.${quizId}&select=*&order=position.asc`,
  );
  if (qErr || !questions?.length) {
    return jsonResponse({ error: "Quiz not found" }, 404);
  }

  const byId = new Map(questions.map((q) => [q.id, q]));
  let score = 0;
  const missedCardIds: string[] = [];
  const results: {
    questionId: string;
    correct: boolean;
    correctAnswer: string;
    explanation: string;
  }[] = [];

  for (const a of answers) {
    const q = byId.get(a.questionId);
    if (!q) continue;
    const ok = a.selected.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
    if (ok) score += 1;
    else if (q.vocab_card_id) missedCardIds.push(q.vocab_card_id);
    results.push({
      questionId: q.id,
      correct: ok,
      correctAnswer: q.correct_answer,
      explanation: q.explanation,
    });
  }

  const total = questions.length;

  const { data: attemptRows, error: aErr } = await restFetch<{ id: string }[]>(
    auth.config,
    auth.token,
    "vocab_quiz_attempts",
    {
      method: "POST",
      body: JSON.stringify({
        user_id: auth.user.id,
        quiz_id: quizId,
        score,
        total,
      }),
      headers: { Prefer: "return=representation" },
    },
  );

  if (aErr) {
    return jsonResponse({ error: aErr }, 500);
  }

  await enqueueMissedWords(auth.config, auth.token, auth.user.id, missedCardIds);

  return jsonResponse({
    attemptId: attemptRows?.[0]?.id,
    score,
    total,
    percent: Math.round((score / total) * 100),
    results,
    missedQueued: missedCardIds.length,
  });
}
