import { generateVocabBatch } from "../ai-generate";
import { jsonResponse, requireStaff } from "../rest";

export async function handleVocabGenerate(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const auth = await requireStaff(request, env);
  if (!auth.ok) return auth.response;

  let body: { words?: unknown; topic?: unknown; count?: unknown };
  try {
    body = (await request.json()) as { words?: unknown; topic?: unknown; count?: unknown };
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const words =
    typeof body.words === "string"
      ? body.words
          .split(/[\n,]+/)
          .map((w) => w.trim())
          .filter(Boolean)
      : Array.isArray(body.words)
        ? body.words.filter((w): w is string => typeof w === "string").map((w) => w.trim())
        : undefined;

  const topic = typeof body.topic === "string" ? body.topic.trim() : undefined;
  const count = typeof body.count === "number" ? body.count : undefined;

  if (!words?.length && !topic) {
    return jsonResponse({ error: "Provide words or a topic" }, 400);
  }

  try {
    const items = await generateVocabBatch({ env, words, topic, count });
    return jsonResponse({ items });
  } catch (e) {
    console.error("[vocab/generate]", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Generation failed" },
      502,
    );
  }
}
