import { GoogleGenAI } from "@google/genai";
import {
  buildSystemPrompt,
  FIGURE_LOCATE_PROMPT,
  FIGURE_LOCATE_RECHECK_PROMPT,
} from "@/lib/ai/prompts";
import {
  GEMINI_IMPORT_EXTRACT_MODEL,
  GEMINI_IMPORT_RECHECK_MODEL,
  GEMINI_IMPORT_TEMPERATURE,
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
 * Ask Gemini for figure bounding boxes on one rendered page image.
 * Stage extract → Pro; stage recheck → Flash.
 */
export async function locateFiguresOnPage(
  imageDataUrl: string,
  options: LocateFigureOptions,
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

  const stage: FigureStage = options.stage === "recheck" ? "recheck" : "extract";
  const model = stage === "recheck" ? GEMINI_IMPORT_RECHECK_MODEL : GEMINI_IMPORT_EXTRACT_MODEL;
  const hint = options.hint?.trim()
    ? `\n\nThis question's figure note: ${options.hint.trim()}`
    : "";

  const userParts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
    {
      text:
        stage === "recheck"
          ? `${FIGURE_LOCATE_RECHECK_PROMPT}${hint}\n\nFirst-pass JSON to verify:\n${options.priorLocation?.trim() || '{"figures":[]}'}`
          : `${FIGURE_LOCATE_PROMPT}${hint}`,
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
        maxOutputTokens: 2048,
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
