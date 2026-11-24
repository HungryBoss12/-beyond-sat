import { publicError } from "@/lib/http/public-error";
import { jsonReadError, readJsonLimited } from "@/lib/http/read-json";
import { sharedRateLimit } from "@/lib/shared-rate-limit";
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

  const limit = await sharedRateLimit(env, `vocab-quiz:${auth.user.id}`, 20, 6);
  if (!limit.ok) {
    return jsonResponse(
      { error: "Too many quiz submissions. Wait a moment and try again." },
      { status: 429, headers: { "retry-after": String(limit.retryAfter || 10) } },
    );
  }

  const read = await readJsonLimited<{ quizId?: unknown; answers?: unknown }>(request, 65_536);
  if (!read.ok) return jsonResponse(jsonReadError(read.status), read.status);
  const body = read.value ?? {};

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
  const seenIds = new Set<string>();
  for (const a of answers) {
    if (!a || typeof a.questionId !== "string") {
      return jsonResponse({ error: "Invalid answers payload" }, 400);
    }
    const qid = a.questionId.trim().toLowerCase();
    if (!/^[0-9a-f-]{36}$/.test(qid)) {
      return jsonResponse({ error: "Invalid answers payload" }, 400);
    }
    if (seenIds.has(qid)) {
      return jsonResponse({ error: "Duplicate question in answers" }, 400);
    }
    seenIds.add(qid);
    questionIds.push(qid);
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
    return jsonResponse(
      { error: publicError("vocab/quiz-submit", result.error, "Could not submit quiz.") },
      result.status === 200 ? 400 : result.status,
    );
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
