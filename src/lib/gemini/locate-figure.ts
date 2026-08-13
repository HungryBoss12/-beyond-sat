import { GoogleGenAI } from "@google/genai";
import {
  buildSystemPrompt,
  FIGURE_LOCATE_PROMPT,
  FIGURE_LOCATE_RECHECK_PROMPT,
} from "@/lib/ai/prompts";
import { completeOpenRouterJson } from "@/lib/import/openrouter-recheck";
import {
  GEMINI_IMPORT_EXTRACT_MODEL,
  GEMINI_IMPORT_TEMPERATURE,
  GEMINI_IMPORT_THINKING,
  parseImageDataUrl,
} from "./config";
import { GeminiError, mapGeminiSdkError } from "./errors";

export type FigureStage = "extract" | "recheck";

export type LocateFigureOptions = {
  apiKey: string;
  stage?: FigureStage;
  priorLocation?: string;
  hint?: string;
};

/**
 * Stage extract → Gemini 3 Flash (needs the page).
 * Stage recheck → Nemotron 3 Ultra (JSON sanity only; no image).
 */
export async function locateFiguresOnPage(
  imageDataUrl: string,
  options: LocateFigureOptions,
): Promise<string> {
  const stage: FigureStage = options.stage === "recheck" ? "recheck" : "extract";
  const hint = options.hint?.trim()
    ? `\n\nThis question's figure note: ${options.hint.trim()}`
    : "";

  if (stage === "recheck") {
    return completeOpenRouterJson({
      apiKey: options.apiKey,
      system: "Return only a JSON object. No markdown fences.",
      user: `${FIGURE_LOCATE_RECHECK_PROMPT}${hint}\n\nFirst-pass JSON to verify:\n${options.priorLocation?.trim() || '{"figures":[]}'}`,
      maxTokens: 2048,
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

  let mimeType: string;
  let buffer: Buffer;
  try {
    ({ mimeType, buffer } = parseImageDataUrl(imageDataUrl));
  } catch (error) {
    throw new GeminiError(
      "INVALID_IMAGE",
      error instanceof Error ? error.message : "Invalid image data URL.",
    );
  }

  if (!buffer.length) {
    throw new GeminiError("INVALID_IMAGE", "Image data URL is empty.");
  }

  const userParts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
    { text: `${FIGURE_LOCATE_PROMPT}${hint}` },
    {
      inlineData: {
        mimeType,
        data: buffer.toString("base64"),
      },
    },
  ];

  const ai = new GoogleGenAI({ apiKey });

  let text: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_IMPORT_EXTRACT_MODEL,
      contents: [{ role: "user", parts: userParts }],
      config: {
        systemInstruction: buildSystemPrompt("vision"),
        temperature: GEMINI_IMPORT_TEMPERATURE,
        maxOutputTokens: 2048,
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
