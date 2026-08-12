import { GoogleGenAI } from "@google/genai";
import {
  buildSystemPrompt,
  VISION_EXTRACTION_PROMPT,
  VISION_RECHECK_PROMPT,
} from "@/lib/ai/prompts";
import {
  GEMINI_IMPORT_EXTRACT_MODEL,
  GEMINI_IMPORT_MAX_OUTPUT_TOKENS,
  GEMINI_IMPORT_RECHECK_MODEL,
  GEMINI_IMPORT_TEMPERATURE,
  parseImageDataUrl,
} from "./config";
import { GeminiError, mapGeminiSdkError } from "./errors";

export type VisionStage = "extract" | "recheck";

export type ExtractSatPageOptions = {
  apiKey: string;
  stage?: VisionStage;
  /** Stage-1 JSON text; required when stage is "recheck". */
  priorExtraction?: string;
};

/**
 * Sends one rendered PDF page image to Gemini and returns raw JSON-array text.
 *
 * Stage `extract` uses Gemini 2.5 Pro. Stage `recheck` uses Gemini 2.5 Flash
 * with the first-pass JSON so a second model can correct misses and OCR errors.
 */
export async function extractSatPageFromImage(
  imageDataUrl: string,
  options: ExtractSatPageOptions,
): Promise<string> {
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

  const stage: VisionStage = options.stage === "recheck" ? "recheck" : "extract";
  const model = stage === "recheck" ? GEMINI_IMPORT_RECHECK_MODEL : GEMINI_IMPORT_EXTRACT_MODEL;

  const userParts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
    {
      text:
        stage === "recheck"
          ? `${VISION_RECHECK_PROMPT}\n\nFirst-pass JSON to verify:\n${options.priorExtraction?.trim() || "[]"}`
          : VISION_EXTRACTION_PROMPT,
    },
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
      model,
      contents: [{ role: "user", parts: userParts }],
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
