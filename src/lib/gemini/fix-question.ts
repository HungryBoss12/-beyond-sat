import { GoogleGenAI } from "@google/genai";
import { buildSystemPrompt, VISION_FIX_PROMPT, VISION_FIX_RECHECK_PROMPT } from "@/lib/ai/prompts";
import {
  GEMINI_IMPORT_EXTRACT_MODEL,
  GEMINI_IMPORT_MAX_OUTPUT_TOKENS,
  GEMINI_IMPORT_RECHECK_MODEL,
  GEMINI_IMPORT_TEMPERATURE,
} from "./config";
import { GeminiError, mapGeminiSdkError } from "./errors";

export type FixStage = "extract" | "recheck";

export type FixBrokenQuestionInput = {
  number: number;
  rec: Record<string, string>;
  errors: string[];
  warnings: string[];
};

export type FixBrokenQuestionOptions = {
  apiKey: string;
  stage?: FixStage;
  /** Stage-1 JSON object text; required when stage is "recheck". */
  priorFix?: string;
};

/**
 * Two-stage text repair for a broken import draft (no page image required).
 * Stage extract → Gemini 2.5 Pro; stage recheck → Gemini 2.5 Flash.
 */
export async function fixBrokenQuestionWithGemini(
  input: FixBrokenQuestionInput,
  options: FixBrokenQuestionOptions,
): Promise<string> {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) {
    throw new GeminiError(
      "MISSING_API_KEY",
      "GEMINI_API_KEY is not configured on the server.",
      503,
    );
  }

  const stage: FixStage = options.stage === "recheck" ? "recheck" : "extract";
  const model = stage === "recheck" ? GEMINI_IMPORT_RECHECK_MODEL : GEMINI_IMPORT_EXTRACT_MODEL;

  const payload = JSON.stringify(
    {
      number: input.number,
      rec: input.rec,
      errors: input.errors,
      warnings: input.warnings,
    },
    null,
    2,
  );

  const userText =
    stage === "recheck"
      ? `${VISION_FIX_RECHECK_PROMPT}\n\nOriginal broken draft + errors:\n${payload}\n\nFirst-pass repair JSON:\n${options.priorFix?.trim() || "{}"}`
      : `${VISION_FIX_PROMPT}\n\nBroken draft + validation issues:\n${payload}`;

  const ai = new GoogleGenAI({ apiKey });

  let text: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: userText }] }],
      config: {
        systemInstruction: buildSystemPrompt("vision"),
        temperature: GEMINI_IMPORT_TEMPERATURE,
        maxOutputTokens: GEMINI_IMPORT_MAX_OUTPUT_TOKENS,
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
