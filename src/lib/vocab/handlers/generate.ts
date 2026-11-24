import { publicError } from "@/lib/http/public-error";
import { jsonReadError, readJsonLimited } from "@/lib/http/read-json";
import { sharedRateLimit } from "@/lib/shared-rate-limit";
import { generateVocabBatch } from "../ai-generate";
import { jsonResponse, requireStaff } from "../rest";

export async function handleVocabGenerate(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const auth = await requireStaff(request, env);
  if (!auth.ok) return auth.response;

  const limit = await sharedRateLimit(env, `vocab-generate:${auth.user.id}`, 15, 4);
  if (!limit.ok) {
    return jsonResponse(
      { error: "Too many generation requests. Wait a moment." },
      { status: 429, headers: { "retry-after": String(limit.retryAfter || 15) } },
    );
  }

  const read = await readJsonLimited<{ words?: unknown; topic?: unknown; count?: unknown }>(
    request,
    65_536,
  );
  if (!read.ok) return jsonResponse(jsonReadError(read.status), read.status);
  const body = read.value ?? {};

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
    return jsonResponse(
      {
        error: publicError(
          "vocab/generate",
          e instanceof Error ? e.message : String(e),
          "Generation failed. Please try again.",
        ),
      },
      502,
    );
  }
}
