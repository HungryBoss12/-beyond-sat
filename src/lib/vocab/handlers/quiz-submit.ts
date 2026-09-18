import { enqueueMissedWords } from "../missed-words";
import { jsonResponse, requireUser, restRpc } from "../rest";

type AnswerPayload = {
  questionId: string;
  selected: string;
};

type SubmitResult = {
  score: number;
  total: number;
  percent: number;
  missed_card_ids: string[];
  results: {
    questionId: string;
    correct: boolean;
    correctAnswer: string;
    explanation: string;
  }[];
};

type SubmitRpcResult = Partial<SubmitResult> & { error?: string };

const MAX_ANSWERS = 200;

export async function handleVocabQuizSubmit(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const auth = await requireUser(request, env);
  if (!auth.ok) return auth.response;

  let body: { quizId?: unknown; answers?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const quizId = typeof body.quizId === "string" ? body.quizId.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(quizId)) {
    return jsonResponse({ error: "quizId required" }, 400);
  }

  const answers = Array.isArray(body.answers) ? (body.answers as AnswerPayload[]) : [];
  if (answers.length === 0) {
    return jsonResponse({ error: "answers required" }, 400);
  }
  if (answers.length > MAX_ANSWERS) {
    return jsonResponse({ error: "Too many answers" }, 400);
  }
  const questionIds: string[] = [];
  const selected: string[] = [];
  for (const a of answers) {
    if (!a || typeof a.questionId !== "string") {
      return jsonResponse({ error: "Invalid answers payload" }, 400);
    }
    questionIds.push(a.questionId);
    selected.push(typeof a.selected === "string" ? a.selected : "");
  }

  // Grading happens entirely inside the SECURITY DEFINER RPC: the answer key
  // is never readable by the caller, and the attempt is recorded atomically.
  const result = await restRpc<SubmitRpcResult>(
    auth.config,
    auth.token,
    "submit_vocab_quiz",
    { p_quiz_id: quizId, p_question_ids: questionIds, p_selected: selected },
  );

  if (result.error) {
    return jsonResponse({ error: result.error }, result.status === 200 ? 400 : result.status);
  }
  // The RPC signals a duplicate submit / rate cap with an `error` field inside
  // a 200 body (it returns jsonb, so PostgREST reports 200).
  if (result.data?.error === "already-submitted") {
    return jsonResponse({ error: "That quiz was just submitted. Check your results." }, 409);
  }
  if (result.data?.error === "too-many-attempts") {
    return jsonResponse({ error: "Too many attempts on this quiz today. Try again tomorrow." }, 429);
  }
  if (!result.data || typeof result.data.score !== "number") {
    return jsonResponse({ error: "Grading failed" }, 502);
  }

  const data = result.data as SubmitResult;
  await enqueueMissedWords(auth.config, auth.token, auth.user.id, data.missed_card_ids ?? []);

  return jsonResponse({
    attemptId: null,
    score: data.score,
    total: data.total,
    percent: data.percent,
    results: data.results ?? [],
    missedQueued: (data.missed_card_ids ?? []).length,
  });
}
