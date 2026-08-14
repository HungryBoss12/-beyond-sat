import { GoogleGenAI } from "@google/genai";
import {
  buildSystemPrompt,
  VISION_ASK_PROMPT,
  VISION_FIX_PROMPT,
  VISION_FIX_RECHECK_PROMPT,
} from "@/lib/ai/prompts";
import { completeOpenRouterJson } from "@/lib/import/openrouter-recheck";
import {
  GEMINI_IMPORT_EXTRACT_MODEL,
  GEMINI_IMPORT_MAX_OUTPUT_TOKENS,
  GEMINI_IMPORT_TEMPERATURE,
  GEMINI_IMPORT_THINKING,
} from "./config";
import { GeminiError, mapGeminiSdkError } from "./errors";

export type FixStage = "extract" | "recheck" | "ask";

export type FixBrokenQuestionInput = {
  number: number;
  rec: Record<string, string>;
  errors: string[];
  warnings: string[];
  instruction?: string;
};

export type FixBrokenQuestionOptions = {
  apiKey: string;
  stage?: FixStage;
  /** Stage-1 JSON object text; required when stage is "recheck". */
  priorFix?: string;
};

/**
 * Two-stage text repair for a broken import draft, plus free-text "ask".
 * Stage extract / ask → Gemini 3 Flash; stage recheck → Nemotron 3 Ultra.
 */
export async function fixBrokenQuestionWithGemini(
  input: FixBrokenQuestionInput,
  options: FixBrokenQuestionOptions,
): Promise<string> {
  const stage: FixStage =
    options.stage === "recheck" ? "recheck" : options.stage === "ask" ? "ask" : "extract";

  const payload = JSON.stringify(
    {
      number: input.number,
      rec: input.rec,
      errors: input.errors,
      warnings: input.warnings,
      instruction: input.instruction,
    },
    null,
    2,
  );

  if (stage === "recheck") {
    return completeOpenRouterJson({
      apiKey: options.apiKey,
      system: "Return only a JSON object. No markdown fences.",
      user: `${VISION_FIX_RECHECK_PROMPT}\n\nOriginal broken draft + errors:\n${payload}\n\nFirst-pass repair JSON:\n${options.priorFix?.trim() || "{}"}`,
    });
  }

  const apiKey = options.apiKey?.trim();
  if (!apiKey) {
    throw new GeminiError(
      "MISSING_API_KEY",
      "GEMINI_API_KEY is not configured on the server.",
      503,
    );
  }

  const userText =
    stage === "ask"
      ? `${VISION_ASK_PROMPT}\n\nDraft + instruction:\n${payload}`
      : `${VISION_FIX_PROMPT}\n\nBroken draft + validation issues:\n${payload}`;

  const ai = new GoogleGenAI({ apiKey });

  let text: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_IMPORT_EXTRACT_MODEL,
      contents: [{ role: "user", parts: [{ text: userText }] }],
      config: {
        systemInstruction: buildSystemPrompt("vision"),
        temperature: GEMINI_IMPORT_TEMPERATURE,
        maxOutputTokens: GEMINI_IMPORT_MAX_OUTPUT_TOKENS,
        thinkingConfig: GEMINI_IMPORT_THINKING,
        responseMimeType: "application/json",
      },
    });
    text = response.text?.trim();
  } catch (error) {
    throw mapGeminiSdkError(error);
  }

  if (!text) {
    throw new GeminiError("EMPTY_RESPONSE", "Gemini returned no content.", 502);
  }

  return text;
}
