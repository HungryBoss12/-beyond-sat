import { GoogleGenAI } from "@google/genai";
import { buildSystemPrompt, VISION_EXTRACTION_PROMPT } from "@/lib/ai/prompts";
import {
  GEMINI_IMPORT_MAX_OUTPUT_TOKENS,
  GEMINI_IMPORT_MODEL,
  GEMINI_IMPORT_TEMPERATURE,
  parseImageDataUrl,
} from "./config";
import { GeminiError, mapGeminiSdkError } from "./errors";

export type ExtractSatPageOptions = {
  apiKey: string;
};

/**
 * Sends one rendered PDF page image to Gemini and returns the raw JSON-array text
 * for the admin import pipeline (`extractJsonArray` in vision.ts).
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

  const ai = new GoogleGenAI({ apiKey });

  let text: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_IMPORT_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: VISION_EXTRACTION_PROMPT },
            {
              inlineData: {
                mimeType,
                data: buffer.toString("base64"),
              },
            },
          ],
        },
      ],
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
