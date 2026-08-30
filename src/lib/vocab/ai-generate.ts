import { z } from "zod";
import { readEnv } from "@/lib/server-env";
import { completeOpenRouterJson } from "@/lib/import/openrouter-recheck";
import type { GeneratedVocabItem } from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const GEN_MODEL = "nvidia/nemotron-3-nano-30b-a3b:free";

const itemSchema = z.object({
  word: z.string().min(1),
  partOfSpeech: z.string().min(1),
  definition: z.string().min(1),
  dSatPassage: z.string().min(20),
  rootsEtymology: z.string().optional(),
  synonyms: z.array(z.string()).min(1),
  satTraps: z.string().optional(),
  difficultyTier: z.enum(["Foundational", "Medium", "Advanced"]).optional(),
  quizQuestion: z.object({
    passageText: z.string().min(20),
    options: z.array(z.string()).length(4),
    correctAnswer: z.string().min(1),
    explanation: z.string().min(10),
  }),
});

const batchSchema = z.object({
  items: z.array(itemSchema).min(1),
});

const SYSTEM = `You generate Digital SAT vocabulary content. Return ONLY valid JSON with this shape:
{"items":[{"word":"...","partOfSpeech":"...","definition":"...","dSatPassage":"30-50 word academic passage using the word naturally","rootsEtymology":"optional root note","synonyms":["..."],"satTraps":"common SAT distractor meaning note","difficultyTier":"Foundational|Medium|Advanced","quizQuestion":{"passageText":"passage with ______ blank","options":["A","B","C","D"],"correctAnswer":"exact match from options","explanation":"why correct"}}]}

Rules:
- dSatPassage: 30-50 words, Reading & Writing tone, word appears naturally
- quizQuestion.passageText must contain ______ for the blank
- exactly 4 distinct options; correctAnswer must match one option exactly
- satTraps should warn about secondary meanings that trap students
- No markdown, no commentary outside JSON`;

export async function generateVocabBatch(opts: {
  env: unknown;
  words?: string[];
  topic?: string;
  count?: number;
}): Promise<GeneratedVocabItem[]> {
  const apiKey = readEnv(opts.env, "OPENROUTER_API_KEY");
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

  const count = opts.count ?? (opts.words?.length || 10);
  const userPrompt = opts.words?.length
    ? `Generate SAT vocab cards for these words: ${opts.words.join(", ")}. Return ${opts.words.length} items.`
    : `Generate ${count} high-yield Digital SAT vocabulary items for topic: "${opts.topic ?? "Humanities academic vocabulary"}".`;

  let raw: string;
  try {
    raw = await completeOpenRouterJson({
      apiKey,
      system: SYSTEM,
      user: userPrompt,
      maxTokens: 8192,
    });
  } catch {
    raw = await fetchOpenRouterDirect(apiKey, SYSTEM, userPrompt);
  }

  const json = extractJson(raw);
  const parsed = batchSchema.parse(json);
  return parsed.items;
}

async function fetchOpenRouterDirect(
  apiKey: string,
  system: string,
  user: string,
): Promise<string> {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "HTTP-Referer": "https://beyondsat.app",
      "X-Title": "Beyond SAT Vocab",
    },
    body: JSON.stringify({
      model: GEN_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      max_tokens: 8192,
      stream: false,
    }),
  });
  if (!response.ok) throw new Error(`Generation failed (${response.status})`);
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty generation response");
  return text;
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Could not parse AI JSON output");
  }
}

export { itemSchema };
